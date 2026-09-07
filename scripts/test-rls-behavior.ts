import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ctllgomqzeweeyrvxboc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRlsPermissions() {
  console.log('Testing User A and User B actions against Supabase RLS...\n');

  // Authenticate User A
  const phoneA = '0891111111';
  const emailA = `${phoneA}@vhv-health.local`;
  const pwdA = '25250101';
  const clientA = createClient(supabaseUrl, supabaseAnonKey);
  const { data: signA } = await clientA.auth.signInWithPassword({ email: emailA, password: pwdA });
  const userA = signA.user;

  // Authenticate User B
  const phoneB = '0892222222';
  const emailB = `${phoneB}@vhv-health.local`;
  const pwdB = '25300202';
  const clientB = createClient(supabaseUrl, supabaseAnonKey);
  const { data: signB } = await clientB.auth.signInWithPassword({ email: emailB, password: pwdB });
  const userB = signB.user;

  console.log(`User A ID: ${userA?.id}`);
  console.log(`User B ID: ${userB?.id}\n`);

  if (!userA || !userB) {
    console.error('Failed to log in users.');
    return;
  }

  // TEST 1: User A Inserts Citizen A
  const citId = `cit-rls-test-${Date.now()}`;
  const citA = {
    id: citId,
    user_id: userA.id,
    prefix: 'นาย',
    first_name: 'สมชาย',
    last_name: 'ทดสอบ',
    citizen_id: '1509900123456',
    gender: 'ชาย',
    age: 50,
    birth_date: '2517-01-01',
    phone: '0812345678',
    house_no: '12',
    moo: '1',
    village_name: 'บ้านสุขใจ'
  };

  console.log('TEST A: User A inserts citizen A');
  const { error: insErrA } = await clientA.from('citizens').insert(citA);
  console.log('User A insert error:', insErrA);

  console.log('\nTEST A-Read: User A reads citizen A');
  const { data: readCitA, error: readErrA } = await clientA.from('citizens').select('*').eq('id', citId);
  console.log('User A read count:', readCitA?.length, 'error:', readErrA);

  console.log('\nTEST B: User B reads citizen A (Expect 0 / rejected)');
  const { data: readCitB, error: readErrB } = await clientB.from('citizens').select('*').eq('id', citId);
  console.log('User B read count:', readCitB?.length, 'error:', readErrB);

  console.log('\nTEST C: User B attempts to UPDATE citizen A (Expect rejected/0 rows modified)');
  const { data: updCitB, error: updErrB } = await clientB.from('citizens').update({ first_name: 'แฮกเกอร์' }).eq('id', citId).select();
  console.log('User B update result:', updCitB, 'error:', updErrB);

  console.log('\nTEST D: User B attempts to DELETE citizen A (Expect rejected/0 rows deleted)');
  const { data: delCitB, error: delErrB } = await clientB.from('citizens').delete().eq('id', citId).select();
  console.log('User B delete result:', delCitB, 'error:', delErrB);

  console.log('\nTEST E: User B attempts to INSERT citizen with user_id = User A (Spoofing - Expect rejected with 42501 or violates RLS)');
  const spoofedCit = {
    id: `cit-spoofed-${Date.now()}`,
    user_id: userA.id, // User B tries to insert into User A's ownership
    prefix: 'นาย',
    first_name: 'ปลอมตัว',
    last_name: 'มา',
    citizen_id: '1509900999999',
    gender: 'ชาย',
    age: 40,
    birth_date: '2527-01-01',
    phone: '0812345678',
    house_no: '99',
    moo: '1',
    village_name: 'บ้านสุขใจ'
  };
  const { data: spoofIns, error: spoofErr } = await clientB.from('citizens').insert(spoofedCit).select();
  console.log('User B spoofed insert result:', spoofIns, 'error:', spoofErr);

  console.log('\nTEST F: User A updates own citizen');
  const { data: updCitA, error: updErrA } = await clientA.from('citizens').update({ first_name: 'สมชาย (แก้ไข)' }).eq('id', citId).select();
  console.log('User A update result:', updCitA?.length, 'error:', updErrA);

  console.log('\nTEST G: User A deletes own citizen');
  const { data: delCitA, error: delErrA } = await clientA.from('citizens').delete().eq('id', citId).select();
  console.log('User A delete result:', delCitA?.length, 'error:', delErrA);
}

testRlsPermissions().catch(console.error);
