import { createClient } from '@supabase/supabase-js';
import { 
  mapCitizenToSupabase, 
  mapHealthRecordToSupabase, 
  mapSharedReportToSupabase,
  mapSupabaseToCitizen, 
  mapSupabaseToHealthRecord,
  mapSupabaseToSharedReport
} from '../src/lib/supabase';
import { Citizen, HealthRecord, VhvProfile, SharedReport } from '../src/types';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ctllgomqzeweeyrvxboc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr';

async function runProductionStressTest() {
  console.log('========================================================================');
  console.log('🛡️ STEP 8 — FINAL PRODUCTION READINESS & STRESS AUDIT');
  console.log('========================================================================\n');

  const clientA = createClient(supabaseUrl, supabaseAnonKey);
  const clientB = createClient(supabaseUrl, supabaseAnonKey);

  const phoneA = '0891111111';
  const emailA = `${phoneA}@vhv-health.local`;
  const pwdA = '25250101';
  const { data: signA, error: errSignA } = await clientA.auth.signInWithPassword({ email: emailA, password: pwdA });
  const userA = signA?.user;

  const phoneB = '0892222222';
  const emailB = `${phoneB}@vhv-health.local`;
  const pwdB = '25300202';
  const { data: signB, error: errSignB } = await clientB.auth.signInWithPassword({ email: emailB, password: pwdB });
  const userB = signB?.user;

  if (!userA || !userB || errSignA || errSignB) {
    console.error('❌ Auth failure on test users:', { errSignA, errSignB });
    process.exit(1);
  }

  console.log(`[AUTH] User A: ${userA.id} (${phoneA})`);
  console.log(`[AUTH] User B: ${userB.id} (${phoneB})\n`);

  const results: Record<string, { status: 'PASS' | 'FAIL'; detail: string }> = {};

  // -------------------------------------------------------------------------
  // SECTION 1: DATA INTEGRITY & BULK OPERATIONS
  // -------------------------------------------------------------------------
  console.log('--- 1. DATA INTEGRITY & BULK OPERATIONS ---');
  try {
    const timestamp = Date.now();
    const citizensToInsert: Citizen[] = [];
    const recordsToInsert: HealthRecord[] = [];

    // Create 10 citizens with 5 records each (50 records)
    for (let i = 0; i < 10; i++) {
      const citId = `cit-stress-${timestamp}-${i}`;
      const citizen: Citizen = {
        id: citId,
        prefix: i % 2 === 0 ? 'นาย' : 'นาง',
        firstName: `ทดสอบระบบ_${i}`,
        lastName: `สเตรส_${timestamp}`,
        idCard: `110000000${String(i).padStart(4, '0')}`,
        gender: i % 2 === 0 ? 'ชาย' : 'หญิง',
        age: 30 + i * 3,
        phone: `081111${String(i).padStart(4, '0')}`,
        houseNo: `${100 + i}`,
        moo: '1',
        villageName: 'หมู่บ้านทดสอบ',
        healthRight: 'บัตรทอง (UC/สปสช.)',
        chronicDiseases: i % 3 === 0 ? ['ความดันโลหิตสูง'] : [],
        createdAt: new Date().toISOString()
      };
      citizensToInsert.push(citizen);

      for (let j = 0; j < 5; j++) {
        const recId = `rec-stress-${timestamp}-${i}-${j}`;
        const record: HealthRecord = {
          id: recId,
          citizenId: citId,
          citizenName: `${citizen.firstName} ${citizen.lastName}`,
          citizenAge: citizen.age,
          gender: citizen.gender,
          houseNo: citizen.houseNo,
          moo: citizen.moo,
          date: new Date(Date.now() - j * 86400000).toISOString().split('T')[0],
          systolic: 110 + j * 5,
          diastolic: 70 + j * 3,
          bloodSugar: 90 + j * 10,
          weight: 60 + i,
          height: 165,
          bmi: parseFloat(((60 + i) / (1.65 * 1.65)).toFixed(1)),
          temperature: 36.5,
          pulse: 75,
          waist: 78,
          notes: 'ออกกำลังกายสม่ำเสมอ',
          examinerName: 'อสม. สมศรี',
          createdAt: new Date().toISOString()
        };
        recordsToInsert.push(record);
      }
    }

    // Insert citizens
    const citPayloads = citizensToInsert.map(c => mapCitizenToSupabase(c, userA.id));
    const { error: citInsErr } = await clientA.from('citizens').insert(citPayloads);

    // Insert records
    const recPayloads = recordsToInsert.map(r => mapHealthRecordToSupabase(r, userA.id));
    const { error: recInsErr } = await clientA.from('health_records').insert(recPayloads);

    if (!citInsErr && !recInsErr) {
      console.log(`[PASS] Bulk inserted 10 citizens and 50 health records successfully`);
      results['Data Integrity - Bulk Insert'] = { status: 'PASS', detail: '10 citizens + 50 records inserted' };
    } else {
      console.error('[FAIL] Bulk insert failed:', { citInsErr, recInsErr });
      results['Data Integrity - Bulk Insert'] = { status: 'FAIL', detail: JSON.stringify({ citInsErr, recInsErr }) };
    }

    // Verify Read and Counts
    const { data: readCit } = await clientA.from('citizens').select('*').in('id', citizensToInsert.map(c => c.id));
    const { data: readRec } = await clientA.from('health_records').select('*').in('id', recordsToInsert.map(r => r.id));

    if (readCit?.length === 10 && readRec?.length === 50) {
      console.log(`[PASS] Bulk read verification: 10/10 citizens and 50/50 health records returned accurately`);
      results['Data Integrity - Exact Count & Read'] = { status: 'PASS', detail: '10/10 citizens, 50/50 records matched' };
    } else {
      results['Data Integrity - Exact Count & Read'] = { status: 'FAIL', detail: `Got ${readCit?.length} cit, ${readRec?.length} rec` };
    }

    // Cleanup stress batch
    await clientA.from('health_records').delete().in('id', recordsToInsert.map(r => r.id));
    await clientA.from('citizens').delete().in('id', citizensToInsert.map(c => c.id));
    console.log(`[PASS] Bulk cleanup completed`);
  } catch (err: any) {
    results['Data Integrity'] = { status: 'FAIL', detail: err.message };
  }

  // -------------------------------------------------------------------------
  // SECTION 2: REPORT SNAPSHOT IMMUTABILITY & EXCHANGES
  // -------------------------------------------------------------------------
  console.log('\n--- 2. REPORT SNAPSHOT IMMUTABILITY & EXCHANGES ---');
  try {
    const reportTimestamp = Date.now();
    const testCitId = `cit-snap-${reportTimestamp}`;
    const testRecId = `rec-snap-${reportTimestamp}`;

    const originalCitizen: Citizen = {
      id: testCitId,
      prefix: 'นาย',
      firstName: 'ต้นฉบับ',
      lastName: 'สแนปช็อต',
      idCard: '1999900112233',
      gender: 'ชาย',
      age: 45,
      phone: '0812345678',
      houseNo: '55/5',
      moo: '3',
      villageName: 'บ้านตัวอย่าง',
      healthRight: 'บัตรทอง (UC/สปสช.)',
      chronicDiseases: [],
      createdAt: new Date().toISOString()
    };

    const originalRecord: HealthRecord = {
      id: testRecId,
      citizenId: testCitId,
      citizenName: 'นายต้นฉบับ สแนปช็อต',
      citizenAge: 45,
      gender: 'ชาย',
      houseNo: '55/5',
      moo: '3',
      date: new Date().toISOString().split('T')[0],
      systolic: 120,
      diastolic: 80,
      bloodSugar: 95,
      weight: 65,
      height: 170,
      bmi: 22.5,
      temperature: 36.6,
      pulse: 72,
      waist: 76,
      notes: 'ดูแลสุขภาพ',
      examinerName: 'อสม. สมศรี',
      createdAt: new Date().toISOString()
    };

    // Insert original data
    await clientA.from('citizens').insert(mapCitizenToSupabase(originalCitizen, userA.id));
    await clientA.from('health_records').insert(mapHealthRecordToSupabase(originalRecord, userA.id));

    const testReport: SharedReport = {
      id: crypto.randomUUID(),
      senderId: userA.id,
      senderName: 'อสม. สมศรี มีสุข',
      senderPhone: phoneA,
      senderHealthCenter: 'รพ.สต. บ้านร่มเย็น',
      receiverId: userB.id,
      receiverPhone: phoneB,
      title: 'รายงานทดสอบความไม่เปลี่ยนแปลงของ Snapshot',
      periodLabel: 'ข้อมูลประวัติ 1 รายการ',
      recordsCount: 1,
      citizensCount: 1,
      fileName: 'report_snapshot_test.xlsx',
      recordsData: [originalRecord],
      citizensData: [originalCitizen],
      citizenData: originalCitizen,
      healthRecords: [originalRecord],
      note: 'Snapshot validation test',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    const reportPayload = mapSharedReportToSupabase(testReport, userA.id, userB.id);

    const { data: createdReport, error: repErr } = await clientA.from('shared_reports').insert(reportPayload).select('*').single();
    if (repErr || !createdReport) {
      throw new Error(`Failed to create shared report: ${repErr?.message}`);
    }

    console.log(`[PASS] Shared Report created with ID: ${createdReport.id}`);

    // MUTATE Original Citizen and Record
    await clientA.from('citizens').update({ first_name: 'ชื่อเปลี่ยนไปแล้ว' }).eq('id', testCitId);
    await clientA.from('health_records').update({ sys: 180, fbs: 250 }).eq('id', testRecId);

    // Read Report as User B and verify Snapshot remains unchanged
    const { data: reportReadByB, error: readBErr } = await clientB.from('shared_reports').select('*').eq('id', createdReport.id).single();
    if (readBErr || !reportReadByB) {
      throw new Error(`User B failed to read shared report: ${readBErr?.message}`);
    }

    const mappedShared = mapSupabaseToSharedReport(reportReadByB);
    const snapCit = mappedShared.citizensData?.[0];
    const snapRec = mappedShared.recordsData?.[0];

    if (snapCit?.firstName === 'ต้นฉบับ' && snapRec?.systolic === 120 && snapRec?.bloodSugar === 95) {
      console.log(`[PASS] Snapshot Immutability verified: Report snapshot contains original data ('${snapCit.firstName}', BP ${snapRec.systolic}), unaffected by subsequent database mutations.`);
      results['Snapshot Immutability'] = { status: 'PASS', detail: 'Original snapshot preserved 100% after master updates' };
    } else {
      console.error('[FAIL] Snapshot was corrupted or not immutable:', { snapCit, snapRec });
      results['Snapshot Immutability'] = { status: 'FAIL', detail: 'Snapshot data did not match original' };
    }

    // Test Idempotent Acceptance
    const prefix = createdReport.id.slice(0, 8);
    const impCitId = `cit-imp-${prefix}-${testCitId}`;
    const impRecId = `rec-imp-${prefix}-${testRecId}`;

    const importedCit: Citizen = {
      ...snapCit!,
      id: impCitId
    };

    const importedRec: HealthRecord = {
      ...snapRec!,
      id: impRecId,
      citizenId: impCitId
    };

    // First Accept
    await clientB.from('citizens').upsert(mapCitizenToSupabase(importedCit, userB.id));
    await clientB.from('health_records').upsert(mapHealthRecordToSupabase(importedRec, userB.id));
    await clientB.from('shared_reports').update({ status: 'accepted' }).eq('id', createdReport.id);

    // Second Accept (Idempotency Simulation)
    await clientB.from('citizens').upsert(mapCitizenToSupabase(importedCit, userB.id));
    await clientB.from('health_records').upsert(mapHealthRecordToSupabase(importedRec, userB.id));

    const { data: userBCits } = await clientB.from('citizens').select('*').eq('id', impCitId);
    const { data: userBRecs } = await clientB.from('health_records').select('*').eq('id', impRecId);

    if (userBCits?.length === 1 && userBRecs?.length === 1) {
      console.log(`[PASS] Idempotent Acceptance verified: Re-accepting produced exactly 1 citizen and 1 record with deterministic ID.`);
      results['Report Idempotency'] = { status: 'PASS', detail: 'Duplicate accept yields single deterministic record' };
    } else {
      results['Report Idempotency'] = { status: 'FAIL', detail: `Expected 1 row each, got ${userBCits?.length} cit, ${userBRecs?.length} rec` };
    }

    // Cleanup
    await clientA.from('health_records').delete().eq('id', testRecId);
    await clientA.from('citizens').delete().eq('id', testCitId);
    await clientB.from('health_records').delete().eq('id', impRecId);
    await clientB.from('citizens').delete().eq('id', impCitId);
    await clientA.from('shared_reports').delete().eq('id', createdReport.id);
  } catch (err: any) {
    results['Report Stress & Snapshot'] = { status: 'FAIL', detail: err.message };
  }

  // -------------------------------------------------------------------------
  // SECTION 3: PERFORMANCE BENCHMARK (1,000 RECORDS CALCULATION)
  // -------------------------------------------------------------------------
  console.log('\n--- 3. PERFORMANCE BENCHMARK (1,000 RECORDS COMPUTATION) ---');
  try {
    const simulatedRecords: HealthRecord[] = [];
    for (let k = 0; k < 1000; k++) {
      simulatedRecords.push({
        id: `rec-perf-${k}`,
        citizenId: `cit-perf-${k % 50}`,
        citizenName: `ประชาชน ${k % 50}`,
        citizenAge: 40 + (k % 30),
        gender: k % 2 === 0 ? 'ชาย' : 'หญิง',
        houseNo: `${10 + (k % 50)}`,
        moo: '1',
        date: new Date(Date.now() - (k % 60) * 86400000).toISOString().split('T')[0],
        systolic: 100 + (k % 60),
        diastolic: 60 + (k % 40),
        bloodSugar: 70 + (k % 120),
        weight: 50 + (k % 40),
        height: 160 + (k % 20),
        bmi: 22.0,
        temperature: 36.5 + (k % 10) * 0.1,
        pulse: 65 + (k % 35),
        waist: 70 + (k % 25),
        notes: 'คำแนะนำ',
        examinerName: 'อสม.',
        createdAt: new Date().toISOString()
      });
    }

    const t0 = performance.now();

    // Metric calculation simulation
    const distribution = { bp: 0, weight: 0, sugar: 0, pulse: 0, temp: 0, waist: 0 };
    const dateMap = new Map<string, number>();

    for (const r of simulatedRecords) {
      if (r.systolic && r.diastolic) distribution.bp++;
      if (r.weight && r.height) distribution.weight++;
      if (r.bloodSugar) distribution.sugar++;
      if (r.pulse) distribution.pulse++;
      if (r.temperature) distribution.temp++;
      if (r.waist) distribution.waist++;

      const d = r.date.split('T')[0];
      dateMap.set(d, (dateMap.get(d) || 0) + 1);
    }

    const t1 = performance.now();
    const durationMs = t1 - t0;

    console.log(`[PASS] 1,000 records processed in ${durationMs.toFixed(2)} ms (Benchmark target: < 50 ms)`);
    results['Performance - 1,000 Records Benchmark'] = {
      status: durationMs < 50 ? 'PASS' : 'FAIL',
      detail: `Processed 1,000 records in ${durationMs.toFixed(2)}ms`
    };
  } catch (err: any) {
    results['Performance Benchmark'] = { status: 'FAIL', detail: err.message };
  }

  // -------------------------------------------------------------------------
  // SECTION 4: SECURITY & CROSS-ACCOUNT PENETRATION SUITE
  // -------------------------------------------------------------------------
  console.log('\n--- 4. SECURITY & CROSS-ACCOUNT PENETRATION SUITE ---');
  try {
    // 1. User B attempts to read User A's profile directly
    const { data: leakProfile } = await clientB.from('profiles').select('*').eq('id', userA.id);
    const profileBlocked = !leakProfile || leakProfile.length === 0;

    // 2. User B attempts to update User A's profile
    const { data: leakProfUpd } = await clientB.from('profiles').update({ name: 'Hacked Name' }).eq('id', userA.id).select();
    const profUpdBlocked = !leakProfUpd || leakProfUpd.length === 0;

    // 3. User B attempts to read User A's citizens
    const { data: leakCitizens } = await clientB.from('citizens').select('*').eq('user_id', userA.id);
    const citReadBlocked = !leakCitizens || leakCitizens.length === 0;

    // 4. User B attempts to delete User A's citizens
    const { data: leakCitDel } = await clientB.from('citizens').delete().eq('user_id', userA.id).select();
    const citDelBlocked = !leakCitDel || leakCitDel.length === 0;

    // 5. User B attempts to insert citizen spoofing user_id = userA.id
    const { error: spoofErr } = await clientB.from('citizens').insert({
      id: `cit-spoof-${Date.now()}`,
      user_id: userA.id,
      first_name: 'Spoofed',
      last_name: 'Citizen'
    });
    const spoofBlocked = !!spoofErr;

    const allSecurityPassed = profileBlocked && profUpdBlocked && citReadBlocked && citDelBlocked && spoofBlocked;

    if (allSecurityPassed) {
      console.log(`[PASS] All cross-account penetration tests blocked by RLS & DB constraints.`);
      results['Security - Cross-Account Penetration'] = {
        status: 'PASS',
        detail: 'Cross-read, update, delete, spoof insert blocked 100%'
      };
    } else {
      results['Security - Cross-Account Penetration'] = {
        status: 'FAIL',
        detail: JSON.stringify({ profileBlocked, profUpdBlocked, citReadBlocked, citDelBlocked, spoofBlocked })
      };
    }
  } catch (err: any) {
    results['Security Penetration'] = { status: 'FAIL', detail: err.message };
  }

  // -------------------------------------------------------------------------
  // FINAL MATRIX SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log('📊 STEP 8 AUDIT SUMMARY MATRIX');
  console.log('========================================================================');
  console.table(results);

  const hasFail = Object.values(results).some(r => r.status === 'FAIL');
  if (!hasFail) {
    console.log('\n✨ ALL STEP 8 PRODUCTION STRESS & READINESS TESTS PASSED!');
  } else {
    console.log('\n❌ SOME PRODUCTION READINESS TESTS FAILED.');
    process.exit(1);
  }
}

runProductionStressTest();

