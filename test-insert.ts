import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ctllgomqzeweeyrvxboc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testInsert() {
  console.log('Testing insert to citizens table without session:');
  const testId = 'cit-test-' + Date.now();
  const { data, error } = await supabase.from('citizens').insert({
    id: testId,
    first_name: 'ทดสอบ',
    last_name: 'ระบบ',
    id_card: '1234567890123',
    gender: 'male',
    age: 50,
    house_no: '123',
    moo: '1',
    village_name: 'บ้านทดสอบ',
    health_right: 'บัตรทอง (UC)',
    chronic_diseases: []
  }).select();

  console.log('Result without auth session:', { data, error });

  if (error) {
    console.log('ERROR MESSAGE:', error.message, error.details, error.hint);
  } else {
    // clean up
    await supabase.from('citizens').delete().eq('id', testId);
    console.log('Cleaned up test record.');
  }
}

testInsert();
