import crypto from 'crypto';
import { Request, Response } from 'express';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

const TRIVIAL_PINS = new Set(['000000','111111','222222','333333','444444','555555','666666','777777','888888','999999','123456','234567','345678','456789','567890','654321','765432','876543','987654','098765']);
const SESSION_TTL = 30 * 60 * 1000;
const isProduction = process.env.NODE_ENV === 'production';
const secret = process.env.PATIENT_ACCESS_SESSION_SECRET || (isProduction ? '' : crypto.randomBytes(32).toString('hex'));
const memory = new Map<string, any>();

function pin(){for(let i=0;i<100;i++){const p=crypto.randomInt(100000,1000000).toString();if(!TRIVIAL_PINS.has(p))return p;}return crypto.randomInt(100000,1000000).toString();}
function token(){return crypto.randomBytes(32).toString('base64url');}
function tokenHash(v:string){return crypto.createHash('sha256').update(v.trim()).digest('hex');}
function pinHash(v:string,s:string){return crypto.scryptSync(v.trim(),s,32).toString('hex');}
function checkPin(v:string,s:string,h:string){try{const a=Buffer.from(pinHash(v,s),'hex'),b=Buffer.from(h,'hex');return a.length===b.length&&crypto.timingSafeEqual(a,b);}catch{return false;}}
function sign(p:any){const body=Buffer.from(JSON.stringify(p)).toString('base64url');const sig=crypto.createHmac('sha256',secret).update(body).digest('base64url');return `${body}.${sig}`;}
function read(v:string){try{if(!secret)return null;const [body,sig]=v.split('.');if(!body||!sig)return null;const expected=crypto.createHmac('sha256',secret).update(body).digest('base64url');const a=Buffer.from(sig),b=Buffer.from(expected);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;const p=JSON.parse(Buffer.from(body,'base64url').toString());return p?.accessId&&p?.citizenId&&Date.now()<Number(p.exp)?p:null;}catch{return null;}}
function patientSession(req:Request){const h=req.headers.authorization;if(h?.startsWith('Patient '))return read(h.slice(8).trim());const v=req.headers['x-patient-session'];return read(typeof v==='string'?v:'');}
function mask(v:any){const s=String(v??'');return s.length>=4?'*'.repeat(s.length-4)+s.slice(-4):s?'****':'';}
function delay(ms:number){return new Promise(resolve=>setTimeout(resolve,ms));}
function ipHash(v:string){return crypto.createHash('sha256').update(v).digest('hex');}

export function setupPatientAccessRoutesV2(app:any,supabaseServer:SupabaseClient,url:string,publishableKey:string,secretKey?:string){
  const db=secretKey?createClient(url,secretKey,{auth:{autoRefreshToken:false,persistSession:false}}):null;
  const userClient=(tokenValue:string)=>createClient(url,publishableKey,{global:{headers:{Authorization:`Bearer ${tokenValue}`}}});
  const vhvAuth=async(req:Request)=>{const h=req.headers.authorization;if(!h?.startsWith('Bearer '))return null;const t=h.slice(7).trim();if(!t)return null;const {data:{user},error}=await supabaseServer.auth.getUser(t);return error||!user?null:{user,token:t};};
  const serverReady=!!db&&!!secret;
  const audit=async(req:Request,event:string,success:boolean,accessId?:string,userId?:string)=>{if(!db)return;try{const forwarded=req.headers['x-forwarded-for'];const ip=typeof forwarded==='string'?forwarded.split(',')[0].trim():(req.socket.remoteAddress||'unknown');await db.from('patient_access_audit').insert({access_id:accessId||null,user_id:userId||null,event,success,ip_hash:ipHash(ip),user_agent:String(req.headers['user-agent']||'').slice(0,500)});}catch(e){console.error('patient access audit failed',e);}};

  app.post('/api/patient-access/generate',async(req:Request,res:Response)=>{try{
    if(!serverReady)return res.status(503).json({success:false,error:'ระบบ Patient Access ยังไม่ได้ตั้งค่าความปลอดภัยของเซิร์ฟเวอร์'});
    const auth=await vhvAuth(req);if(!auth)return res.status(401).json({success:false,error:'ไม่ได้รับอนุญาต'});
    const citizenId=typeof req.body?.citizenId==='string'?req.body.citizenId.trim():'';
    if(!citizenId)return res.status(400).json({success:false,error:'กรุณาระบุประชาชน'});
    const days=[1,7,30].includes(Number(req.body?.expirationDays))?Number(req.body.expirationDays):7;

    // Defense-in-depth: never allow the caller to mint access for another user's citizen.
    const c=userClient(auth.token);
    const {data:citizen,error:citizenError}=await c.from('citizens').select('id').eq('id',citizenId).eq('user_id',auth.user.id).maybeSingle();
    if(citizenError)return res.status(502).json({success:false,error:'ไม่สามารถตรวจสอบข้อมูลประชาชนได้'});
    if(!citizen)return res.status(404).json({success:false,error:'ไม่พบข้อมูลประชาชน'});

    const now=new Date();const exp=new Date(now.getTime()+days*86400000);const rawToken=token();const rawPin=pin();const salt=crypto.randomBytes(16).toString('hex');const id=crypto.randomUUID();
    const row={id,citizen_id:citizenId,user_id:auth.user.id,token_hash:tokenHash(rawToken),pin_hash:pinHash(rawPin,salt),pin_salt:salt,status:'active',expires_at:exp.toISOString(),revoked_at:null,failed_attempts:0,locked_until:null,last_accessed_at:null,created_at:now.toISOString(),updated_at:now.toISOString()};
    const {error:revokeError}=await c.from('patient_access').update({status:'revoked',revoked_at:now.toISOString(),updated_at:now.toISOString()}).eq('citizen_id',citizenId).eq('status','active');
    if(revokeError)return res.status(502).json({success:false,error:'ไม่สามารถจัดการสิทธิ์เดิมได้'});
    const {error}=await c.from('patient_access').insert(row);if(error)return res.status(502).json({success:false,error:'ไม่สามารถสร้างสิทธิ์เข้าดูข้อมูลได้'});
    for(const x of memory.values())if(x.citizen_id===citizenId&&x.status==='active'){x.status='revoked';x.revoked_at=now.toISOString();}
    memory.set(id,row);await audit(req,'access_generated',true,id,auth.user.id);const origin=(process.env.PATIENT_ACCESS_URL||req.headers.origin||`${req.protocol}://${req.get('host')}`).replace(/\/$/,'');
    return res.json({success:true,access:{id,citizenId,status:'active',expiresAt:exp.toISOString(),rawToken,pin:rawPin,accessUrl:`${origin}/patient-view?token=${rawToken}`,savedToDatabase:true}});
  }catch(e){console.error(e);return res.status(500).json({success:false,error:'เกิดข้อผิดพลาดภายในระบบ'});}});

  app.get('/api/patient-access/status/:citizenId',async(req:Request,res:Response)=>{try{
    if(!serverReady)return res.status(503).json({success:false,error:'ระบบ Patient Access ยังไม่ได้ตั้งค่าความปลอดภัยของเซิร์ฟเวอร์'});
    const auth=await vhvAuth(req);if(!auth)return res.status(401).json({success:false,error:'ไม่ได้รับอนุญาต'});
    const citizenId=String(req.params.citizenId||'').trim();if(!citizenId)return res.status(400).json({success:false,error:'กรุณาระบุประชาชน'});
    const c=userClient(auth.token);const {data:citizen,error:ce}=await c.from('citizens').select('id').eq('id',citizenId).eq('user_id',auth.user.id).maybeSingle();
    if(ce)return res.status(502).json({success:false,error:'ไม่สามารถตรวจสอบข้อมูลประชาชนได้'});if(!citizen)return res.status(404).json({success:false,error:'ไม่พบข้อมูลประชาชน'});
    const {data:record,error}=await c.from('patient_access').select('id,citizen_id,status,expires_at,created_at,revoked_at,failed_attempts,locked_until').eq('citizen_id',citizenId).eq('user_id',auth.user.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(error)return res.status(502).json({success:false,error:'ไม่สามารถตรวจสอบสถานะสิทธิ์ได้'});
    if(!record)return res.json({success:true,hasAccess:false,citizenId});
    const expired=+new Date(record.expires_at)<=Date.now();const locked=record.locked_until?+new Date(record.locked_until)>Date.now():false;const status=record.status==='active'&&expired?'expired':record.status;
    return res.json({success:true,hasAccess:status==='active',access:{id:record.id,citizenId:record.citizen_id,status,expiresAt:record.expires_at,createdAt:record.created_at,revokedAt:record.revoked_at,isExpired:expired,isLocked:locked}});
  }catch(e){console.error(e);return res.status(500).json({success:false,error:'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์'});}});

  app.post('/api/patient-access/revoke',async(req:Request,res:Response)=>{try{
    if(!serverReady)return res.status(503).json({success:false,error:'ระบบ Patient Access ยังไม่ได้ตั้งค่าความปลอดภัยของเซิร์ฟเวอร์'});
    const auth=await vhvAuth(req);if(!auth)return res.status(401).json({success:false,error:'ไม่ได้รับอนุญาต'});
    const citizenId=typeof req.body?.citizenId==='string'?req.body.citizenId.trim():'';const accessId=typeof req.body?.accessId==='string'?req.body.accessId.trim():'';
    if(!citizenId&&!accessId)return res.status(400).json({success:false,error:'กรุณาระบุข้อมูลสิทธิ์ที่ต้องการยกเลิก'});
    const c=userClient(auth.token);let q=c.from('patient_access').update({status:'revoked',revoked_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('user_id',auth.user.id);
    if(accessId)q=q.eq('id',accessId);else q=q.eq('citizen_id',citizenId).eq('status','active');
    const {data,error}=await q.select('id,citizen_id').maybeSingle();
    if(error)return res.status(502).json({success:false,error:'ไม่สามารถยกเลิกสิทธิ์ได้'});
    if(!data)return res.status(404).json({success:false,error:'ไม่พบสิทธิ์ที่ต้องการยกเลิก'});
    for(const x of memory.values())if(x.id===data.id){x.status='revoked';x.revoked_at=new Date().toISOString();}
    await audit(req,'access_revoked',true,data.id,auth.user.id);
    return res.json({success:true,message:'ยกเลิกสิทธิ์เข้าดูผลตรวจเรียบร้อยแล้ว'});
  }catch(e){console.error(e);return res.status(500).json({success:false,error:'เกิดข้อผิดพลาดในการยกเลิกสิทธิ์'});}});

  app.post('/api/patient-access/verify',async(req:Request,res:Response)=>{try{
    if(!serverReady)return res.status(503).json({success:false,error:'ระบบ Patient Access ยังไม่ได้ตั้งค่าความปลอดภัยของเซิร์ฟเวอร์'});
    const raw=typeof req.body?.token==='string'?req.body.token:'';const supplied=typeof req.body?.pin==='string'?req.body.pin:'';const generic='ข้อมูลสำหรับเข้าดูผลตรวจไม่ถูกต้อง';
    if(!raw||!/^[0-9]{6}$/.test(supplied)){await delay(150);return res.status(400).json({success:false,error:generic});}
    const h=tokenHash(raw);const {data:r,error:lookupError}=await db!.from('patient_access').select('id,citizen_id,user_id,status,expires_at,pin_hash,pin_salt,failed_attempts,locked_until').eq('token_hash',h).maybeSingle();
    if(lookupError){console.error(lookupError);return res.status(503).json({success:false,error:'ไม่สามารถตรวจสอบสิทธิ์ได้'});}
    if(!r){await audit(req,'verify_invalid_token',false);await delay(250);return res.status(403).json({success:false,error:generic});}
    if(r.locked_until&&+new Date(r.locked_until)>Date.now()){await audit(req,'verify_locked',false,r.id,r.user_id);return res.status(429).json({success:false,error:'ระงับการเข้าถึงชั่วคราว กรุณารอ 15 นาที'});}
    if(r.status!=='active'||+new Date(r.expires_at)<=Date.now()){await audit(req,'verify_inactive_or_expired',false,r.id,r.user_id);return res.status(403).json({success:false,error:'สิทธิ์หมดอายุหรือถูกยกเลิกแล้ว'});}
    if(!checkPin(supplied,r.pin_salt,r.pin_hash)){
      // Atomic increment prevents concurrent requests from bypassing the five-attempt lock.
      const {data:updated,error:updateError}=await db!.rpc('increment_patient_access_failure',{p_access_id:r.id,p_lock_minutes:15,p_max_attempts:5});
      if(updateError){console.error(updateError);return res.status(503).json({success:false,error:'ไม่สามารถบันทึกความพยายามเข้าสู่ระบบได้'});}
      const attempts=Number(updated?.[0]?.failed_attempts??updated?.failed_attempts??(r.failed_attempts||0)+1);const locked=Boolean(updated?.[0]?.locked_until??updated?.locked_until);
      await delay(Math.min(2000,Math.max(1,attempts)*300));
      await audit(req,locked?'verify_pin_locked':'verify_pin_failed',false,r.id,r.user_id);
      return res.status(locked?429:403).json({success:false,error:locked?'ระงับการเข้าถึงชั่วคราว กรุณารอ 15 นาที':generic});
    }
    await db!.from('patient_access').update({failed_attempts:0,locked_until:null,last_accessed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',r.id);
    await audit(req,'verify_success',true,r.id,r.user_id);
    const exp=Date.now()+SESSION_TTL;const sessionToken=sign({accessId:r.id,citizenId:r.citizen_id,userId:r.user_id,exp});
    return res.json({success:true,sessionToken,expiresAt:r.expires_at,sessionExpiresAt:new Date(exp).toISOString()});
  }catch(e){console.error(e);return res.status(500).json({success:false,error:'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์'});}});

  async function load(req:Request){
    const s=patientSession(req);if(!s)return {error:'เซสชันผู้ป่วยไม่ถูกต้องหรือหมดอายุ',status:401 as const};
    if(!db||!secret)return {error:'ระบบผู้ป่วยยังไม่ได้ตั้งค่าเซิร์ฟเวอร์อย่างสมบูรณ์',status:503 as const};
    const {data:a,error}=await db.from('patient_access').select('id,citizen_id,user_id,status,expires_at,revoked_at').eq('id',s.accessId).eq('citizen_id',s.citizenId).eq('user_id',s.userId).maybeSingle();
    if(error)return {error:'ไม่สามารถตรวจสอบสิทธิ์ผู้ป่วยได้',status:503 as const};
    if(!a||a.status!=='active'||+new Date(a.expires_at)<=Date.now())return {error:'สิทธิ์เข้าถึงหมดอายุหรือถูกยกเลิกแล้ว',status:403 as const};
    return {s,a};
  }

  app.get('/api/patient-access/me',async(req:Request,res:Response)=>{try{
    const a=await load(req);if('error'in a)return res.status(a.status).json({success:false,error:a.error});
    const {data,error}=await db!.from('citizens').select('id,prefix,first_name,last_name,birth_date,gender,age,phone,citizen_id').eq('id',a.a.citizen_id).eq('user_id',a.a.user_id).maybeSingle();
    if(error)return res.status(502).json({success:false,error:'ไม่สามารถอ่านข้อมูลผู้รับบริการได้'});if(!data)return res.status(404).json({success:false,error:'ไม่พบข้อมูลผู้รับบริการ'});
    return res.json({success:true,patient:{prefix:data.prefix,firstName:data.first_name,lastName:data.last_name,birthDate:data.birth_date,gender:data.gender,age:data.age,phone:mask(data.phone),idCard:mask(data.citizen_id)}});
  }catch(e){console.error(e);return res.status(500).json({success:false,error:'เกิดข้อผิดพลาดในการอ่านข้อมูลผู้รับบริการ'});}});

  app.get('/api/patient-access/health-records',async(req:Request,res:Response)=>{try{
    const a=await load(req);if('error'in a)return res.status(a.status).json({success:false,error:a.error});
    const {data,error}=await db!.from('health_records').select('id,date,sys,dia,pulse,weight,height,bmi,waist,fbs,is_fasting,temperature,assessment,notes,examiner_name,created_at').eq('citizen_id',a.a.citizen_id).eq('user_id',a.a.user_id).order('date',{ascending:false}).limit(100);
    if(error)return res.status(502).json({success:false,error:'ไม่สามารถอ่านประวัติสุขภาพได้'});
    return res.json({success:true,records:(data||[]).map((r:any)=>({id:r.id,date:r.date,systolic:r.sys,diastolic:r.dia,pulse:r.pulse,weight:r.weight,height:r.height,bmi:r.bmi,waist:r.waist,bloodSugar:r.fbs,bloodSugarFasting:r.is_fasting,temperature:r.temperature,assessment:r.assessment,notes:r.notes,examinerName:r.examiner_name,createdAt:r.created_at}))});
  }catch(e){console.error(e);return res.status(500).json({success:false,error:'เกิดข้อผิดพลาดในการอ่านประวัติสุขภาพ'});}});
}
