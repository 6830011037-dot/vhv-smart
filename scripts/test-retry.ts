import { createClient } from '@supabase/supabase-js';
import { mapCitizenToSupabase } from '../src/lib/supabase';
import { Citizen } from '../src/types';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ctllgomqzeweeyrvxboc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRetry() {
  const phoneA = '0891111111';
  const emailA = `${phoneA}@vhv-health.local`;
  const pwdA = '25250101';
  const { data: signA } = await supabase.auth.signInWithPassword({ email: emailA, password: pwdA });
  const userId = signA.user?.id;

  const offlineCitizen: Citizen = {
    id: `cit-offline-${Date.now()}`,
    prefix: 'นางสาว',
    firstName: 'วิภา',
    lastName: 'รักษ์ไทย',
    idCard: '1509900888888',
    gender: 'หญิง',
    age: 38,
    phone: '0811112233',
    houseNo: '77',
    moo: '3',
    villageName: 'บ้านร่มเย็น',
    healthRight: 'บัตรทอง (UC/สปสช.)',
    chronicDiseases: [],
    avatarColor: '#78786C',
    createdAt: '2026-08-28'
  };

  const payload = mapCitizenToSupabase(offlineCitizen, userId!);
  console.log('Payload to upsert:', payload);
  const { data, error } = await supabase.from('citizens').upsert(payload).select();
  console.log('Upsert result:', { data, error });
}

testRetry().catch(console.error);
