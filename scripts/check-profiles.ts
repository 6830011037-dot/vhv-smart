import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ctllgomqzeweeyrvxboc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkProfiles() {
  const allPossibleProfileCols = [
    'id', 'created_at', 'updated_at', 'name', 'birth_date', 'phone', 'moo',
    'village_name', 'subdistrict', 'district', 'province', 'vhv_id',
    'health_center_name', 'hospital_report_email', 'email', 'font_size'
  ];

  console.log('=== Checking Profiles columns ===');
  for (const c of allPossibleProfileCols) {
    const { error } = await supabase.from('profiles').select(c).limit(0);
    console.log(`profiles.${c}: ${error ? '❌ ' + error.message : '✅ EXISTS'}`);
  }
}

checkProfiles().catch(console.error);
