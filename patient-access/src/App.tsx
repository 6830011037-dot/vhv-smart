import { useMemo, useState } from 'react';
import { Activity, CalendarDays, ChevronRight, HeartPulse, LogOut, Menu, ShieldCheck, UserRound, X } from 'lucide-react';

type View = 'home' | 'health' | 'profile';

const mockRecords = [
  { date: '7 ก.ย. 2569', bp: '118/76', pulse: 72, weight: 64.2, glucose: 96 },
  { date: '12 มิ.ย. 2569', bp: '121/79', pulse: 75, weight: 65.1, glucose: 101 },
  { date: '15 มี.ค. 2569', bp: '124/81', pulse: 78, weight: 65.8, glucose: 98 },
];

function App() {
  const [view, setView] = useState<View>('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const latest = mockRecords[0];
  const title = useMemo(() => ({ home: 'สุขภาพของฉัน', health: 'ประวัติสุขภาพ', profile: 'ข้อมูลส่วนตัว' }[view]), [view]);

  return <div className="app">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><HeartPulse size={22}/></div><div><b>VHV Patient Access</b><span>พื้นที่ข้อมูลสุขภาพของคุณ</span></div></div>
      <button className="icon-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="เมนู">{menuOpen ? <X/> : <Menu/>}</button>
    </header>
    {menuOpen && <div className="mobile-menu"><button onClick={() => {setView('home');setMenuOpen(false)}}>หน้าหลัก</button><button onClick={() => {setView('health');setMenuOpen(false)}}>ประวัติสุขภาพ</button><button onClick={() => {setView('profile');setMenuOpen(false)}}>ข้อมูลส่วนตัว</button><button className="danger"><LogOut size={17}/>ออกจากระบบ</button></div>}

    <main>
      <section className="welcome"><div><p className="eyebrow">สวัสดี 👋</p><h1>{title}</h1><p>ดูข้อมูลสุขภาพของคุณได้ในที่เดียว</p></div><div className="privacy"><ShieldCheck size={18}/><span>ข้อมูลของคุณเป็นส่วนตัว</span></div></section>

      {view === 'home' && <>
        <div className="cards">
          <Metric icon={<HeartPulse/>} label="ความดันล่าสุด" value={latest.bp} unit="mmHg" />
          <Metric icon={<Activity/>} label="ชีพจร" value={latest.pulse} unit="ครั้ง/นาที" />
          <Metric icon={<Activity/>} label="น้ำหนัก" value={latest.weight} unit="กก." />
          <Metric icon={<Activity/>} label="น้ำตาล" value={latest.glucose} unit="mg/dL" />
        </div>
        <div className="grid-2">
          <Panel title="การตรวจสุขภาพล่าสุด" icon={<CalendarDays/>}>
            <div className="record-highlight"><div><span>วันที่ตรวจ</span><strong>{latest.date}</strong></div><div className="status">บันทึกแล้ว</div></div>
            <div className="record-row"><span>ความดันโลหิต</span><b>{latest.bp} mmHg</b></div><div className="record-row"><span>ชีพจร</span><b>{latest.pulse} ครั้ง/นาที</b></div><div className="record-row"><span>น้ำหนัก</span><b>{latest.weight} กก.</b></div>
            <button className="link-btn" onClick={() => setView('health')}>ดูประวัติทั้งหมด <ChevronRight size={17}/></button>
          </Panel>
          <Panel title="ข้อมูลส่วนตัว" icon={<UserRound/>}>
            <div className="profile-row"><span>ชื่อ-นามสกุล</span><b>ผู้รับบริการ</b></div><div className="profile-row"><span>วันเกิด</span><b>•• / •• / ••••</b></div><div className="profile-row"><span>สถานะ</span><b>ผู้รับบริการ</b></div>
            <button className="link-btn" onClick={() => setView('profile')}>ดูข้อมูลส่วนตัว <ChevronRight size={17}/></button>
          </Panel>
        </div>
      </>}

      {view === 'health' && <Panel title="ประวัติการตรวจสุขภาพ" icon={<Activity/>}><div className="table-wrap"><table><thead><tr><th>วันที่</th><th>ความดัน</th><th>ชีพจร</th><th>น้ำหนัก</th><th>น้ำตาล</th></tr></thead><tbody>{mockRecords.map(r=><tr key={r.date}><td>{r.date}</td><td>{r.bp}</td><td>{r.pulse}</td><td>{r.weight}</td><td>{r.glucose}</td></tr>)}</tbody></table></div></Panel>}
      {view === 'profile' && <Panel title="ข้อมูลส่วนตัว" icon={<UserRound/>}><div className="profile-grid"><Info label="ชื่อ-นามสกุล" value="ผู้รับบริการ"/><Info label="วันเกิด" value="ไม่แสดงในตัวอย่าง"/><Info label="เบอร์โทรศัพท์" value="••••••••••"/><Info label="เลขประจำตัว" value="•••••••••••••"/></div><div className="notice"><ShieldCheck size={19}/><span>ข้อมูลระบุตัวตนบางส่วนถูกซ่อนเพื่อความเป็นส่วนตัว</span></div></Panel>}
    </main>
    <nav className="bottom-nav"><button className={view==='home'?'active':''} onClick={()=>setView('home')}><HeartPulse/>หน้าหลัก</button><button className={view==='health'?'active':''} onClick={()=>setView('health')}><Activity/>ประวัติสุขภาพ</button><button className={view==='profile'?'active':''} onClick={()=>setView('profile')}><UserRound/>ฉัน</button></nav>
  </div>
}

function Metric({icon,label,value,unit}:{icon:React.ReactNode;label:string;value:string|number;unit:string}){return <div className="metric"><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{unit}</small></div>}
function Panel({title,icon,children}:{title:string;icon:React.ReactNode;children:React.ReactNode}){return <section className="panel"><div className="panel-head"><div className="panel-title">{icon}<h2>{title}</h2></div></div>{children}</section>}
function Info({label,value}:{label:string;value:string}){return <div className="info"><span>{label}</span><b>{value}</b></div>}

export default App;
