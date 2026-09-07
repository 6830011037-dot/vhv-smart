import { createClient } from '@supabase/supabase-js';
import { mapCitizenToSupabase, mapHealthRecordToSupabase } from '../src/lib/supabase';
import { Citizen, HealthRecord } from '../src/types';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ctllgomqzeweeyrvxboc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr';

async function runTests() {
  console.log('--- RUNNING SECURITY & INTEGRITY SUITE ---');

  const phoneA = '0891111111';
  const emailA = `${phoneA}@vhv-health.local`;
  const pwdA = '25250101';
  const clientA = createClient(supabaseUrl, supabaseAnonKey);
  const { data: signA } = await clientA.auth.signInWithPassword({ email: emailA, password: pwdA });
  const userA = signA?.user;

  const phoneB = '0892222222';
  const emailB = `${phoneB}@vhv-health.local`;
  const pwdB = '25300202';
  const clientB = createClient(supabaseUrl, supabaseAnonKey);
  const { data: signB } = await clientB.auth.signInWithPassword({ email: emailB, password: pwdB });
  const userB = signB?.user;

  if (!userA || !userB) {
    console.error('Users authentication failed');
    return;
  }

  console.log(`User A: ${userA.id}`);
  console.log(`User B: ${userB.id}`);

  // Test Citizen workflow
  const citA: Citizen = {
    id: `cit-sec-test-${Date.now()}`,
    prefix: 'นาย',
    firstName: 'สมศักดิ์',
    lastName: 'ยอดเยี่ยม',
    idCard: '1509900987654',
    gender: 'ชาย',
    age: 62,
    phone: '0891234567',
    houseNo: '55',
    moo: '3',
    villageName: 'บ้านหนองหอย',
    healthRight: 'บัตรทอง (UC/สปสช.)',
    chronicDiseases: ['ความดันโลหิตสูง'],
    createdAt: new Date().toISOString()
  };

  const citPayload = mapCitizenToSupabase(citA, userA.id);
  const { error: insErrA } = await clientA.from('citizens').insert(citPayload);
  console.log('User A Insert Citizen result:', insErrA ? insErrA.message : 'SUCCESS');

  const { data: readA } = await clientA.from('citizens').select('*').eq('id', citA.id);
  console.log('User A Read Citizen result:', readA?.length === 1 ? 'SUCCESS (1 row)' : 'FAIL');

  const { data: readB } = await clientB.from('citizens').select('*').eq('id', citA.id);
  console.log('User B Cross-Read Citizen result:', readB?.length === 0 ? 'PASS (0 rows returned / blocked)' : `FAIL (${readB?.length} rows returned)`);

  const { data: updB } = await clientB.from('citizens').update({ first_name: 'แฮกเกอร์' }).eq('id', citA.id).select();
  console.log('User B Cross-Update Citizen result:', !updB || updB.length === 0 ? 'PASS (0 rows modified / blocked)' : 'FAIL');

  const { data: delB } = await clientB.from('citizens').delete().eq('id', citA.id).select();
  console.log('User B Cross-Delete Citizen result:', !delB || delB.length === 0 ? 'PASS (0 rows deleted / blocked)' : 'FAIL');

  // Spoofed insert test
  const citSpoof = mapCitizenToSupabase({ ...citA, id: `cit-spoof-${Date.now()}` }, userA.id);
  const { data: spoofIns, error: spoofErr } = await clientB.from('citizens').insert(citSpoof).select();
  console.log('User B Spoofed Insert result:', Boolean(spoofErr) || !spoofIns || spoofIns.length === 0 ? 'PASS (Blocked)' : 'FAIL');

  // Clean up
  await clientA.from('citizens').delete().eq('id', citA.id);
}

runTests().catch(console.error);
