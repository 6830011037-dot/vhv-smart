import crypto from 'crypto';
import { Request, Response } from 'express';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

const TRIVIAL_PINS = new Set([
  '000000','111111','222222','333333','444444','555555','666666','777777','888888','999999',
  '123456','234567','345678','456789','567890','654321','765432','876543','987654','098765'
]);
const PATIENT_SESSION_TTL_MS = 30 * 60 * 1000;
const sessionSecret = process.env.PATIENT_ACCESS_SESSION_SECRET || crypto.randomBytes(32).toString('hex');

export interface PatientAccessRecord {
  id: string; citizen_id: string; user_id: string; token_hash: string; pin_hash: string; pin_salt: string;
  status: 'active' | 'expired' | 'revoked'; expires_at: string; revoked_at: string | null;
  failed_attempts: number; locked_until: string | null; last_accessed_at: string | null;
  created_at: string; updated_at: string;
}

const memoryAccessStore = new Map<string, PatientAccessRecord>();

export function generateSecurePin(): string {
  for (let i = 0; i < 100; i++) {
    const pin = crypto.randomInt(100000, 1000000).toString();
    if (!TRIVIAL_PINS.has(pin)) return pin;
  }
  return crypto.randomInt(100000, 1000000).toString();
}
export function generateSecureToken(): string { return crypto.randomBytes(32).toString('base64url'); }
export function hashToken(token: string): string { return crypto.createHash('sha256').update(token.trim()).digest('hex'); }
export function hashPin(pin: string, salt: string): string { return crypto.scryptSync(pin.trim(), salt, 32).toString('hex'); }
export function verifyPin(pin: string, salt: string, expectedHash: string): boolean {
  try {
    const a = Buffer.from(crypto.scryptSync(pin.trim(), salt, 32).toString('hex'), 'hex');
    const b = Buffer.from(expectedHash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

async function getAuthenticatedUser(req: Request, supabaseServer: SupabaseClient) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const rawToken = header.substring(7).trim();
  if (!rawToken) return null;
  const { data: { user }, error } = await supabaseServer.auth.getUser(rawToken);
  return error || !user ? null : { user, rawToken };
}
function createUserScopedClient(url: string, anonKey: string, token: string) {
  return createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
}
function signSession(payload: { accessId: string; citizenId: string; exp: number }) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', sessionSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function readSession(token: string) {
  try {
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = crypto.createHmac('sha256', sessionSecret).update(body).digest('base64url');
    const a = Buffer.from(sig); const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload?.accessId || !payload?.citizenId || Date.now() >= Number(payload.exp)) return null;
    return payload as { accessId: string; citizenId: string; exp: number };
  } catch { return null; }
}
function getPatientSession(req: Request) {
  const header = req.headers.authorization;
  if (header?.startsWith('Patient ')) return readSession(header.substring(8).trim());
  return readSession(typeof req.headers['x-patient-session'] === 'string' ? req.headers['x-patient-session'] : '');
}
function maskId(value: unknown) {
  const s = String(value ?? '');
  return s.length >= 4 ? `${'*'.repeat(Math.max(0, s.length - 4))}${s.slice(-4)}` : s ? '****' : '';
}

export function setupPatientAccessRoutes(app: any, supabaseServer: SupabaseClient, supabaseUrl: string, supabaseAnonKey: string) {
  app.post('/api/patient-access/generate', async (req: Request, res: Response) => {
    try {
      const auth = await getAuthenticatedUser(req, supabaseServer);
      if (!auth) return res.status(401).json({ success:false, error:'ไม่ได้รับอนุญาต: กรุณาเข้าสู่ระบบ อสม. ก่อนทำรายการ' });
      const { citizenId, expirationDays = 7 } = req.body;
      if (!citizenId || typeof citizenId !== 'string') return res.status(400).json({ success:false, error:'กรุณาระบุข้อมูลประชาชนที่ถูกต้อง' });
      const days = [1,7,30].includes(Number(expirationDays)) ? Number(expirationDays) : 7;
      const now = new Date(); const expiresAt = new Date(now.getTime() + days*86400000).toISOString();
      const rawToken = generateSecureToken(); const rawPin = generateSecurePin();
      const tokenHash = hashToken(rawToken); const pinSalt = crypto.randomBytes(16).toString('hex');
      const pinHash = hashPin(rawPin, pinSalt); const accessId = crypto.randomUUID();
      const userClient = createUserScopedClient(supabaseUrl, supabaseAnonKey, auth.rawToken);
      let savedToDatabase = false;
      try {
        await userClient.from('patient_access').update({ status:'revoked', revoked_at:now.toISOString(), updated_at:now.toISOString() }).eq('citizen_id', citizenId).eq('status','active');
        const { error } = await userClient.from('patient_access').insert({ id:accessId,citizen_id:citizenId,user_id:auth.user.id,token_hash:tokenHash,pin_hash:pinHash,pin_salt:pinSalt,status:'active',expires_at:expiresAt,created_at:now.toISOString(),updated_at:now.toISOString() });
        savedToDatabase = !error;
      } catch (e) { console.warn('[patient-access] database unavailable', e); }
      for (const item of memoryAccessStore.values()) if (item.citizen_id === citizenId && item.status === 'active') { item.status='revoked'; item.revoked_at=now.toISOString(); }
      memoryAccessStore.set(accessId,{ id:accessId,citizen_id:citizenId,user_id:auth.user.id,token_hash:tokenHash,pin_hash:pinHash,pin_salt:pinSalt,status:'active',expires_at:expiresAt,revoked_at:null,failed_attempts:0,locked_until:null,last_accessed_at:null,created_at:now.toISOString(),updated_at:now.toISOString() });
      const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
      return res.json({ success:true,message:'สร้างสิทธิ์เข้าดูผลตรวจเรียบร้อยแล้ว',access:{ id:accessId,citizenId,status:'active',expiresAt,createdAt:now.toISOString(),rawToken,pin:rawPin,accessUrl:`${origin}/patient-view?token=${rawToken}`,savedToDatabase } });
    } catch (error) { console.error('[patient-access/generate]',error); return res.status(500).json({success:false,error:'เกิดข้อผิดพลาดภายในระบบในการสร้างสิทธิ์'}); }
  });

  app.get('/api/patient-access/status/:citizenId', async (req: Request, res: Response) => {
    try {
      const auth = await getAuthenticatedUser(req, supabaseServer);
      if (!auth) return res.status(401).json({success:false,error:'ไม่ได้รับอนุญาต: กรุณาเข้าสู่ระบบ อสม.'});
      const citizenId = req.params.citizenId;
      const userClient = createUserScopedClient(supabaseUrl,supabaseAnonKey,auth.rawToken);
      let record:any = null;
      try { const {data} = await userClient.from('patient_access').select('id,citizen_id,status,expires_at,created_at,revoked_at,failed_attempts,locked_until').eq('citizen_id',citizenId).order('created_at',{ascending:false}).limit(1).maybeSingle(); record=data; } catch {}
      if (!record) record=Array.from(memoryAccessStore.values()).filter(r=>r.citizen_id===citizenId).sort((a,b)=>+new Date(b.created_at)-+new Date(a.created_at))[0] || null;
      if (!record) return res.json({success:true,hasAccess:false,citizenId});
      const expired = +new Date(record.expires_at) <= Date.now(); const locked = record.locked_until ? +new Date(record.locked_until)>Date.now() : false;
      const status = record.status==='active'&&expired ? 'expired' : record.status;
      return res.json({success:true,hasAccess:status==='active',access:{id:record.id,citizenId:record.citizen_id,status,expiresAt:record.expires_at,createdAt:record.created_at,revokedAt:record.revoked_at,isExpired:expired,isLocked:locked}});
    } catch (error) { console.error('[patient-access/status]',error); return res.status(500).json({success:false,error:'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์'}); }
  });

  app.post('/api/patient-access/revoke', async (req: Request, res: Response) => {
    try {
      const auth = await getAuthenticatedUser(req,supabaseServer);
      if (!auth) return res.status(401).json({success:false,error:'ไม่ได้รับอนุญาต: กรุณาเข้าสู่ระบบ อสม.'});
      const {citizenId,accessId}=req.body; if(!citizenId&&!accessId) return res.status(400).json({success:false,error:'กรุณาระบุข้อมูลสิทธิ์ที่ต้องการยกเลิก'});
      const now=new Date().toISOString(); const client=createUserScopedClient(supabaseUrl,supabaseAnonKey,auth.rawToken);
      let q=client.from('patient_access').update({status:'revoked',revoked_at:now,updated_at:now}); q=accessId?q.eq('id',accessId):q.eq('citizen_id',citizenId).eq('status','active'); await q;
      for(const item of memoryAccessStore.values()) if((accessId&&item.id===accessId)||(citizenId&&item.citizen_id===citizenId&&item.status==='active')){item.status='revoked';item.revoked_at=now;}
      return res.json({success:true,message:'ยกเลิกสิทธิ์เข้าดูผลตรวจเรียบร้อยแล้ว'});
    } catch(error){console.error('[patient-access/revoke]',error);return res.status(500).json({success:false,error:'เกิดข้อผิดพลาดในการยกเลิกสิทธิ์'});}
  });

  app.post('/api/patient-access/verify', async (req: Request, res: Response) => {
    try {
      const {token,pin}=req.body; const generic='ข้อมูลสำหรับเข้าดูผลตรวจไม่ถูกต้อง';
      if(!token||typeof token!=='string'||!pin||typeof pin!=='string') return res.status(400).json({success:false,error:generic});
      const tokenHash=hashToken(token); let record:PatientAccessRecord|null=null;
      try{const {data}=await supabaseServer.from('patient_access').select('*').eq('token_hash',tokenHash).maybeSingle();if(data)record=data as PatientAccessRecord;}catch{}
      if(!record) for(const item of memoryAccessStore.values()) if(item.token_hash===tokenHash){record=item;break;}
      if(!record){await new Promise(r=>setTimeout(r,200+Math.random()*200));return res.status(403).json({success:false,error:generic});}
      const now=new Date();
      if(record.locked_until&&+new Date(record.locked_until)>Date.now()) return res.status(429).json({success:false,error:'ระงับการเข้าถึงชั่วคราวเนื่องจากกรอกรหัสไม่ถูกต้องหลายครั้ง กรุณารออีก 15 นาที'});
      if(record.status==='revoked'||+new Date(record.expires_at)<=Date.now()) return res.status(403).json({success:false,error:'สิทธิ์นี้หมดอายุหรือถูกยกเลิกแล้ว กรุณาติดต่อ อสม. เพื่อขอรหัสใหม่'});
      if(!verifyPin(String(pin).trim(),record.pin_salt,record.pin_hash)){
        const attempts=(record.failed_attempts||0)+1; const lockUntil=attempts>=5?new Date(now.getTime()+15*60000).toISOString():null;
        try{await supabaseServer.from('patient_access').update({failed_attempts:attempts,locked_until:lockUntil,updated_at:now.toISOString()}).eq('id',record.id);}catch{}
        record.failed_attempts=attempts;record.locked_until=lockUntil;await new Promise(r=>setTimeout(r,Math.min(attempts*300,2000)));
        return res.status(lockUntil?429:403).json({success:false,error:lockUntil?'ระงับการเข้าถึงชั่วคราวเนื่องจากกรอกรหัสไม่ถูกต้องหลายครั้ง กรุณารออีก 15 นาที':generic});
      }
      try{await supabaseServer.from('patient_access').update({failed_attempts:0,locked_until:null,last_accessed_at:now.toISOString(),updated_at:now.toISOString()}).eq('id',record.id);}catch{}
      record.failed_attempts=0;record.locked_until=null;record.last_accessed_at=now.toISOString();
      const sessionToken=signSession({accessId:record.id,citizenId:record.citizen_id,exp:Date.now()+PATIENT_SESSION_TTL_MS});
      return res.json({success:true,message:'ยืนยันสิทธิ์สำเร็จ',sessionToken,expiresAt:record.expires_at,sessionExpiresAt:new Date(Date.now()+PATIENT_SESSION_TTL_MS).toISOString()});
    }catch(error){console.error('[patient-access/verify]',error);return res.status(500).json({success:false,error:'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์'});}
  });

  async function loadPatient(req: Request) {
    const session=getPatientSession(req); if(!session)return {error:'เซสชันผู้ป่วยไม่ถูกต้องหรือหมดอายุ',status:401 as const};
    let access:any=null;
    try{const {data}=await supabaseServer.from('patient_access').select('id,citizen_id,status,expires_at,revoked_at').eq('id',session.accessId).eq('citizen_id',session.citizenId).maybeSingle();access=data;}catch{}
    if(!access) access=memoryAccessStore.get(session.accessId);
    if(!access||access.status!=='active'||access.citizen_id!==session.citizenId||+new Date(access.expires_at)<=Date.now()) return {error:'สิทธิ์เข้าถึงหมดอายุหรือถูกยกเลิกแล้ว',status:403 as const};
    return {session};
  }

  // Patient-only profile endpoint. citizenId is always derived from the verified session.
  app.get('/api/patient-access/me', async (req: Request, res: Response) => {
    try{
      const auth=await loadPatient(req); if('error' in auth)return res.status(auth.status).json({success:false,error:auth.error});
      const citizenId=auth.session.citizenId;
      const {data,error}=await supabaseServer.from('citizens').select('*').eq('id',citizenId).maybeSingle();
      if(error)return res.status(502).json({success:false,error:'ไม่สามารถอ่านข้อมูลผู้รับบริการได้'});
      if(!data)return res.status(404).json({success:false,error:'ไม่พบข้อมูลผู้รับบริการ'});
      return res.json({success:true,patient:{id:data.id,prefix:data.prefix,firstName:data.first_name??data.firstName,lastName:data.last_name??data.lastName,birthDate:data.birth_date??data.birthDate,gender:data.gender,age:data.age,phone:maskId(data.phone),idCard:maskId(data.id_card??data.idCard),healthRight:data.health_right??data.healthRight,chronicDiseases:data.chronic_diseases??data.chronicDiseases}});
    }catch(error){console.error('[patient-access/me]',error);return res.status(500).json({success:false,error:'เกิดข้อผิดพลาดในการอ่านข้อมูลผู้รับบริการ'});}
  });

  // Patient-only health history endpoint. No client-supplied citizenId is accepted.
  app.get('/api/patient-access/health-records', async (req: Request, res: Response) => {
    try{
      const auth=await loadPatient(req); if('error' in auth)return res.status(auth.status).json({success:false,error:auth.error});
      const {data,error}=await supabaseServer.from('health_records').select('*').eq('citizen_id',auth.session.citizenId).order('date',{ascending:false}).limit(100);
      if(error)return res.status(502).json({success:false,error:'ไม่สามารถอ่านประวัติสุขภาพได้'});
      const records=(data||[]).map((r:any)=>({id:r.id,date:r.date,time:r.time,systolic:r.systolic,diastolic:r.diastolic,pulse:r.pulse,weight:r.weight,height:r.height,bmi:r.bmi,bloodSugar:r.blood_sugar??r.bloodSugar,bloodSugarFasting:r.blood_sugar_fasting??r.bloodSugarFasting,temperature:r.temperature,notes:r.notes,examinerName:r.examiner_name??r.examinerName,createdAt:r.created_at??r.createdAt}));
      return res.json({success:true,records});
    }catch(error){console.error('[patient-access/health-records]',error);return res.status(500).json({success:false,error:'เกิดข้อผิดพลาดในการอ่านประวัติสุขภาพ'});}
  });
}
