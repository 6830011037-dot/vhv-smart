import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ctllgomqzeweeyrvxboc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testTypeMismatch() {
  console.log('Testing operators to see which column triggers 42883 (uuid = text)...');
  
  // In PostgREST, we can test filtering on non-uuid values vs uuid columns:
  // If user_id is type TEXT, querying with standard text or comparing with UUID in SQL policy triggers 42883.
  // If user_id is type UUID, passing a non-UUID text gives 22P02 (invalid input syntax for type uuid).

  const nonUuidString = 'not-a-uuid-string-123';

  console.log('\n--- 1. Testing citizens.user_id type ---');
  const { data: cit1, error: citErr1 } = await supabase.from('citizens').select('id').eq('user_id', nonUuidString);
  console.log('citizens user_id query with text:', { cit1, citErr1 });

  console.log('\n--- 2. Testing citizens.id type ---');
  const { data: cit2, error: citErr2 } = await supabase.from('citizens').select('id').eq('id', nonUuidString);
  console.log('citizens id query with text:', { cit2, citErr2 });

  console.log('\n--- 3. Testing profiles.id type ---');
  const { data: prof1, error: profErr1 } = await supabase.from('profiles').select('id').eq('id', nonUuidString);
  console.log('profiles id query with text:', { prof1, profErr1 });

  console.log('\n--- 4. Testing health_records.user_id type ---');
  const { data: rec1, error: recErr1 } = await supabase.from('health_records').select('id').eq('user_id', nonUuidString);
  console.log('health_records user_id query with text:', { rec1, recErr1 });

  console.log('\n--- 5. Testing health_records.id type ---');
  const { data: rec2, error: recErr2 } = await supabase.from('health_records').select('id').eq('id', nonUuidString);
  console.log('health_records id query with text:', { rec2, recErr2 });
}

testTypeMismatch().catch(console.error);
