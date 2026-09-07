import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ctllgomqzeweeyrvxboc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testHealthRecordInsert() {
  const testPhone = '0899999991';
  const testEmail = `${testPhone}@vhv-health.local`;
  const testPassword = 'Password123!';

  const { data: authData } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  const userId = authData?.user?.id;
  if (!userId) {
    console.error('No auth user');
    return;
  }

  // 1. Create a citizen
  const testCitId = `cit-${Date.now()}`;
  await supabase.from('citizens').insert({
    id: testCitId,
    user_id: userId,
    prefix: 'นาย',
    first_name: 'สมคิด',
    last_name: 'มั่นคง',
    citizen_id: '1234567890124',
    gender: 'ชาย',
    birth_date: '2510-01-01',
    age: 59,
    house_no: '10',
    moo: '1',
    village_name: 'บ้านดอน',
    phone: '0811111111'
  });

  // 2. Insert Health Record with assessment
  const testRecId = `rec-${Date.now()}`;
  const payload = {
    id: testRecId,
    citizen_id: testCitId,
    user_id: userId,
    date: '2026-08-28',
    sys: 120,
    dia: 80,
    pulse: 72,
    weight: 65,
    height: 170,
    bmi: 22.5,
    waist: 80,
    fbs: 95,
    is_fasting: true,
    temperature: 36.5,
    assessment: 'ความดันปกติ, น้ำตาลปกติ',
    notes: 'สุขภาพแข็งแรง',
    examiner_name: 'อสม. สมศรี',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data: recData, error: recErr } = await supabase
    .from('health_records')
    .insert(payload)
    .select();

  console.log('Insert with assessment result:', { data: recData, error: recErr });

  // Clean up
  await supabase.from('health_records').delete().eq('id', testRecId);
  await supabase.from('citizens').delete().eq('id', testCitId);
}

testHealthRecordInsert().catch(console.error);
