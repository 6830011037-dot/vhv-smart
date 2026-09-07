import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ctllgomqzeweeyrvxboc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRights() {
  const list = [
    'rights', 'treatment_rights', 'medical_rights', 'health_scheme', 'scheme',
    'insurance_type', 'benefit', 'welfare', 'coverage', 'gold_card', 'universal_coverage',
    'medical_welfare', 'privilege', 'privileges', 'healthcare_right', 'health_care_right',
    'health_care', 'care_right', 'care_type', 'insurance_card', 'insurance_id',
    'emergency_name', 'emergency_person', 'relative_name', 'contact_name',
    'emergency_phone', 'emergency_tel', 'relative_phone', 'contact_phone',
    'emergency_number', 'relative_tel', 'contact_tel', 'guardian_phone', 'guardian_name'
  ];

  for (const c of list) {
    const { error } = await supabase.from('citizens').select(c).limit(0);
    if (!error) {
      console.log(`[citizens] ✅ ${c} EXISTS`);
    }
  }
}
testRights().catch(console.error);
