import { createClient } from '@supabase/supabase-js';
import { mapCitizenToSupabase, mapHealthRecordToSupabase, mapProfileToSupabase } from '../src/lib/supabase';
import { Citizen, HealthRecord, VhvProfile } from '../src/types';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ctllgomqzeweeyrvxboc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr';

interface TestResult {
  table: string;
  op: string;
  test: string;
  status: 'PASS' | 'FAIL';
  detail: string;
}

const results: TestResult[] = [];

function record(table: string, op: string, test: string, pass: boolean, detail: string) {
  results.push({ table, op, test, status: pass ? 'PASS' : 'FAIL', detail });
  console.log(`[${pass ? '✅ PASS' : '❌ FAIL'}] [${table}] ${op} - ${test} (${detail})`);
}

async function runComprehensiveRlsTest() {
  console.log('=====================================================');
  console.log('🛡️ RUNNING COMPREHENSIVE RLS BEHAVIOR TEST');
  console.log('=====================================================\n');

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

  if (!userA || !userB) {
    console.error('Users authentication failed');
    return;
  }

  console.log(`User A (Owner): ${userA.id}`);
  console.log(`User B (Attacker / Other): ${userB.id}\n`);

  // -------------------------------------------------------------
  // 1. PROFILES TEST
  // -------------------------------------------------------------
  console.log('--- TESTING PROFILES TABLE RLS ---');
  // 1.1 User A reads own profile
  const { data: profA_read, error: profA_read_err } = await clientA.from('profiles').select('*').eq('id', userA.id);
  record('profiles', 'SELECT', 'Owner reads own profile', Boolean(!profA_read_err && profA_read && profA_read.length > 0), `Rows: ${profA_read?.length || 0}`);

  // 1.2 User B attempts to read User A's profile
  const { data: profB_readA, error: profB_readA_err } = await clientB.from('profiles').select('*').eq('id', userA.id);
  const bReadAProfilesBlocked = !profB_readA || profB_readA.length === 0;
  record('profiles', 'SELECT', 'User B cannot read User A profile', bReadAProfilesBlocked, `Rows returned: ${profB_readA?.length || 0}`);

  // 1.3 User B attempts to update User A's profile
  const { data: profB_updA, error: profB_updA_err } = await clientB.from('profiles').update({ name: 'Hacked' }).eq('id', userA.id).select();
  const bUpdAProfilesBlocked = (!profB_updA || profB_updA.length === 0) || Boolean(profB_updA_err);
  record('profiles', 'UPDATE', 'User B cannot update User A profile', bUpdAProfilesBlocked, `Rows updated: ${profB_updA?.length || 0}`);

  // 1.4 User B attempts to insert a profile with id = User A (Spoofing)
  const { data: profB_insA, error: profB_insA_err } = await clientB.from('profiles').insert({
    id: userA.id,
    name: 'Spoofed Profile',
    phone: '0899999999',
    birth_date: '2530-01-01'
  }).select();
  const bInsAProfilesBlocked = Boolean(profB_insA_err) || !profB_insA || profB_insA.length === 0;
  record('profiles', 'INSERT', 'User B cannot insert profile for User A', bInsAProfilesBlocked, profB_insA_err ? `Error: ${profB_insA_err.code} ${profB_insA_err.message}` : `Rows: ${profB_insA?.length || 0}`);

  // -------------------------------------------------------------
  // 2. CITIZENS TEST
  // -------------------------------------------------------------
  console.log('\n--- TESTING CITIZENS TABLE RLS ---');
  const citObjA: Citizen = {
    id: `cit-rls-${Date.now()}`,
    prefix: 'นาย',
    firstName: 'เอกชัย',
    lastName: 'ปลอดภัย',
    idCard: '1509900112233',
    gender: 'ชาย',
    age: 55,
    phone: '0812345678',
    houseNo: '100',
    moo: '2',
    villageName: 'บ้านสุขใจ',
    healthRight: 'บัตรทอง (UC/สปสช.)',
    chronicDiseases: [],
    createdAt: new Date().toISOString()
  };

  // 2.1 User A inserts Citizen A
  const citPayloadA = mapCitizenToSupabase(citObjA, userA.id);
  const { data: citA_ins, error: citA_ins_err } = await clientA.from('citizens').insert(citPayloadA).select();
  record('citizens', 'INSERT', 'Owner inserts own citizen', Boolean(!citA_ins_err && citA_ins && citA_ins.length > 0), citA_ins_err ? citA_ins_err.message : `Inserted: ${citObjA.id}`);

  // 2.2 User A reads Citizen A
  const { data: citA_read, error: citA_read_err } = await clientA.from('citizens').select('*').eq('id', citObjA.id);
  record('citizens', 'SELECT', 'Owner reads own citizen', Boolean(!citA_read_err && citA_read && citA_read.length > 0), `Rows: ${citA_read?.length || 0}`);

  // 2.3 User B reads Citizen A (Expect 0 rows)
  const { data: citB_readA, error: citB_readA_err } = await clientB.from('citizens').select('*').eq('id', citObjA.id);
  const bReadACitBlocked = !citB_readA || citB_readA.length === 0;
  record('citizens', 'SELECT', 'User B cannot read User A citizen', bReadACitBlocked, `Rows returned: ${citB_readA?.length || 0}`);

  // 2.4 User B updates Citizen A (Expect 0 rows or error)
  const { data: citB_updA, error: citB_updA_err } = await clientB.from('citizens').update({ first_name: 'แฮกแล้ว' }).eq('id', citObjA.id).select();
  const bUpdACitBlocked = (!citB_updA || citB_updA.length === 0) || Boolean(citB_updA_err);
  record('citizens', 'UPDATE', 'User B cannot update User A citizen', bUpdACitBlocked, `Rows modified: ${citB_updA?.length || 0}`);

  // 2.5 User B deletes Citizen A (Expect 0 rows or error)
  const { data: citB_delA, error: citB_delA_err } = await clientB.from('citizens').delete().eq('id', citObjA.id).select();
  const bDelACitBlocked = (!citB_delA || citB_delA.length === 0) || Boolean(citB_delA_err);
  record('citizens', 'DELETE', 'User B cannot delete User A citizen', bDelACitBlocked, `Rows deleted: ${citB_delA?.length || 0}`);

  // 2.6 User B attempts to INSERT citizen with user_id = User A (Spoofing with WITH CHECK)
  const citObjSpoof: Citizen = {
    id: `cit-spoof-${Date.now()}`,
    prefix: 'นาง',
    firstName: 'คนปลอม',
    lastName: 'แปลงสิทธิ์',
    idCard: '1509900888999',
    gender: 'หญิง',
    age: 40,
    phone: '0819999999',
    houseNo: '99',
    moo: '9',
    villageName: 'บ้านปลอม',
    healthRight: 'บัตรทอง (UC/สปสช.)',
    chronicDiseases: [],
    createdAt: new Date().toISOString()
  };
  const spoofPayload = mapCitizenToSupabase(citObjSpoof, userA.id);
  const { data: citB_spoofIns, error: citB_spoofIns_err } = await clientB.from('citizens').insert(spoofPayload).select();
  const bSpoofCitBlocked = Boolean(citB_spoofIns_err) || !citB_spoofIns || citB_spoofIns.length === 0;
  record('citizens', 'INSERT (Spoof)', 'User B cannot insert citizen for User A', bSpoofCitBlocked, citB_spoofIns_err ? `Error: ${citB_spoofIns_err.code} ${citB_spoofIns_err.message}` : `Rows: ${citB_spoofIns?.length || 0}`);

  // 2.7 User A updates own citizen
  const { data: citA_upd, error: citA_upd_err } = await clientA.from('citizens').update({ first_name: 'เอกชัย (อัปเดต)' }).eq('id', citObjA.id).select();
  record('citizens', 'UPDATE', 'Owner updates own citizen', Boolean(!citA_upd_err && citA_upd && citA_upd.length > 0), citA_upd_err ? citA_upd_err.message : `Updated: ${citA_upd?.[0]?.first_name}`);

  // 2.8 User A deletes own citizen
  const { data: citA_del, error: citA_del_err } = await clientA.from('citizens').delete().eq('id', citObjA.id).select();
  record('citizens', 'DELETE', 'Owner deletes own citizen', Boolean(!citA_del_err && citA_del && citA_del.length > 0), citA_del_err ? citA_del_err.message : `Deleted: ${citObjA.id}`);

  // -------------------------------------------------------------
  // 3. HEALTH RECORDS TEST
  // -------------------------------------------------------------
  console.log('\n--- TESTING HEALTH RECORDS TABLE RLS ---');
  const recObjA: HealthRecord = {
    id: `rec-rls-${Date.now()}`,
    citizenId: 'cit-test-parent',
    userId: userA.id,
    citizenName: 'นายเอกชัย ปลอดภัย',
    citizenAge: 55,
    gender: 'ชาย',
    houseNo: '100',
    moo: '2',
    date: '2026-08-28',
    systolic: 120,
    diastolic: 80,
    pulse: 75,
    weight: 65,
    height: 170,
    bmi: 22.5,
    waist: 80,
    waistUnit: 'cm',
    bloodSugar: 95,
    bloodSugarFasting: true,
    temperature: 36.6,
    notes: 'ความดันปกติ',
    examinerName: 'อสม. สมศรี',
    createdAt: new Date().toISOString()
  };

  // 3.1 User A inserts Health Record A
  const recPayloadA = mapHealthRecordToSupabase(recObjA, userA.id);
  const { data: recA_ins, error: recA_ins_err } = await clientA.from('health_records').insert(recPayloadA).select();
  record('health_records', 'INSERT', 'Owner inserts own record', Boolean(!recA_ins_err && recA_ins && recA_ins.length > 0), recA_ins_err ? recA_ins_err.message : `Inserted: ${recObjA.id}`);

  // 3.2 User A reads Health Record A
  const { data: recA_read, error: recA_read_err } = await clientA.from('health_records').select('*').eq('id', recObjA.id);
  record('health_records', 'SELECT', 'Owner reads own record', Boolean(!recA_read_err && recA_read && recA_read.length > 0), `Rows: ${recA_read?.length || 0}`);

  // 3.3 User B reads Health Record A (Expect 0 rows)
  const { data: recB_readA, error: recB_readA_err } = await clientB.from('health_records').select('*').eq('id', recObjA.id);
  const bReadARecBlocked = !recB_readA || recB_readA.length === 0;
  record('health_records', 'SELECT', 'User B cannot read User A record', bReadARecBlocked, `Rows returned: ${recB_readA?.length || 0}`);

  // 3.4 User B updates Health Record A (Expect 0 rows or error)
  const { data: recB_updA, error: recB_updA_err } = await clientB.from('health_records').update({ systolic: 200 }).eq('id', recObjA.id).select();
  const bUpdARecBlocked = (!recB_updA || recB_updA.length === 0) || Boolean(recB_updA_err);
  record('health_records', 'UPDATE', 'User B cannot update User A record', bUpdARecBlocked, `Rows modified: ${recB_updA?.length || 0}`);

  // 3.5 User B deletes Health Record A (Expect 0 rows or error)
  const { data: recB_delA, error: recB_delA_err } = await clientB.from('health_records').delete().eq('id', recObjA.id).select();
  const bDelARecBlocked = (!recB_delA || recB_delA.length === 0) || Boolean(recB_delA_err);
  record('health_records', 'DELETE', 'User B cannot delete User A record', bDelARecBlocked, `Rows deleted: ${recB_delA?.length || 0}`);

  // 3.6 User B attempts to INSERT record with user_id = User A (Spoofing)
  const spoofRecPayload = mapHealthRecordToSupabase({ ...recObjA, id: `rec-spoof-${Date.now()}` }, userA.id);
  const { data: recB_spoofIns, error: recB_spoofIns_err } = await clientB.from('health_records').insert(spoofRecPayload).select();
  const bSpoofRecBlocked = Boolean(recB_spoofIns_err) || !recB_spoofIns || recB_spoofIns.length === 0;
  record('health_records', 'INSERT (Spoof)', 'User B cannot insert record for User A', bSpoofRecBlocked, recB_spoofIns_err ? `Error: ${recB_spoofIns_err.code} ${recB_spoofIns_err.message}` : `Rows: ${recB_spoofIns?.length || 0}`);

  // 3.7 User A deletes own record
  const { data: recA_del, error: recA_del_err } = await clientA.from('health_records').delete().eq('id', recObjA.id).select();
  record('health_records', 'DELETE', 'Owner deletes own record', Boolean(!recA_del_err && recA_del && recA_del.length > 0), recA_del_err ? recA_del_err.message : `Deleted: ${recObjA.id}`);

  // -------------------------------------------------------------
  // 4. SHARED REPORTS STATUS
  // -------------------------------------------------------------
  console.log('\n--- TESTING SHARED REPORTS TABLE ---');
  const { data: repData, error: repErr } = await clientA.from('shared_reports').select('*').limit(1);
  const sharedReportsExists = !repErr || repErr.code !== 'PGRST205';
  record('shared_reports', 'SCHEMA', 'Table existence', sharedReportsExists, repErr ? `PGRST205: ${repErr.message}` : 'Table exists');

  console.log('\n=====================================================');
  console.log('📊 RLS TEST MATRIX SUMMARY');
  console.log('=====================================================\n');
  console.table(results);
}

runComprehensiveRlsTest().catch(console.error);
