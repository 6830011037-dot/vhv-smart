import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ctllgomqzeweeyrvxboc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectSchemaAndTypes() {
  console.log('--- Step 1: Inspecting schema column types and primary keys ---');

  // Let's inspect test inserts/queries to determine whether id/user_id are UUID or TEXT
  const phoneA = '0891111111';
  const emailA = `${phoneA}@vhv-health.local`;
  const pwdA = '25250101';
  
  const { data: signA, error: errA } = await supabase.auth.signInWithPassword({ email: emailA, password: pwdA });
  console.log('User A auth id:', signA?.user?.id);
  const userIdA = signA?.user?.id;

  if (!userIdA) {
    console.error('Cannot sign in user A');
    return;
  }

  // 1. Check profiles
  console.log('\nChecking profiles table columns:');
  const { data: profData, error: profErr } = await supabase.from('profiles').select('*').limit(1);
  console.log('profiles sample query:', { profData, profErr });

  // 2. Check citizens
  console.log('\nChecking citizens table columns:');
  const { data: citData, error: citErr } = await supabase.from('citizens').select('*').limit(1);
  console.log('citizens sample query:', { citData, citErr });

  // 3. Check health_records
  console.log('\nChecking health_records table columns:');
  const { data: recData, error: recErr } = await supabase.from('health_records').select('*').limit(1);
  console.log('health_records sample query:', { recData, recErr });

  // 4. Check shared_reports
  console.log('\nChecking shared_reports table existence:');
  const { data: repData, error: repErr } = await supabase.from('shared_reports').select('*').limit(1);
  console.log('shared_reports sample query:', { repData, repErr });
}

inspectSchemaAndTypes().catch(console.error);
