import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ctllgomqzeweeyrvxboc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectSamples() {
  const { data: profSample } = await supabase.from('profiles').select('*').limit(1);
  console.log('profiles keys:', profSample && profSample.length > 0 ? Object.keys(profSample[0]) : 'empty');

  const { data: citSample } = await supabase.from('citizens').select('*').limit(1);
  console.log('citizens keys:', citSample && citSample.length > 0 ? Object.keys(citSample[0]) : 'empty');

  const { data: recSample } = await supabase.from('health_records').select('*').limit(1);
  console.log('health_records keys:', recSample && recSample.length > 0 ? Object.keys(recSample[0]) : 'empty');
}

inspectSamples().catch(console.error);
