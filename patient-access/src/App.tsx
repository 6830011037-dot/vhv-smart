import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { Activity, CalendarDays, ChevronRight, HeartPulse, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';

type View = 'home' | 'health' | 'profile';
type Patient = { prefix?: string; firstName?: string; lastName?: string; birthDate?: string; gender?: string; age?: number; phone?: string; idCard?: string; healthRight?: string };
type HealthRecord = { id:string; date:string; time?:string; systolic?:number; diastolic?:number; pulse?:number; weight?:number; bloodSugar?:number; notes?:string };
type StoredSession = { sessionToken:string; expiresAt?:string; sessionExpiresAt?:string };

function getStoredSession(): StoredSession | null { try { const raw=sessionStorage.getItem('vhv_patient_access'); return raw ? JSON.parse(raw) : null; } catch { return null; } }

export default function App(){
 const params=new URLSearchParams(window.location.search);
 const [token,setToken]=useState(params.get('token')||''); const [pin,setPin]=useState(''); const [session,setSession]=useState<StoredSession|null>(getStoredSession());
 const [loading,setLoading]=useState(false); const [dataLoading,setDataLoading]=useState(false); const [error,setError]=useState(''); const [view,setView]=useState<View>('home');
 const [patient,setPatient]=useState<Patient|null>(null); const [records,setRecords]=useState<HealthRecord[]>([]); const authenticated=!!session?.sessionToken;

 useEffect(()=>{ if(params.has('token')) window.history.replaceState({},document.title,window.location.pathname); },[]);
 useEffect(()=>{
   if(!session?.sessionToken)return; let cancelled=false;
   async function load(){
     setDataLoading(true);setError('');
     try{
       if(session?.sessionExpiresAt && Date.parse(session.sessionExpiresAt)<=Date.now()) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
       const headers={Authorization:`Patient ${session!.sessionToken}`};
       const [meRes,recordsRes]=await Promise.all([fetch('/api/patient-access/me',{headers}),fetch('/api/patient-access/health-records',{headers})]);
       const me=await meRes.json().catch(()=>null); const hr=await recordsRes.json().catch(()=>null);
       if(meRes.status===401||meRes.status===403||recordsRes.status===401||recordsRes.status===403){
         sessionStorage.removeItem('vhv_patient_access');
         if(!cancelled){setSession(null);setPatient(null);setRecords([]);setPin('');setToken('');setView('home');setError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');}
         return;
       }
       if(!meRes.ok||!me?.success)throw new Error(me?.error||'ไม่สามารถโหลดข้อมูลผู้รับบริการได้');
       if(!recordsRes.ok||!hr?.success)throw new Error(hr?.error||'ไม่สามารถโหลดประวัติสุขภาพได้');
       if(!cancelled){setPatient(me.patient||null);setRecords(Array.isArray(hr.records)?hr.records:[]);}
     }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'ไม่สามารถโหลดข้อมูลได้');}
     finally{if(!cancelled)setDataLoading(false);}
   }
   load();return()=>{cancelled=true};
 },[session?.sessionToken]);

 async function submit(e:FormEvent){
   e.preventDefault();setError('');
   if(!token.trim()||!/^[0-9]{6}$/.test(pin)){setError('กรุณากรอกรหัสเข้าถึงและ PIN 6 หลัก');return;}
   setLoading(true);
   try{
     const r=await fetch('/api/patient-access/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:token.trim(),pin:pin.trim()})});
     const d=await r.json().catch(()=>null);if(!r.ok||!d?.success)throw new Error(d?.error||'ไม่สามารถตรวจสอบสิทธิ์ได้');
     if(!d.sessionToken)throw new Error('ระบบไม่ได้รับเซสชันผู้ป่วยที่ปลอดภัย');
     const next={sessionToken:d.sessionToken,expiresAt:d.expiresAt,sessionExpiresAt:d.sessionExpiresAt};sessionStorage.setItem('vhv_patient_access',JSON.stringify(next));setSession(next);setPin('');window.history.replaceState({},document.title,window.location.pathname);
   }catch(x){setError(x instanceof Error?x.message:'ไม่สามารถตรวจสอบสิทธิ์ได้');}finally{setLoading(false);}
 }
 function logout(){sessionStorage.removeItem('vhv_patient_access');setSession(null);setPatient(null);setRecords([]);setPin('');setToken('');setView('home');setError('');}

 if(!authenticated)return <div className="login-page"><div className="login-card"><div className="brand-mark large"><HeartPulse size={28}/></div><p className="eyebrow">VHV Patient Access</p><h1>เข้าถึงข้อมูลสุขภาพ</h1><p className="login-copy">กรอกรหัส PIN 6 หลักที่ได้รับจากเจ้าหน้าที่ เพื่อดูข้อมูลสุขภาพของคุณ</p><form onSubmit={submit}>{!token&&<label>รหัสเข้าถึง<input value={token} onChange={e=>setToken(e.target.value)} placeholder="วางรหัสเข้าถึง" autoComplete="off"/></label>}<label>PIN 6 หลัก<input value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="••••••" inputMode="numeric" maxLength={6} autoComplete="one-time-code"/></label>{error&&<div className="error">{error}</div>}<button className="primary" disabled={loading}>{loading?'กำลังตรวจสอบ…':'เข้าสู่ข้อมูลสุขภาพ'}</button></form><div className="secure-note"><LockKeyhole size={17}/>การเข้าถึงได้รับการป้องกันและมีวันหมดอายุ</div><div className="privacy"><ShieldCheck size={17}/>อย่าแชร์ PIN หรือ QR ของคุณกับผู้อื่น</div></div></div>;

 const latest=records[0]; const displayName=patient?`${patient.prefix||''}${patient.firstName||''} ${patient.lastName||''}`.trim():'ผู้รับบริการ'; const bp=latest?.systolic!=null&&latest?.diastolic!=null?`${latest.systolic}/${latest.diastolic}`:'—';
 return <div className="app"><header className="topbar"><div className="brand"><div className="brand-mark"><HeartPulse size={22}/></div><div><b>VHV Patient Access</b><span>ข้อมูลสุขภาพของฉัน</span></div></div><button className="logout" onClick={logout}>ออกจากระบบ</button></header><main><section className="welcome"><div><p className="eyebrow">พื้นที่ส่วนตัว</p><h1>{view==='home'?'สุขภาพของฉัน':view==='health'?'ประวัติสุขภาพ':'ข้อมูลส่วนตัว'}</h1><p>{displayName}</p></div><div className="privacy"><ShieldCheck size={18}/>ข้อมูลของคุณเป็นส่วนตัว</div></section>
 {dataLoading&&<div className="secure-note">กำลังโหลดข้อมูลสุขภาพจากระบบ…</div>}{error&&authenticated&&<div className="error">{error}</div>}
 {view==='home'&&<><div className="cards"><Metric icon={<HeartPulse/>} label="ความดันล่าสุด" value={bp} unit="mmHg"/><Metric icon={<Activity/>} label="ชีพจร" value={latest?.pulse??'—'} unit="ครั้ง/นาที"/><Metric icon={<Activity/>} label="น้ำหนัก" value={latest?.weight??'—'} unit="กก."/><Metric icon={<Activity/>} label="น้ำตาล" value={latest?.bloodSugar??'—'} unit="mg/dL"/></div><div className="grid-2"><Panel title="การตรวจสุขภาพล่าสุด" icon={<CalendarDays/>}>{latest?<><div className="record-highlight"><div><span>วันที่ตรวจ</span><strong>{latest.date}</strong></div><div className="status">บันทึกแล้ว</div></div><Row label="ความดันโลหิต" value={`${bp} mmHg`}/><Row label="ชีพจร" value={`${latest.pulse??'—'} ครั้ง/นาที`}/><Row label="น้ำหนัก" value={`${latest.weight??'—'} กก.`}/><button className="link-btn" onClick={()=>setView('health')}>ดูประวัติทั้งหมด <ChevronRight size={17}/></button></>:<div className="empty">ยังไม่มีประวัติการตรวจสุขภาพ</div>}</Panel><Panel title="ข้อมูลส่วนตัว" icon={<UserRound/>}><Row label="ชื่อ-นามสกุล" value={displayName}/><Row label="วันเกิด" value={patient?.birthDate||'—'}/><Row label="สิทธิการรักษา" value={patient?.healthRight||'—'}/><button className="link-btn" onClick={()=>setView('profile')}>ดูข้อมูลส่วนตัว <ChevronRight size={17}/></button></Panel></div></>}
 {view==='health'&&<Panel title="ประวัติการตรวจสุขภาพ" icon={<Activity/>}>{records.length?<div className="table-wrap"><table><thead><tr><th>วันที่</th><th>ความดัน</th><th>ชีพจร</th><th>น้ำหนัก</th><th>น้ำตาล</th></tr></thead><tbody>{records.map(r=><tr key={r.id}><td>{r.date}</td><td>{r.systolic!=null&&r.diastolic!=null?`${r.systolic}/${r.diastolic}`:'—'}</td><td>{r.pulse??'—'}</td><td>{r.weight??'—'}</td><td>{r.bloodSugar??'—'}</td></tr>)}</tbody></table></div>:<div className="empty">ยังไม่มีประวัติการตรวจสุขภาพ</div>}</Panel>}
 {view==='profile'&&<Panel title="ข้อมูลส่วนตัว" icon={<UserRound/>}><div className="profile-grid"><Info label="ชื่อ-นามสกุล" value={displayName}/><Info label="วันเกิด" value={patient?.birthDate||'—'}/><Info label="เบอร์โทรศัพท์" value={patient?.phone||'—'}/><Info label="เลขประจำตัว" value={patient?.idCard||'—'}/><Info label="เพศ" value={patient?.gender||'—'}/><Info label="สิทธิการรักษา" value={patient?.healthRight||'—'}/></div><div className="notice"><ShieldCheck size={19}/>ข้อมูลระบุตัวตนบางส่วนถูกซ่อนเพื่อความเป็นส่วนตัว</div></Panel>}</main><nav className="bottom-nav"><button className={view==='home'?'active':''} onClick={()=>setView('home')}><HeartPulse/>หน้าหลัก</button><button className={view==='health'?'active':''} onClick={()=>setView('health')}><Activity/>ประวัติสุขภาพ</button><button className={view==='profile'?'active':''} onClick={()=>setView('profile')}><UserRound/>ฉัน</button></nav></div>;
}
function Metric({icon,label,value,unit}:{icon:ReactNode;label:string;value:string|number;unit:string}){return <div className="metric"><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{unit}</small></div>}
function Panel({title,icon,children}:{title:string;icon:ReactNode;children:ReactNode}){return <section className="panel"><div className="panel-head"><div className="panel-title">{icon}<h2>{title}</h2></div></div>{children}</section>}
function Row({label,value}:{label:string;value:string}){return <div className="record-row"><span>{label}</span><b>{value}</b></div>}
function Info({label,value}:{label:string;value:string}){return <div className="info"><span>{label}</span><b>{value}</b></div>}
