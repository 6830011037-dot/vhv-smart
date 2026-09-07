import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ctllgomqzeweeyrvxboc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function getAllColumns(tableName: string, candidateCols: string[]) {
  console.log(`\n=== Auditing Table: ${tableName} ===`);
  const found: string[] = [];
  for (const col of candidateCols) {
    const { error } = await supabase.from(tableName).select(col).limit(0);
    if (!error) {
      found.push(col);
    }
  }
  console.log(`Found ${found.length} columns in ${tableName}:`, found);
  return found;
}

async function main() {
  const commonWords = [
    'id', 'user_id', 'citizen_id', 'created_at', 'updated_at',
    // citizens
    'prefix', 'title', 'first_name', 'name', 'last_name', 'fullname', 'full_name',
    'citizen_id', 'id_card', 'national_id', 'identification_no', 'pid', 'cid',
    'gender', 'sex', 'age', 'birth_date', 'birthdate', 'dob',
    'phone', 'tel', 'mobile', 'phone_number', 'telephone',
    'house_no', 'house_number', 'home_no', 'moo', 'village_no', 'village_name', 'village',
    'subdistrict', 'district', 'province', 'zipcode', 'postal_code',
    'health_right', 'right', 'rights', 'privilege', 'privileges', 'scheme', 'welfare', 'treatment_right',
    'chronic_diseases', 'chronic_disease', 'congenital_disease', 'disease', 'diseases', 'medical_condition',
    'allergies', 'allergy', 'drug_allergy',
    'emergency_contact', 'emergency_name', 'emergency_person', 'emergency_phone', 'emergency_tel', 'contact_phone',
    'avatar_color', 'color', 'avatar',
    'note', 'notes', 'remark', 'remarks', 'comment', 'status', 'is_active', 'deleted', 'is_deleted',
    // health_records
    'date', 'record_date', 'time', 'record_time', 'checkup_date',
    'systolic', 'sys', 'bp_sys', 'sbp', 'diastolic', 'dia', 'bp_dia', 'dbp',
    'pulse', 'hr', 'heart_rate', 'pulse_rate',
    'weight', 'height', 'bmi', 'waist', 'waist_line', 'waistline', 'waist_unit',
    'blood_sugar', 'fbs', 'bs', 'gl', 'glucose', 'blood_glucose',
    'blood_sugar_fasting', 'is_fasting', 'fasting', 'fasting_blood_sugar',
    'temperature', 'temp', 'body_temp', 'body_temperature',
    'examiner_name', 'examiner', 'recorded_by', 'recorder_name', 'officer_name', 'vhv_name'
  ];

  const uniqueWords = Array.from(new Set(commonWords));
  await getAllColumns('citizens', uniqueWords);
  await getAllColumns('health_records', uniqueWords);
  await getAllColumns('profiles', uniqueWords);
}

main().catch(console.error);
