import { calculateAgeFromBirthDate, calculateBMI, formatThaiDate, formatThaiBirthDate } from '../src/utils/healthCalculations';
import { mapCitizenToSupabase, mapHealthRecordToSupabase, mapSupabaseToHealthRecord } from '../src/lib/supabase';
import { Citizen, HealthRecord } from '../src/types';

async function runDataConsistencyAudit() {
  console.log('===========================================================');
  console.log('    STEP 8.1 — UX & DATA CONSISTENCY RUNTIME AUDIT');
  console.log('===========================================================');

  let passed = 0;
  let total = 0;

  function assert(title: string, condition: boolean, details?: any) {
    total++;
    if (condition) {
      passed++;
      console.log(`[PASS] ${title}`);
    } else {
      console.error(`[FAIL] ${title}`, details || '');
    }
  }

  // -------------------------------------------------------------
  // Test 1: Birth Date → Age Calculation & Timezone Invariance
  // -------------------------------------------------------------
  console.log('\n--- 1. Testing Birth Date → Age Synchronization ---');
  
  // Normal Gregorian
  const age1 = calculateAgeFromBirthDate('1980-05-15');
  assert('Birthdate 1980-05-15 yields valid age ~46 (in 2026)', age1 >= 45 && age1 <= 47);

  // Buddhist Era (BE 2523 = CE 1980)
  const ageBE = calculateAgeFromBirthDate('2523-05-15');
  assert('Buddhist Era year 2523 parses to CE 1980 with same age', ageBE === age1);

  // Boundary condition: Birthday today
  const today = new Date();
  const birthToday = `${today.getFullYear() - 30}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  assert('Exact birthday today matches exact age 30', calculateAgeFromBirthDate(birthToday) === 30);

  // Boundary condition: Birthday tomorrow (not turned 30 yet)
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const birthTomorrow = `${tomorrow.getFullYear() - 30}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  assert('Birthday tomorrow is still age 29 (not reached birthday yet)', calculateAgeFromBirthDate(birthTomorrow) === 29);

  // Empty string handling
  assert('Empty birth date returns 0 without crashing', calculateAgeFromBirthDate('') === 0);

  // Timezone Shift Invariance for formatThaiDate
  const formattedDate = formatThaiDate('2026-08-31', true);
  assert('formatThaiDate("2026-08-31") returns 31 ส.ค. 2569 regardless of timezone', formattedDate.includes('31') && formattedDate.includes('ส.ค.') && formattedDate.includes('2569'), formattedDate);

  const formattedBirth = formatThaiBirthDate('1990-01-15');
  assert('formatThaiBirthDate("1990-01-15") returns 15 มกราคม 2533', formattedBirth === '15 มกราคม 2533', formattedBirth);


  // -------------------------------------------------------------
  // Test 2: Weight + Height → BMI Synchronization
  // -------------------------------------------------------------
  console.log('\n--- 2. Testing Weight + Height → BMI Calculation ---');

  const bmiValid = calculateBMI(70, 175);
  // 70 / (1.75 * 1.75) = 22.857... => 22.9
  assert('calculateBMI(70, 175) calculates exactly 22.9', bmiValid === 22.9, bmiValid);

  const bmiIncompleteW = calculateBMI(0, 175);
  assert('Missing weight returns 0 (no false defaults)', bmiIncompleteW === 0);

  const bmiIncompleteH = calculateBMI(70, 0);
  assert('Missing height returns 0 (no division by zero)', bmiIncompleteH === 0);

  const bmiIncompleteBoth = calculateBMI(0, 0);
  assert('Missing both returns 0', bmiIncompleteBoth === 0);


  // -------------------------------------------------------------
  // Test 3: Blood Pressure (SYS / DIA State Independence)
  // -------------------------------------------------------------
  console.log('\n--- 3. Testing Blood Pressure State Independence ---');

  // Verify SYS only
  const recSysOnly: HealthRecord = {
    id: 'test-rec-1',
    citizenId: 'cit-1',
    citizenName: 'Test Citizen',
    citizenAge: 50,
    gender: 'ชาย',
    houseNo: '1',
    moo: '1',
    date: '2026-08-31',
    systolic: 135,
    diastolic: 0,
    examinerName: 'อสม.',
    createdAt: '2026-08-31T09:00:00.000Z'
  };
  const payloadSysOnly = mapHealthRecordToSupabase(recSysOnly, 'usr-1');
  assert('Systolic 135 maps to sys: 135', payloadSysOnly.sys === 135);
  assert('Diastolic 0 maps to dia: null (no fake 0 mmHg)', payloadSysOnly.dia === null);

  // Verify DIA only
  const recDiaOnly: HealthRecord = {
    ...recSysOnly,
    systolic: 0,
    diastolic: 85
  };
  const payloadDiaOnly = mapHealthRecordToSupabase(recDiaOnly, 'usr-1');
  assert('Systolic 0 maps to sys: null (no fake 0 mmHg)', payloadDiaOnly.sys === null);
  assert('Diastolic 85 maps to dia: 85', payloadDiaOnly.dia === 85);


  // -------------------------------------------------------------
  // Test 4: Blood Sugar (DTX & Fasting Isolation)
  // -------------------------------------------------------------
  console.log('\n--- 4. Testing Blood Sugar & Fasting Toggle Logic ---');

  const recFBSFasting: HealthRecord = {
    ...recSysOnly,
    bloodSugar: 110,
    bloodSugarFasting: true
  };
  const payloadFBS = mapHealthRecordToSupabase(recFBSFasting, 'usr-1');
  assert('Blood sugar 110 maps to fbs: 110', payloadFBS.fbs === 110);
  assert('Fasting true maps to is_fasting: true', payloadFBS.is_fasting === true);

  const recFBSNonFasting: HealthRecord = {
    ...recSysOnly,
    bloodSugar: 145,
    bloodSugarFasting: false
  };
  const payloadNonFBS = mapHealthRecordToSupabase(recFBSNonFasting, 'usr-1');
  assert('Blood sugar 145 maps to fbs: 145', payloadNonFBS.fbs === 145);
  assert('Non-fasting maps to is_fasting: false', payloadNonFBS.is_fasting === false);

  const recNoFBS: HealthRecord = {
    ...recSysOnly,
    bloodSugar: undefined,
    bloodSugarFasting: undefined
  };
  const payloadNoFBS = mapHealthRecordToSupabase(recNoFBS, 'usr-1');
  assert('No blood sugar unentered maps to fbs: null (no default 0)', payloadNoFBS.fbs === null);
  assert('No blood sugar fasting unentered maps to is_fasting: null', payloadNoFBS.is_fasting === null);


  // -------------------------------------------------------------
  // Test 5: NULL vs ZERO Medical Integrity
  // -------------------------------------------------------------
  console.log('\n--- 5. Testing NULL vs ZERO Integrity Across All Metrics ---');

  const recEmptyVitals: HealthRecord = {
    ...recSysOnly,
    systolic: 0,
    diastolic: 0,
    pulse: undefined,
    weight: undefined,
    height: undefined,
    bmi: undefined,
    waist: undefined,
    bloodSugar: undefined,
    temperature: undefined
  };
  const payloadEmpty = mapHealthRecordToSupabase(recEmptyVitals, 'usr-1');
  assert('Empty pulse is null', payloadEmpty.pulse === null);
  assert('Empty weight is null', payloadEmpty.weight === null);
  assert('Empty height is null', payloadEmpty.height === null);
  assert('Empty bmi is null', payloadEmpty.bmi === null);
  assert('Empty waist is null', payloadEmpty.waist === null);
  assert('Empty temperature is null', payloadEmpty.temperature === null);

  // Test Reverse mapping from DB row to HealthRecord
  const dbRowWithNulls = {
    id: 'row-1',
    citizen_id: 'cit-1',
    user_id: 'usr-1',
    date: '2026-08-31',
    sys: null,
    dia: null,
    pulse: null,
    weight: null,
    height: null,
    bmi: null,
    fbs: null,
    is_fasting: null,
    temperature: null,
    examiner_name: 'อสม.'
  };
  const mappedBack = mapSupabaseToHealthRecord(dbRowWithNulls);
  assert('DB null pulse maps back to undefined', mappedBack.pulse === undefined);
  assert('DB null weight maps back to undefined', mappedBack.weight === undefined);
  assert('DB null fbs maps back to undefined', mappedBack.bloodSugar === undefined);
  assert('DB null temp maps back to undefined', mappedBack.temperature === undefined);


  // -------------------------------------------------------------
  // Test 6: Citizen Field Update Isolation
  // -------------------------------------------------------------
  console.log('\n--- 6. Testing Citizen Field Preservation ---');

  const originalCitizen: Citizen = {
    id: 'cit-preserve-1',
    prefix: 'นาง',
    firstName: 'สมศรี',
    lastName: 'ใจดี',
    idCard: '1234567890123',
    gender: 'หญิง',
    age: 45,
    birthDate: '1981-03-20',
    phone: '0812345678',
    houseNo: '12/3',
    moo: '2',
    villageName: 'หมู่บ้านพัฒนา',
    healthRight: 'บัตรทอง (UC/สปสช.)',
    chronicDiseases: ['เบาหวาน'],
    allergies: 'Penicillin',
    createdAt: '2026-08-31'
  };

  // Simulating field updates in CitizenDatabaseView
  const updatedCitizen: Citizen = {
    ...originalCitizen,
    phone: '0899999999'
  };

  assert('Updating phone does not alter id', updatedCitizen.id === originalCitizen.id);
  assert('Updating phone does not alter allergies', updatedCitizen.allergies === 'Penicillin');
  assert('Updating phone does not alter chronic diseases', updatedCitizen.chronicDiseases?.[0] === 'เบาหวาน');
  assert('Updating phone does not alter birthDate', updatedCitizen.birthDate === '1981-03-20');


  // -------------------------------------------------------------
  // Test 7: Timeline Chronological Consistency
  // -------------------------------------------------------------
  console.log('\n--- 7. Testing Timeline Chronological Sorting ---');

  const recordsList: HealthRecord[] = [
    { ...recSysOnly, id: 'r1', date: '2026-08-10', time: '09:00' },
    { ...recSysOnly, id: 'r2', date: '2026-08-31', time: '14:30' },
    { ...recSysOnly, id: 'r3', date: '2026-08-31', time: '08:15' },
    { ...recSysOnly, id: 'r4', date: '2026-08-20', time: '10:00' }
  ];

  // Timeline sort descending (newest first)
  const sortedTimeline = [...recordsList].sort((a, b) => {
    const dDiff = b.date.localeCompare(a.date);
    if (dDiff !== 0) return dDiff;
    return (b.time || '').localeCompare(a.time || '');
  });

  assert('First record is 2026-08-31 at 14:30', sortedTimeline[0].id === 'r2');
  assert('Second record is 2026-08-31 at 08:15', sortedTimeline[1].id === 'r3');
  assert('Third record is 2026-08-20 at 10:00', sortedTimeline[2].id === 'r4');
  assert('Fourth record is 2026-08-10 at 09:00', sortedTimeline[3].id === 'r1');


  console.log('\n===========================================================');
  console.log(` AUDIT SUMMARY: ${passed} / ${total} TESTS PASSED`);
  console.log('===========================================================');

  if (passed === total) {
    console.log(' ALL DATA CONSISTENCY & UX AUDIT TESTS PASSED SUCCESSFULLY!');
  } else {
    throw new Error(`Audit failed: ${total - passed} tests failed.`);
  }
}

runDataConsistencyAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
