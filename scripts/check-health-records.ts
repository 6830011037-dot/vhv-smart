import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ctllgomqzeweeyrvxboc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testHealthRecordColumns() {
  const testCols = [
    'id', 'citizen_id', 'user_id', 'date', 'sys', 'dia', 'pulse',
    'weight', 'height', 'bmi', 'waist', 'fbs', 'is_fasting', 'temperature',
    'assessment', 'bp_stage', 'status', 'result', 'advice', 'notes',
    'examiner_name', 'created_at', 'updated_at'
  ];

  console.log('=== Checking health_records columns ===');
  for (const c of testCols) {
    const { error } = await supabase.from('health_records').select(c).limit(0);
    console.log(`health_records.${c}: ${error ? '❌ ' + error.message : '✅ EXISTS'}`);
  }
}

testHealthRecordColumns().catch(console.error);
