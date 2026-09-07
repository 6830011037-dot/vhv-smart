import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ctllgomqzeweeyrvxboc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectDataBeforeAlter() {
  console.log('--- Step 1 & 2: Checking existing rows for Non-UUID and NULL user_ids ---');
  
  // Authenticate to be able to read if RLS or query
  const phoneA = '0891111111';
  const emailA = `${phoneA}@vhv-health.local`;
  const pwdA = '25250101';
  await supabase.auth.signInWithPassword({ email: emailA, password: pwdA });

  // 1. Citizens count and inspection
  const { data: citRows, error: citErr } = await supabase.from('citizens').select('id, user_id');
  console.log('citizens query:', { total: citRows?.length, citErr });
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (citRows) {
    const invalidCit = citRows.filter(r => !r.user_id || !uuidRegex.test(r.user_id));
    const nullCit = citRows.filter(r => r.user_id === null || r.user_id === undefined || r.user_id.trim() === '');
    console.log(`citizens check: Total = ${citRows.length}, Invalid UUID = ${invalidCit.length}, NULL/Empty = ${nullCit.length}`);
    if (invalidCit.length > 0) {
      console.log('Invalid citizen user_ids:', invalidCit);
    }
  }

  // 2. Health records count and inspection
  const { data: recRows, error: recErr } = await supabase.from('health_records').select('id, user_id');
  console.log('health_records query:', { total: recRows?.length, recErr });

  if (recRows) {
    const invalidRec = recRows.filter(r => !r.user_id || !uuidRegex.test(r.user_id));
    const nullRec = recRows.filter(r => r.user_id === null || r.user_id === undefined || r.user_id.trim() === '');
    console.log(`health_records check: Total = ${recRows.length}, Invalid UUID = ${invalidRec.length}, NULL/Empty = ${nullRec.length}`);
    if (invalidRec.length > 0) {
      console.log('Invalid record user_ids:', invalidRec);
    }
  }
}

inspectDataBeforeAlter().catch(console.error);
