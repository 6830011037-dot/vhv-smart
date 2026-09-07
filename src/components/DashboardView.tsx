import React, { useMemo } from 'react';
import { 
  Users, 
  Stethoscope, 
  PlusCircle, 
  UserPlus, 
  ArrowUpRight, 
  ChevronRight, 
  FileSpreadsheet, 
  HeartHandshake,
  Activity,
  Clock,
  Send,
  Inbox,
  AlertCircle,
  RotateCw,
  Home,
  CheckCircle2,
  TrendingUp
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatThaiDate } from '../utils/healthCalculations';

export const DashboardView: React.FC = () => {
  const { 
    citizens, 
    records, 
    vhvProfile, 
    user,
    setActiveTab, 
    setAnalyticsViewMode,
    setInboxActiveTab,
    unreadReceivedCount,
    pendingSyncCount,
    triggerManualSync,
    isSyncing,
    setSelectedCitizenForProfile,
    setSelectedCitizenForCheckup
  } = useApp();

  // 1. Calculate Real Metrics
  const totalCitizens = citizens.length;
  
  // Real count of distinct households (houseNo + moo)
  const totalHouseholds = useMemo(() => {
    return Array.from(
      new Set(
        citizens
          .filter(c => c.houseNo)
          .map(c => `${c.houseNo}_${c.moo || ''}`)
      )
    ).length;
  }, [citizens]);

  // Real count of checkups conducted today (based on local ISO date)
  const todayScreeningsCount = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return records.filter(r => {
      if (!r.date) return false;
      return r.date.startsWith(todayStr);
    }).length;
  }, [records]);

  // Recent screenings list (sorted newest first)
  const recentScreenings = useMemo(() => {
    return [...records]
      .sort((a, b) => {
        const timeB = new Date(b.createdAt || b.date).getTime();
        const timeA = new Date(a.createdAt || a.date).getTime();
        return timeB - timeA;
      })
      .slice(0, 8);
  }, [records]);

  const handleStartCheckupForCitizen = (citizenId: string) => {
    const cit = citizens.find(c => c.id === citizenId);
    if (cit) {
      setSelectedCitizenForCheckup(cit);
      setActiveTab('checkup');
    }
  };

  const handleOpenCitizenProfile = (citizenId: string) => {
    const cit = citizens.find(c => c.id === citizenId);
    if (cit) {
      setSelectedCitizenForProfile(cit);
    }
  };

  // Check if there is actionable work requiring attention
  const hasActionableWork = unreadReceivedCount > 0 || pendingSyncCount > 0;

  return (
    <div className="space-y-6 sm:space-y-7 pb-16 w-full max-w-full">
      
      {/* 1. Top Section: Professional Greeting & Area Context */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#FEFEFA] via-[#FAF8F5] to-[#F0EBE5]/60 border border-[#DED8CF] rounded-3xl p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#5D7052]/10 border border-[#5D7052]/20 text-[#5D7052] text-xs font-semibold whitespace-nowrap">
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>{vhvProfile.healthCenterName || 'หน่วยบริการสุขภาพปฐมภูมิ'}</span>
            </div>
            
            <h1 className="font-heading font-bold text-2xl sm:text-3xl text-[#2C2C24] leading-tight">
              สวัสดี, {vhvProfile.name || user?.name || 'อสม.'}
            </h1>
            
            <p className="text-xs sm:text-sm text-[#78786C] leading-relaxed">
              ศูนย์ควบคุมการทำงานประจำวัน • ข้อมูลสุขภาพในพื้นที่รับผิดชอบ
              {vhvProfile.villageName ? (
                <span className="font-semibold text-[#2C2C24]"> ({vhvProfile.villageName} {vhvProfile.moo})</span>
              ) : null}
            </p>
          </div>

          {/* Quick Primary Actions in Banner */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              id="dashboard-btn-new-checkup"
              onClick={() => {
                setSelectedCitizenForCheckup(null);
                setActiveTab('checkup');
              }}
              className="flex items-center gap-2 bg-[#5D7052] hover:bg-[#48573F] text-[#FDFCF8] px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm shadow-soft hover:shadow-moss-glow transition-all active:scale-95 whitespace-nowrap cursor-pointer"
            >
              <Stethoscope className="w-4 h-4" />
              <span>ตรวจสุขภาพ</span>
            </button>

            <button
              type="button"
              id="dashboard-btn-add-citizen"
              onClick={() => setActiveTab('citizens')}
              className="flex items-center gap-2 bg-white hover:bg-[#F0EBE5] text-[#2C2C24] border border-[#DED8CF] px-4 py-2.5 rounded-full font-semibold text-xs sm:text-sm shadow-xs transition-all whitespace-nowrap cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-[#5D7052]" />
              <span>+ เพิ่มประชาชน</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Priority 2: งานที่ต้องดำเนินการ (Actionable Tasks or "ไม่มีงานที่ต้องดำเนินการ 🎉") */}
      <section 
        id="section-work-attention"
        aria-label="งานที่ต้องดำเนินการ"
        className="space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#5D7052]" />
            <h3 className="font-heading font-bold text-sm sm:text-base text-[#2C2C24]">
              งานที่ต้องดำเนินการ
            </h3>
          </div>
          <span className="text-[11px] text-[#78786C]">
            {hasActionableWork ? 'มีรายการที่ต้องจัดการ' : 'สถานะปกติ'}
          </span>
        </div>

        {hasActionableWork ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Unread reports item */}
            {unreadReceivedCount > 0 && (
              <div className="bg-[#FEFEFA] border border-[#A85448]/30 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#A85448]/10 text-[#A85448] flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-[#2C2C24] truncate">มีรายงานใหม่</p>
                    <p className="text-[11px] text-[#78786C] truncate">
                      มีรายงานสุขภาพใหม่ {unreadReceivedCount} ฉบับรอตรวจสอบ
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInboxActiveTab('receive');
                    setActiveTab('inbox');
                  }}
                  className="px-3.5 py-2 bg-[#A85448] hover:bg-[#8e3f34] text-white text-xs font-bold rounded-xl shrink-0 transition-colors shadow-xs cursor-pointer"
                >
                  เปิดรายงาน
                </button>
              </div>
            )}

            {/* Pending Sync Items */}
            {pendingSyncCount > 0 && (
              <div className="bg-[#FEFEFA] border border-[#C18C5D]/30 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#C18C5D]/10 text-[#C18C5D] flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-[#2C2C24] truncate">มีข้อมูลรอซิงค์</p>
                    <p className="text-[11px] text-[#78786C] truncate">
                      มีข้อมูล {pendingSyncCount} รายการรอส่งขึ้นระบบคลาวด์
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => triggerManualSync()}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#C18C5D] hover:bg-[#a67448] disabled:opacity-50 text-white text-xs font-bold rounded-xl shrink-0 transition-colors shadow-xs cursor-pointer"
                >
                  {isSyncing ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>ซิงค์ทันที</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-[#5D7052]/8 border border-[#5D7052]/20 rounded-2xl flex items-center gap-3 text-xs sm:text-sm text-[#4A4A40]">
            <div className="w-8 h-8 rounded-full bg-[#5D7052]/20 text-[#5D7052] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-[#5D7052]" />
            </div>
            <div>
              <p className="font-bold text-[#2C2C24]">ไม่มีงานที่ต้องดำเนินการ 🎉</p>
              <p className="text-[11px] text-[#78786C]">
                ข้อมูลทั้งหมดถูกซิงค์ตรงกับระบบคลาวด์ และไม่มีรายงานใหม่ที่ค้างอยู่
              </p>
            </div>
          </div>
        )}
      </section>

      {/* 3. Priority 3: Key Operational Metrics (4 Real Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
        
        {/* Card 1: ประชาชนในการดูแล */}
        <div 
          id="metric-citizens"
          onClick={() => setActiveTab('citizens')}
          className="group cursor-pointer bg-[#FEFEFA] hover:bg-white border border-[#DED8CF] rounded-2xl p-4 sm:p-5 shadow-xs hover:border-[#5D7052]/50 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#78786C] truncate">
              ประชาชนในการดูแล
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#5D7052]/10 text-[#5D7052] flex items-center justify-center transition-colors group-hover:bg-[#5D7052] group-hover:text-white shrink-0">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="font-heading text-2xl sm:text-3xl font-bold text-[#2C2C24]">
              {totalCitizens}
            </span>
            <span className="text-xs text-[#78786C]">คน</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-[#5D7052] font-medium pt-2 border-t border-[#DED8CF]/40">
            <span className="truncate">ทะเบียนประวัติ</span>
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
          </div>
        </div>

        {/* Card 2: การตรวจวันนี้ */}
        <div 
          id="metric-checkup-today"
          onClick={() => setActiveTab('checkup')}
          className="group cursor-pointer bg-[#FEFEFA] hover:bg-white border border-[#DED8CF] rounded-2xl p-4 sm:p-5 shadow-xs hover:border-[#C18C5D]/50 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#78786C] truncate">
              การตรวจวันนี้
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#C18C5D]/10 text-[#C18C5D] flex items-center justify-center transition-colors group-hover:bg-[#C18C5D] group-hover:text-white shrink-0">
              <Stethoscope className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="font-heading text-2xl sm:text-3xl font-bold text-[#2C2C24]">
              {todayScreeningsCount}
            </span>
            <span className="text-xs text-[#78786C]">ครั้ง ({records.length} ทั้งหมด)</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-[#C18C5D] font-medium pt-2 border-t border-[#DED8CF]/40">
            <span className="truncate">ตรวจสุขภาพ</span>
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
          </div>
        </div>

        {/* Card 3: หลังคาเรือน */}
        <div 
          id="metric-households"
          onClick={() => setActiveTab('households')}
          className="group cursor-pointer bg-[#FEFEFA] hover:bg-white border border-[#DED8CF] rounded-2xl p-4 sm:p-5 shadow-xs hover:border-[#5D7052]/50 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#78786C] truncate">
              หลังคาเรือน
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#5D7052]/10 text-[#5D7052] flex items-center justify-center transition-colors group-hover:bg-[#5D7052] group-hover:text-white shrink-0">
              <Home className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="font-heading text-2xl sm:text-3xl font-bold text-[#2C2C24]">
              {totalHouseholds}
            </span>
            <span className="text-xs text-[#78786C]">หลังคาเรือน</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-[#5D7052] font-medium pt-2 border-t border-[#DED8CF]/40">
            <span className="truncate">แผนผังบ้าน</span>
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
          </div>
        </div>

        {/* Card 4: รายงาน / งานที่ต้องจัดการ */}
        <div 
          id="metric-reports-status"
          onClick={() => {
            setInboxActiveTab('receive');
            setActiveTab('inbox');
          }}
          className="group cursor-pointer bg-[#FEFEFA] hover:bg-white border border-[#DED8CF] rounded-2xl p-4 sm:p-5 shadow-xs hover:border-[#A85448]/50 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#78786C] truncate">
              รายงานและแจ้งเตือน
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#A85448]/10 text-[#A85448] flex items-center justify-center transition-colors group-hover:bg-[#A85448] group-hover:text-white shrink-0">
              <Inbox className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="font-heading text-2xl sm:text-3xl font-bold text-[#2C2C24]">
              {unreadReceivedCount}
            </span>
            <span className="text-xs text-[#78786C]">รายการใหม่</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-[#A85448] font-medium pt-2 border-t border-[#DED8CF]/40">
            <span className="truncate">กล่องรายงาน</span>
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
          </div>
        </div>

      </div>

      {/* 4. Priority 4: Quick Actions ("การทำงานด่วน") Bar - Highlighted Buttons */}
      <section 
        id="section-quick-actions"
        aria-label="การทำงานด่วน"
        className="bg-[#FEFEFA] border border-[#DED8CF] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#5D7052]" />
            <h3 className="font-heading font-bold text-sm sm:text-base text-[#2C2C24]">
              การทำงานด่วน (Quick Actions)
            </h3>
          </div>
          <span className="text-[11px] text-[#78786C]">ฟังก์ชันหลัก 4 ประการ</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          
          {/* Action 1: ตรวจสุขภาพ (Most Prominent) */}
          <button
            type="button"
            id="quick-action-checkup"
            onClick={() => {
              setSelectedCitizenForCheckup(null);
              setActiveTab('checkup');
            }}
            className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-[#5D7052] hover:bg-[#48573F] text-white shadow-soft transition-all text-left group cursor-pointer active:scale-98"
          >
            <div className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold leading-tight truncate">ตรวจสุขภาพ</p>
              <p className="text-[10px] text-white/80 truncate">บันทึกค่าวัดร่างกาย</p>
            </div>
          </button>

          {/* Action 2: + เพิ่มประชาชน (Prominent) */}
          <button
            type="button"
            id="quick-action-add-citizen"
            onClick={() => setActiveTab('citizens')}
            className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-[#FEFEFA] hover:bg-[#F0EBE5] border-2 border-[#5D7052]/40 text-[#2C2C24] transition-all text-left group cursor-pointer active:scale-98"
          >
            <div className="w-9 h-9 rounded-xl bg-[#5D7052]/10 text-[#5D7052] flex items-center justify-center shrink-0 group-hover:bg-[#5D7052] group-hover:text-white transition-colors">
              <UserPlus className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold text-[#2C2C24] leading-tight truncate">+ เพิ่มประชาชน</p>
              <p className="text-[10px] text-[#78786C] truncate">ลงทะเบียนใหม่</p>
            </div>
          </button>

          {/* Action 3: ส่งรายงาน */}
          <button
            type="button"
            id="quick-action-send-report"
            onClick={() => {
              setInboxActiveTab('send');
              setActiveTab('inbox');
            }}
            className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-[#FAF8F5] hover:bg-[#F0EBE5] border border-[#DED8CF] text-[#2C2C24] transition-all text-left group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-[#C18C5D]/10 text-[#C18C5D] flex items-center justify-center shrink-0 group-hover:bg-[#C18C5D] group-hover:text-white transition-colors">
              <Send className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold text-[#2C2C24] leading-tight truncate">ส่งรายงาน</p>
              <p className="text-[10px] text-[#78786C] truncate">แชร์ข้อมูลสุขภาพ</p>
            </div>
          </button>

          {/* Action 4: ดูสถิติ */}
          <button
            type="button"
            id="quick-action-analytics"
            onClick={() => {
              setAnalyticsViewMode('overview');
              setActiveTab('analytics');
            }}
            className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-[#FAF8F5] hover:bg-[#F0EBE5] border border-[#DED8CF] text-[#2C2C24] transition-all text-left group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-[#5D7052]/10 text-[#5D7052] flex items-center justify-center shrink-0 group-hover:bg-[#5D7052] group-hover:text-white transition-colors">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold text-[#2C2C24] leading-tight truncate">ดูสถิติ</p>
              <p className="text-[10px] text-[#78786C] truncate">ภาพรวมและแนวโน้ม</p>
            </div>
          </button>

        </div>
      </section>

      {/* 5. Recent Health Activity ("การตรวจสุขภาพล่าสุด") */}
      <section 
        id="section-recent-activity"
        aria-label="การตรวจสุขภาพล่าสุด"
        className="bg-[#FEFEFA] border border-[#DED8CF] rounded-2xl p-4 sm:p-6 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#5D7052]" />
            <h3 className="font-heading font-bold text-base text-[#2C2C24]">
              การตรวจสุขภาพล่าสุด
            </h3>
          </div>
          {recentScreenings.length > 0 && (
            <button
              type="button"
              id="btn-view-all-records"
              onClick={() => {
                setAnalyticsViewMode('overview');
                setActiveTab('analytics');
              }}
              className="text-xs font-semibold text-[#5D7052] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>ดูทั้งหมด ({records.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Empty State vs Recent Records */}
        {recentScreenings.length === 0 ? (
          <div 
            id="dashboard-empty-records"
            className="text-center py-10 px-4 bg-[#FAF8F5] rounded-xl border border-dashed border-[#DED8CF] space-y-3"
          >
            <div className="w-12 h-12 rounded-full bg-[#5D7052]/10 text-[#5D7052] flex items-center justify-center mx-auto">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-heading font-bold text-sm text-[#2C2C24]">
                ยังไม่มีประวัติการตรวจสุขภาพ
              </h4>
              <p className="text-xs text-[#78786C] max-w-sm mx-auto mt-1 leading-relaxed">
                เริ่มต้นด้วยการเลือกประชาชนและบันทึกผลการตรวจครั้งแรก
              </p>
            </div>
            <button
              type="button"
              id="dashboard-empty-btn-checkup"
              onClick={() => {
                setSelectedCitizenForCheckup(null);
                setActiveTab('checkup');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#5D7052] hover:bg-[#48573F] text-white text-xs font-semibold rounded-full shadow-xs transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>🩺 บันทึกการตรวจ</span>
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[#78786C] font-medium border-b border-[#DED8CF]/60 pb-2">
                  <tr>
                    <th className="py-2.5 px-3">วันที่</th>
                    <th className="py-2.5 px-3">ชื่อ-นามสกุล</th>
                    <th className="py-2.5 px-3">บ้านเลขที่</th>
                    <th className="py-2.5 px-3">ความดันโลหิต</th>
                    <th className="py-2.5 px-3">น้ำตาล (DTX)</th>
                    <th className="py-2.5 px-3">ชีพจร</th>
                    <th className="py-2.5 px-3 text-right">การกระทำ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED8CF]/40 text-[#4A4A40]">
                  {recentScreenings.map((rec) => {
                    const hasBP = (rec.systolic ?? 0) > 0 || (rec.diastolic ?? 0) > 0;
                    const hasDTX = (rec.bloodSugar ?? 0) > 0;

                    return (
                      <tr key={rec.id} className="hover:bg-[#FAF8F5] transition-colors">
                        <td className="py-3 px-3 whitespace-nowrap text-[#78786C]">
                          {formatThaiDate(rec.date, false)}
                        </td>
                        <td className="py-3 px-3 font-semibold text-[#2C2C24] whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenCitizenProfile(rec.citizenId)}
                            className="hover:text-[#5D7052] hover:underline text-left cursor-pointer"
                          >
                            {rec.citizenName}
                          </button>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-[#78786C]">
                          {rec.houseNo ? `${rec.houseNo} ${rec.moo || ''}` : '-'}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {hasBP ? (
                            <span className="font-bold text-[#2C2C24]">
                              {rec.systolic || '-'}/{rec.diastolic || '-'} <span className="text-[10px] font-normal text-[#78786C]">mmHg</span>
                            </span>
                          ) : (
                            <span className="text-[#78786C]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {hasDTX ? (
                            <span className="font-semibold text-[#2C2C24]">
                              {rec.bloodSugar} <span className="text-[10px] font-normal text-[#78786C]">mg/dL</span>
                              {rec.isFasting ? ' (อดอาหาร)' : ''}
                            </span>
                          ) : (
                            <span className="text-[#78786C]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[#5D7052] font-semibold whitespace-nowrap">
                          {rec.pulse ? `${rec.pulse} bpm` : '-'}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenCitizenProfile(rec.citizenId)}
                              className="px-2.5 py-1 text-[11px] font-medium text-[#78786C] hover:text-[#2C2C24] hover:bg-[#F0EBE5] rounded-lg transition-colors cursor-pointer"
                            >
                              ประวัติ
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartCheckupForCitizen(rec.citizenId)}
                              className="p-1.5 text-[#5D7052] hover:bg-[#5D7052]/10 rounded-lg transition-colors cursor-pointer"
                              title="บันทึกตรวจซ้ำ"
                            >
                              <Stethoscope className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card-Based List (< md) */}
            <div className="md:hidden space-y-2.5">
              {recentScreenings.map((rec) => {
                const hasBP = (rec.systolic ?? 0) > 0 || (rec.diastolic ?? 0) > 0;
                const hasDTX = (rec.bloodSugar ?? 0) > 0;

                return (
                  <div 
                    key={rec.id}
                    className="p-3.5 bg-[#FAF8F5] border border-[#DED8CF]/70 rounded-xl space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenCitizenProfile(rec.citizenId)}
                        className="font-bold text-[#2C2C24] text-left hover:text-[#5D7052] truncate"
                      >
                        {rec.citizenName}
                      </button>
                      <span className="text-[11px] text-[#78786C] shrink-0">
                        {formatThaiDate(rec.date, false)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[#4A4A40]">
                      {hasBP && (
                        <span>
                          ความดัน: <strong className="text-[#2C2C24]">{rec.systolic || '-'}/{rec.diastolic || '-'}</strong>
                        </span>
                      )}
                      {hasDTX && (
                        <span>
                          DTX: <strong className="text-[#2C2C24]">{rec.bloodSugar}</strong>
                        </span>
                      )}
                      {rec.pulse && (
                        <span>
                          ชีพจร: <strong className="text-[#5D7052]">{rec.pulse} bpm</strong>
                        </span>
                      )}
                    </div>

                    <div className="pt-2 border-t border-[#DED8CF]/50 flex items-center justify-between text-[11px]">
                      <span className="text-[#78786C]">
                        {rec.houseNo ? `บ้านเลขที่ ${rec.houseNo} ${rec.moo || ''}` : ''}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenCitizenProfile(rec.citizenId)}
                          className="px-2 py-1 text-[#78786C] hover:text-[#2C2C24] hover:bg-[#F0EBE5] rounded-md transition-colors"
                        >
                          ดูประวัติ
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartCheckupForCitizen(rec.citizenId)}
                          className="flex items-center gap-1 px-2 py-1 bg-[#5D7052]/10 text-[#5D7052] font-semibold rounded-md hover:bg-[#5D7052] hover:text-white transition-colors"
                        >
                          <Stethoscope className="w-3 h-3" />
                          <span>ตรวจซ้ำ</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

    </div>
  );
};
