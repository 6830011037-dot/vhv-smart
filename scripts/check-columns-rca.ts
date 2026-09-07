import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ctllgomqzeweeyrvxboc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectDatatypes() {
  console.log('Testing column data types via RPC or query inspections...');
  
  // 1. Sign in to get auth token
  const phoneA = '0891111111';
  const emailA = `${phoneA}@vhv-health.local`;
  const pwdA = '25250101';
  const { data: signA } = await supabase.auth.signInWithPassword({ email: emailA, password: pwdA });
  const userIdA = signA.user?.id;

  console.log('Auth user ID:', userIdA, 'Type of string representation:', typeof userIdA);

  // Let's test filter behaviors
  // In Supabase PostgREST, we can test exact type matching errors or type mismatches:
  
  // Test citizens with user_id eq UUID string
  const { data: citTest, error: citErr } = await supabase.from('citizens').select('id, user_id, first_name').limit(1);
  console.log('citizens inspect:', { citTest, citErr });

  // Test profiles with id eq UUID string
  const { data: profTest, error: profErr } = await supabase.from('profiles').select('id, name').limit(1);
  console.log('profiles inspect:', { profTest, profErr });

  // Test health_records with user_id eq UUID string
  const { data: recTest, error: recErr } = await supabase.from('health_records').select('id, user_id').limit(1);
  console.log('health_records inspect:', { recTest, recErr });
}

inspectDatatypes().catch(console.error);
