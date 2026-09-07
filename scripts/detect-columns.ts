import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ctllgomqzeweeyrvxboc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const citizenColumnsToTest = [
  'id', 'user_id', 'prefix', 'first_name', 'last_name', 'id_card', 'national_id', 'idcard', 'citizen_id',
  'gender', 'sex', 'age', 'birth_date', 'birthdate', 'dob', 'phone', 'tel', 'phone_number',
  'house_no', 'houseno', 'address', 'moo', 'village_name', 'village', 'health_right', 'right',
  'chronic_diseases', 'chronic_disease', 'allergies', 'emergency_contact', 'emergency_phone',
  'avatar_color', 'notes', 'created_at', 'updated_at'
];

const healthRecordColumnsToTest = [
  'id', 'citizen_id', 'user_id', 'citizen_name', 'citizen_age', 'gender',
  'house_no', 'moo', 'date', 'time', 'systolic', 'sys', 'diastolic', 'dia',
  'pulse', 'hr', 'heart_rate', 'weight', 'height', 'bmi', 'waist', 'waist_unit',
  'blood_sugar', 'fbs', 'blood_sugar_fasting', 'is_fasting', 'temperature', 'temp',
  'notes', 'note', 'examiner_name', 'created_at', 'updated_at'
];

async function checkColumns() {
  console.log('=== Checking Citizens Columns ===');
  for (const col of citizenColumnsToTest) {
    const { error } = await supabase.from('citizens').select(col).limit(0);
    if (error) {
      console.log(`[citizens] ❌ ${col}: ${error.message}`);
    } else {
      console.log(`[citizens] ✅ ${col} EXISTS`);
    }
  }

  console.log('\n=== Checking Health Records Columns ===');
  for (const col of healthRecordColumnsToTest) {
    const { error } = await supabase.from('health_records').select(col).limit(0);
    if (error) {
      console.log(`[health_records] ❌ ${col}: ${error.message}`);
    } else {
      console.log(`[health_records] ✅ ${col} EXISTS`);
    }
  }

  console.log('\n=== Checking Profiles Columns ===');
  const profileCols = [
    'id', 'name', 'phone', 'birth_date', 'vhv_id', 'village_name', 'moo',
    'subdistrict', 'district', 'province', 'health_center_name',
    'hospital_report_email', 'email', 'font_size', 'created_at', 'updated_at'
  ];
  for (const col of profileCols) {
    const { error } = await supabase.from('profiles').select(col).limit(0);
    if (error) {
      console.log(`[profiles] ❌ ${col}: ${error.message}`);
    } else {
      console.log(`[profiles] ✅ ${col} EXISTS`);
    }
  }
}

checkColumns().catch(console.error);
