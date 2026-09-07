import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ctllgomqzeweeyrvxboc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr';

console.log('Testing Supabase Connection...');
console.log('URL:', supabaseUrl);
console.log('Key length:', supabaseAnonKey.length);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runTests() {
  console.log('\n--- 1. Testing Profiles Table Query ---');
  const { data: profData, error: profErr } = await supabase
    .from('profiles')
    .select('id, name, phone, birth_date')
    .limit(5);

  if (profErr) {
    console.error('Profiles error:', JSON.stringify(profErr, null, 2));
  } else {
    console.log('Profiles query OK. Rows count:', profData?.length);
    console.log('Profiles data sample:', profData);
  }

  console.log('\n--- 2. Testing Citizens Table Query ---');
  const { data: citData, error: citErr } = await supabase
    .from('citizens')
    .select('id, user_id, first_name, last_name, id_card')
    .limit(5);

  if (citErr) {
    console.error('Citizens error:', JSON.stringify(citErr, null, 2));
  } else {
    console.log('Citizens query OK. Rows count:', citData?.length);
    console.log('Citizens data sample:', citData);
  }

  console.log('\n--- 3. Testing Health Records Table Query ---');
  const { data: recData, error: recErr } = await supabase
    .from('health_records')
    .select('id, user_id, citizen_name, systolic, diastolic, blood_sugar')
    .limit(5);

  if (recErr) {
    console.error('Health records error:', JSON.stringify(recErr, null, 2));
  } else {
    console.log('Health records query OK. Rows count:', recData?.length);
    console.log('Health records data sample:', recData);
  }

  console.log('\n--- 4. Testing Shared Reports Table Query ---');
  const { data: repData, error: repErr } = await supabase
    .from('shared_reports')
    .select('id, sender_id, receiver_phone, title, records_count')
    .limit(5);

  if (repErr) {
    console.error('Shared reports error:', JSON.stringify(repErr, null, 2));
  } else {
    console.log('Shared reports query OK. Rows count:', repData?.length);
    console.log('Shared reports data sample:', repData);
  }
}

runTests().catch(console.error);
