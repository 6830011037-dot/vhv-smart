import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ctllgomqzeweeyrvxboc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testMoreCols() {
  const moreCitCols = [
    'rights', 'health_insurance', 'insurance', 'treatment_right', 'privilege',
    'congenital_disease', 'disease', 'diseases', 'chronic', 'medical_condition',
    'emergency_name', 'contact_person', 'relative_phone', 'emergency_tel',
    'note', 'description', 'remark', 'remarks', 'status'
  ];

  console.log('=== Checking additional Citizens Columns ===');
  for (const col of moreCitCols) {
    const { error } = await supabase.from('citizens').select(col).limit(0);
    if (!error) {
      console.log(`[citizens] ✅ ${col} EXISTS`);
    }
  }

  const moreTables = [
    'shared_reports', 'reports', 'shared_data', 'report_shares', 'shares', 'notifications'
  ];
  console.log('\n=== Checking Table Existence ===');
  for (const tbl of moreTables) {
    const { error } = await supabase.from(tbl).select('*').limit(0);
    if (!error) {
      console.log(`[table] ✅ ${tbl} EXISTS`);
    } else {
      console.log(`[table] ❌ ${tbl}: ${error.code} - ${error.message}`);
    }
  }
}

testMoreCols().catch(console.error);
