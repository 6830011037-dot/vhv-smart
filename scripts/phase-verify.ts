import { createClient } from '@supabase/supabase-js';
import { mapCitizenToSupabase, mapHealthRecordToSupabase, mapProfileToSupabase, mapSupabaseToCitizen, mapSupabaseToHealthRecord, mapSupabaseToProfile } from '../src/lib/supabase';
import { Citizen, HealthRecord, VhvProfile } from '../src/types';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ctllgomqzeweeyrvxboc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr';

async function main() {
  console.log('================================================================');
  console.log('🔍 PHASE 1: DISCOVERY & CURRENT STATE OF DATABASE');
  console.log('================================================================');

  const clientA = createClient(supabaseUrl, supabaseAnonKey);
  const clientB = createClient(supabaseUrl, supabaseAnonKey);

  // Authenticate User A
  const phoneA = '0891111111';
  const emailA = `${phoneA}@vhv-health.local`;
  const pwdA = '25250101';
  const { data: authA, error: errAuthA } = await clientA.auth.signInWithPassword({ email: emailA, password: pwdA });
  const userA = authA?.user;

  // Authenticate User B
  const phoneB = '0892222222';
  const emailB = `${phoneB}@vhv-health.local`;
  const pwdB = '25300202';
  const { data: authB, error: errAuthB } = await clientB.auth.signInWithPassword({ email: emailB, password: pwdB });
  const userB = authB?.user;

  console.log(`User A Auth: ${userA?.id} (${errAuthA ? 'Error: ' + errAuthA.message : 'OK'})`);
  console.log(`User B Auth: ${userB?.id} (${errAuthB ? 'Error: ' + errAuthB.message : 'OK'})`);

  if (!userA || !userB) {
    console.error('Failed to log in test users.');
    return;
  }

  // Check counts
  const { data: countCit, error: errCountCit } = await clientA.from('citizens').select('id, user_id');
  const { data: countRec, error: errCountRec } = await clientA.from('health_records').select('id, user_id');
  const { data: countProf, error: errCountProf } = await clientA.from('profiles').select('id');

  console.log(`Current rows visible to User A:`);
  console.log(`- profiles: ${countProf?.length || 0} (error: ${errCountProf?.message || 'none'})`);
  console.log(`- citizens: ${countCit?.length || 0} (error: ${errCountCit?.message || 'none'})`);
  console.log(`- health_records: ${countRec?.length || 0} (error: ${errCountRec?.message || 'none'})`);

  // Check RLS behavior now
  console.log('\n--- Testing RLS behavior currently ---');

  // Test 1: User A inserts a record & citizen
  const testCitId = `cit-verify-${Date.now()}`;
  const testCit: Citizen = {
    id: testCitId,
    prefix: 'นาย',
    firstName: 'ทดสอบ',
    lastName: 'ความปลอดภัย',
    idCard: '1509900112233',
    gender: 'ชาย',
    age: 45,
    phone: '0812345678',
    houseNo: '123',
    moo: '1',
    villageName: 'บ้านร่มเย็น',
    healthRight: 'บัตรทอง (UC/สปสช.)',
    chronicDiseases: [],
    createdAt: new Date().toISOString()
  };

  const payloadCit = mapCitizenToSupabase(testCit, userA.id);
  const { data: insCitA, error: insCitAErr } = await clientA.from('citizens').insert(payloadCit).select();
  console.log('User A Insert Citizen:', { success: !insCitAErr, error: insCitAErr?.message });

  // Test 2: User A Reads Citizen
  const { data: readCitA } = await clientA.from('citizens').select('*').eq('id', testCitId);
  console.log('User A Read Citizen:', { count: readCitA?.length });

  // Test 3: User B Reads Citizen A
  const { data: readCitB } = await clientB.from('citizens').select('*').eq('id', testCitId);
  const crossReadBlocked = !readCitB || readCitB.length === 0;
  console.log('User B Cross-Read Citizen A (Expect Blocked/0):', { count: readCitB?.length, status: crossReadBlocked ? 'PASS (BLOCKED)' : 'FAIL (VISIBLE TO B)' });

  // Test 4: User B Updates Citizen A
  const { data: updCitB } = await clientB.from('citizens').update({ first_name: 'Hacked' }).eq('id', testCitId).select();
  const crossUpdBlocked = !updCitB || updCitB.length === 0;
  console.log('User B Cross-Update Citizen A (Expect Blocked/0):', { count: updCitB?.length, status: crossUpdBlocked ? 'PASS (BLOCKED)' : 'FAIL (UPDATED BY B)' });

  // Test 5: User B Deletes Citizen A
  const { data: delCitB } = await clientB.from('citizens').delete().eq('id', testCitId).select();
  const crossDelBlocked = !delCitB || delCitB.length === 0;
  console.log('User B Cross-Delete Citizen A (Expect Blocked/0):', { count: delCitB?.length, status: crossDelBlocked ? 'PASS (BLOCKED)' : 'FAIL (DELETED BY B)' });

  // Test 6: User B Inserts with user_id = User A (Spoofing)
  const spoofCit = mapCitizenToSupabase({ ...testCit, id: `cit-spoof-${Date.now()}` }, userA.id);
  const { data: spoofIns, error: spoofInsErr } = await clientB.from('citizens').insert(spoofCit).select();
  const spoofBlocked = Boolean(spoofInsErr) || !spoofIns || spoofIns.length === 0;
  console.log('User B Spoof Insert (Expect Blocked):', { success: !spoofBlocked, error: spoofInsErr?.message, status: spoofBlocked ? 'PASS (BLOCKED)' : 'FAIL (SPOOF SUCCEEDED)' });

  // Test Health Records
  const testRecId = `rec-verify-${Date.now()}`;
  const testRec: HealthRecord = {
    id: testRecId,
    citizenId: testCitId,
    userId: userA.id,
    citizenName: 'นายทดสอบ ความปลอดภัย',
    citizenAge: 45,
    gender: 'ชาย',
    houseNo: '123',
    moo: '1',
    date: '2026-08-28',
    systolic: 120,
    diastolic: 80,
    pulse: 72,
    weight: 65,
    height: 170,
    bmi: 22.5,
    waist: 80,
    waistUnit: 'cm',
    bloodSugar: 90,
    bloodSugarFasting: true,
    temperature: 36.5,
    notes: 'ปกติ',
    examinerName: 'อสม. สมศรี มีสุข',
    createdAt: new Date().toISOString()
  };

  const payloadRec = mapHealthRecordToSupabase(testRec, userA.id);
  const { data: insRecA, error: insRecAErr } = await clientA.from('health_records').insert(payloadRec).select();
  console.log('\nUser A Insert Health Record:', { success: !insRecAErr, error: insRecAErr?.message });

  const { data: readRecB } = await clientB.from('health_records').select('*').eq('id', testRecId);
  const crossReadRecBlocked = !readRecB || readRecB.length === 0;
  console.log('User B Cross-Read Record A (Expect Blocked/0):', { count: readRecB?.length, status: crossReadRecBlocked ? 'PASS (BLOCKED)' : 'FAIL (VISIBLE TO B)' });

  const { data: updRecB } = await clientB.from('health_records').update({ systolic: 180 }).eq('id', testRecId).select();
  const crossUpdRecBlocked = !updRecB || updRecB.length === 0;
  console.log('User B Cross-Update Record A (Expect Blocked/0):', { count: updRecB?.length, status: crossUpdRecBlocked ? 'PASS (BLOCKED)' : 'FAIL (UPDATED BY B)' });

  const { data: delRecB } = await clientB.from('health_records').delete().eq('id', testRecId).select();
  const crossDelRecBlocked = !delRecB || delRecB.length === 0;
  console.log('User B Cross-Delete Record A (Expect Blocked/0):', { count: delRecB?.length, status: crossDelRecBlocked ? 'PASS (BLOCKED)' : 'FAIL (DELETED BY B)' });

  // Cleanup
  await clientA.from('health_records').delete().eq('id', testRecId);
  await clientA.from('citizens').delete().eq('id', testCitId);
}

main().catch(console.error);
