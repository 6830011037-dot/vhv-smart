import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ctllgomqzeweeyrvxboc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testCols(table: string, cols: string[]) {
  const valid: string[] = [];
  for (const c of cols) {
    const { error } = await supabase.from(table).select(c).limit(0);
    if (!error) valid.push(c);
  }
  return valid;
}

async function run() {
  console.log('--- FAST AUDIT ---');
  // 1. citizens
  const citCols = [
    'id', 'user_id', 'prefix', 'first_name', 'last_name', 'citizen_id', 'gender', 'age',
    'birth_date', 'phone', 'house_no', 'moo', 'village_name', 'allergies', 'congenital_disease',
    'avatar_color', 'note', 'created_at', 'updated_at'
  ];
  const citValid = await testCols('citizens', citCols);
  console.log('citizens valid columns:', citValid);

  // 2. health_records
  const recCols = [
    'id', 'citizen_id', 'user_id', 'date', 'sys', 'dia', 'pulse', 'weight', 'height',
    'bmi', 'waist', 'fbs', 'is_fasting', 'temperature', 'notes', 'examiner_name',
    'created_at', 'updated_at'
  ];
  const recValid = await testCols('health_records', recCols);
  console.log('health_records valid columns:', recValid);

  // 3. profiles
  const profCols = [
    'id', 'name', 'phone', 'birth_date', 'vhv_id', 'village_name', 'moo',
    'subdistrict', 'district', 'province', 'health_center_name',
    'hospital_report_email', 'email', 'font_size', 'created_at', 'updated_at'
  ];
  const profValid = await testCols('profiles', profCols);
  console.log('profiles valid columns:', profValid);
}

run().catch(console.error);
