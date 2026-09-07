import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ctllgomqzeweeyrvxboc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAuthAndCRUD() {
  const testPhone = '0899999991';
  const testEmail = `${testPhone}@vhv-health.local`;
  const testPassword = 'Password123!';

  console.log('=== Step 1: Sign In or Sign Up Test User ===');
  let authUser: any = null;

  const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  if (signInErr) {
    console.log('Sign in failed, trying sign up:', signInErr.message);
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          name: 'สมศรี มีสุข (ทดสอบ)',
          phone: testPhone,
          birth_date: '2525-05-15'
        }
      }
    });

    if (signUpErr) {
      console.error('Sign up failed:', signUpErr);
      return;
    }
    authUser = signUpData.user;
    console.log('Sign up SUCCESS. User ID:', authUser?.id);
  } else {
    authUser = signInData.user;
    console.log('Sign in SUCCESS. User ID:', authUser?.id);
  }

  if (!authUser?.id) {
    console.error('No auth user session');
    return;
  }

  const userId = authUser.id;

  console.log('\n=== Step 2: Testing Profile Upsert ===');
  const profilePayload = {
    id: userId,
    name: 'สมศรี มีสุข (ทดสอบ)',
    phone: testPhone,
    birth_date: '2525-05-15',
    vhv_id: 'VHV-9999',
    village_name: 'บ้านดอนกลาง',
    moo: '1',
    subdistrict: 'หนองบัว',
    district: 'เมือง',
    province: 'เชียงใหม่',
    health_center_name: 'รพ.สต. หนองบัว',
    hospital_report_email: 'report@hospital.go.th',
    email: 'somsri@example.com',
    font_size: 'md',
    updated_at: new Date().toISOString()
  };

  const { data: profRes, error: profErr } = await supabase
    .from('profiles')
    .upsert(profilePayload)
    .select();

  console.log('Profile upsert result:', { data: profRes, error: profErr });

  console.log('\n=== Step 3: Testing Citizen Insert, Update, Delete ===');
  const testCitizenId = `cit-test-${Date.now()}`;
  
  // Test inserting congenital_disease as string or json
  const citizenPayload = {
    id: testCitizenId,
    user_id: userId,
    prefix: 'นาง',
    first_name: 'มาลี',
    last_name: 'ใจดี',
    citizen_id: '1234567890123',
    gender: 'หญิง',
    age: 58,
    birth_date: '2511-01-01',
    phone: '0812345678',
    house_no: '12/3',
    moo: '1',
    village_name: 'บ้านดอนกลาง',
    congenital_disease: 'เบาหวาน, ความดันโลหิตสูง',
    allergies: 'แพ้ยาเพนิซิลลิน',
    avatar_color: '#5D7052',
    note: 'ผู้สูงอายุกลุ่มเสี่ยง',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data: citInsertData, error: citInsertErr } = await supabase
    .from('citizens')
    .insert(citizenPayload)
    .select();

  console.log('Citizen insert result:', { data: citInsertData, error: citInsertErr });

  if (!citInsertErr) {
    console.log('\n--- Citizen Update ---');
    const { data: citUpdateData, error: citUpdateErr } = await supabase
      .from('citizens')
      .update({ age: 59, note: 'อัปเดตอายุแล้ว' })
      .eq('id', testCitizenId)
      .select();
    console.log('Citizen update result:', { data: citUpdateData, error: citUpdateErr });
  }

  console.log('\n=== Step 4: Testing Health Record Insert, Select, Delete ===');
  const testRecordId = `rec-test-${Date.now()}`;
  const recordPayload = {
    id: testRecordId,
    citizen_id: testCitizenId,
    user_id: userId,
    date: '2026-08-28',
    sys: 128,
    dia: 82,
    pulse: 74,
    weight: 62.5,
    height: 158,
    bmi: 25.0,
    waist: 78,
    fbs: 110,
    is_fasting: true,
    temperature: 36.6,
    notes: 'ตรวจปกติ สุขภาพแข็งแรงดี',
    examiner_name: 'สมศรี มีสุข (ทดสอบ)',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data: recInsertData, error: recInsertErr } = await supabase
    .from('health_records')
    .insert(recordPayload)
    .select();

  console.log('Health record insert result:', { data: recInsertData, error: recInsertErr });

  console.log('\n=== Step 5: Clean up test data ===');
  const { error: recDelErr } = await supabase.from('health_records').delete().eq('id', testRecordId);
  console.log('Record delete result:', { error: recDelErr });

  const { error: citDelErr } = await supabase.from('citizens').delete().eq('id', testCitizenId);
  console.log('Citizen delete result:', { error: citDelErr });

  console.log('\n=== ALL CRUD TESTS COMPLETED ===');
}

testAuthAndCRUD().catch(console.error);
