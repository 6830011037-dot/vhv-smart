import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ctllgomqzeweeyrvxboc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
  console.log('--- Inspecting citizens columns ---');
  const { data: cit, error: citErr } = await supabase.from('citizens').select('*').limit(1);
  console.log('citizens select * result:', { data: cit, error: citErr });

  console.log('--- Inspecting health_records columns ---');
  const { data: rec, error: recErr } = await supabase.from('health_records').select('*').limit(1);
  console.log('health_records select * result:', { data: rec, error: recErr });

  console.log('--- Inspecting profiles columns ---');
  const { data: prof, error: profErr } = await supabase.from('profiles').select('*').limit(1);
  console.log('profiles select * result:', { data: prof, error: profErr });
}

inspect().catch(console.error);
