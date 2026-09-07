import React, { useState, useEffect } from 'react';
import { 
  HeartHandshake, 
  LayoutDashboard, 
  Users, 
  Home, 
  Stethoscope, 
  BarChart3, 
  FileSpreadsheet, 
  Settings, 
  LogOut, 
  ChevronDown, 
  ChevronRight,
  Send,
  Inbox,
  UserCheck,
  TrendingUp,
  User
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ActiveTab } from '../types';

interface SidebarProps {
  onOpenAuth?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = () => {
  const { 
    activeTab, 
    setActiveTab, 
    analyticsViewMode,
    setAnalyticsViewMode,
    inboxActiveTab,
    setInboxActiveTab,
    user, 
    logout, 
    vhvProfile,
    unreadReceivedCount
  } = useApp();

  // Collapsible sections state
  const [citizensOpen, setCitizensOpen] = useState(true);
  const [analyticsOpen, setAnalyticsOpen] = useState(true);
  const [reportsOpen, setReportsOpen] = useState(true);

  // Auto-expand group if active tab belongs to it
  useEffect(() => {
    if (activeTab === 'citizens' || activeTab === 'households') {
      setCitizensOpen(true);
    } else if (activeTab === 'analytics') {
      setAnalyticsOpen(true);
    } else if (activeTab === 'inbox') {
      setReportsOpen(true);
    }
  }, [activeTab]);

  return (
    <aside 
      id="sidebar-navigation"
      aria-label="เมนูนำทางหลัก"
      className="hidden lg:flex flex-col w-64 xl:w-72 bg-[#FEFEFA] border-r border-[#DED8CF] h-screen sticky top-0 shrink-0 select-none z-30 transition-all duration-300"
    >
      {/* Brand Header */}
      <div className="p-5 border-b border-[#DED8CF]/80 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-[#5D7052] flex items-center justify-center text-[#FDFCF8] shadow-[0_2px_8px_rgba(93,112,82,0.25)] shrink-0">
          <HeartHandshake className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-heading font-bold text-base text-[#2C2C24] leading-tight truncate">
            VHV Smart Health
          </h1>
          <p className="text-[11px] font-medium text-[#78786C] leading-none mt-1 truncate">
            Smart Health Community
          </p>
        </div>
      </div>

      {/* Navigation Links (Scrollable if viewport is short) */}
      <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-1.5 custom-scrollbar text-xs">
        
        {/* 1. หน้าหลัก (Dashboard) */}
        <button
          type="button"
          id="nav-dashboard"
          onClick={() => setActiveTab('dashboard')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all ${
            activeTab === 'dashboard'
              ? 'bg-[#5D7052] text-[#FDFCF8] font-semibold shadow-xs'
              : 'text-[#4A4A40] hover:bg-[#F0EBE5]/70 hover:text-[#2C2C24]'
          }`}
        >
          <LayoutDashboard className={`w-4 h-4 shrink-0 ${activeTab === 'dashboard' ? 'text-[#FDFCF8]' : 'text-[#5D7052]'}`} />
          <span className="text-sm">หน้าหลัก</span>
        </button>

        {/* 2. ประชาชน Group */}
        <div className="space-y-0.5 pt-1">
          <button
            type="button"
            id="nav-group-citizens"
            onClick={() => setCitizensOpen(!citizensOpen)}
            className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'citizens' || activeTab === 'households'
                ? 'text-[#2C2C24]'
                : 'text-[#78786C] hover:text-[#2C2C24] hover:bg-[#F0EBE5]/40'
            }`}
          >
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-[#5D7052] shrink-0" />
              <span className="text-sm">ประชาชน</span>
            </div>
            {citizensOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-[#78786C]" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[#78786C]" />
            )}
          </button>

          {citizensOpen && (
            <div className="pl-7 pr-1 space-y-1 border-l-2 border-[#DED8CF]/50 ml-5 py-0.5">
              <button
                type="button"
                id="nav-citizens-list"
                onClick={() => setActiveTab('citizens')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'citizens'
                    ? 'bg-[#5D7052]/10 text-[#5D7052] font-semibold'
                    : 'text-[#5A5A50] hover:bg-[#F0EBE5]/60 hover:text-[#2C2C24]'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                <span>ทะเบียนประชาชน</span>
              </button>

              <button
                type="button"
                id="nav-households"
                onClick={() => setActiveTab('households')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'households'
                    ? 'bg-[#5D7052]/10 text-[#5D7052] font-semibold'
                    : 'text-[#5A5A50] hover:bg-[#F0EBE5]/60 hover:text-[#2C2C24]'
                }`}
              >
                <Home className="w-3.5 h-3.5 shrink-0" />
                <span>หลังคาเรือน</span>
              </button>
            </div>
          )}
        </div>

        {/* 3. การตรวจสุขภาพ */}
        <div className="pt-1">
          <button
            type="button"
            id="nav-checkup"
            onClick={() => setActiveTab('checkup')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all ${
              activeTab === 'checkup'
                ? 'bg-[#5D7052] text-[#FDFCF8] font-semibold shadow-xs'
                : 'text-[#4A4A40] hover:bg-[#F0EBE5]/70 hover:text-[#2C2C24]'
            }`}
          >
            <Stethoscope className={`w-4 h-4 shrink-0 ${activeTab === 'checkup' ? 'text-[#FDFCF8]' : 'text-[#5D7052]'}`} />
            <span className="text-sm">การตรวจสุขภาพ</span>
          </button>
        </div>

        {/* 4. สถิติ Group */}
        <div className="space-y-0.5 pt-1">
          <button
            type="button"
            id="nav-group-analytics"
            onClick={() => setAnalyticsOpen(!analyticsOpen)}
            className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'analytics'
                ? 'text-[#2C2C24]'
                : 'text-[#78786C] hover:text-[#2C2C24] hover:bg-[#F0EBE5]/40'
            }`}
          >
            <div className="flex items-center gap-3">
              <BarChart3 className="w-4 h-4 text-[#5D7052] shrink-0" />
              <span className="text-sm">สถิติ</span>
            </div>
            {analyticsOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-[#78786C]" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[#78786C]" />
            )}
          </button>

          {analyticsOpen && (
            <div className="pl-7 pr-1 space-y-1 border-l-2 border-[#DED8CF]/50 ml-5 py-0.5">
              <button
                type="button"
                id="nav-analytics-overview"
                onClick={() => {
                  setAnalyticsViewMode('overview');
                  setActiveTab('analytics');
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'analytics' && analyticsViewMode === 'overview'
                    ? 'bg-[#5D7052]/10 text-[#5D7052] font-semibold'
                    : 'text-[#5A5A50] hover:bg-[#F0EBE5]/60 hover:text-[#2C2C24]'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                <span>ภาพรวม</span>
              </button>

              <button
                type="button"
                id="nav-analytics-individual"
                onClick={() => {
                  setAnalyticsViewMode('individual');
                  setActiveTab('analytics');
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'analytics' && analyticsViewMode === 'individual'
                    ? 'bg-[#5D7052]/10 text-[#5D7052] font-semibold'
                    : 'text-[#5A5A50] hover:bg-[#F0EBE5]/60 hover:text-[#2C2C24]'
                }`}
              >
                <User className="w-3.5 h-3.5 shrink-0" />
                <span>รายคน</span>
              </button>
            </div>
          )}
        </div>

        {/* 5. รายงาน Group */}
        <div className="space-y-0.5 pt-1">
          <button
            type="button"
            id="nav-group-reports"
            onClick={() => setReportsOpen(!reportsOpen)}
            className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'inbox'
                ? 'text-[#2C2C24]'
                : 'text-[#78786C] hover:text-[#2C2C24] hover:bg-[#F0EBE5]/40'
            }`}
          >
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-4 h-4 text-[#5D7052] shrink-0" />
              <span className="text-sm">รายงาน</span>
            </div>
            <div className="flex items-center gap-1.5">
              {Boolean(unreadReceivedCount && unreadReceivedCount > 0) && (
                <span className="px-1.5 py-0.2 text-[10px] font-bold bg-[#A85448] text-white rounded-full leading-tight">
                  {unreadReceivedCount}
                </span>
              )}
              {reportsOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#78786C]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[#78786C]" />
              )}
            </div>
          </button>

          {reportsOpen && (
            <div className="pl-7 pr-1 space-y-1 border-l-2 border-[#DED8CF]/50 ml-5 py-0.5">
              <button
                type="button"
                id="nav-reports-manage"
                onClick={() => {
                  setInboxActiveTab('manage');
                  setActiveTab('inbox');
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'inbox' && inboxActiveTab === 'manage'
                    ? 'bg-[#5D7052]/10 text-[#5D7052] font-semibold'
                    : 'text-[#5A5A50] hover:bg-[#F0EBE5]/60 hover:text-[#2C2C24]'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                <span>รายงานทั้งหมด</span>
              </button>

              <button
                type="button"
                id="nav-reports-send"
                onClick={() => {
                  setInboxActiveTab('send');
                  setActiveTab('inbox');
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'inbox' && inboxActiveTab === 'send'
                    ? 'bg-[#5D7052]/10 text-[#5D7052] font-semibold'
                    : 'text-[#5A5A50] hover:bg-[#F0EBE5]/60 hover:text-[#2C2C24]'
                }`}
              >
                <Send className="w-3.5 h-3.5 shrink-0" />
                <span>ส่งรายงาน</span>
              </button>

              <button
                type="button"
                id="nav-reports-receive"
                onClick={() => {
                  setInboxActiveTab('receive');
                  setActiveTab('inbox');
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'inbox' && inboxActiveTab === 'receive'
                    ? 'bg-[#5D7052]/10 text-[#5D7052] font-semibold'
                    : 'text-[#5A5A50] hover:bg-[#F0EBE5]/60 hover:text-[#2C2C24]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Inbox className="w-3.5 h-3.5 shrink-0" />
                  <span>รับรายงาน</span>
                </div>
                {Boolean(unreadReceivedCount && unreadReceivedCount > 0) && (
                  <span className="px-1.5 py-0.2 text-[10px] font-bold bg-[#A85448] text-white rounded-full leading-tight">
                    {unreadReceivedCount}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

      </nav>

      {/* Footer Section: Settings & User Account */}
      <div className="p-3.5 border-t border-[#DED8CF]/80 space-y-2 bg-[#FAF8F5]/80">
        
        {/* Settings button */}
        <button
          type="button"
          id="nav-settings"
          onClick={() => setActiveTab('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'settings'
              ? 'bg-[#5D7052] text-[#FDFCF8] font-semibold shadow-xs'
              : 'text-[#4A4A40] hover:bg-[#F0EBE5] hover:text-[#2C2C24]'
          }`}
        >
          <Settings className={`w-4 h-4 shrink-0 ${activeTab === 'settings' ? 'text-[#FDFCF8]' : 'text-[#78786C]'}`} />
          <span className="text-sm">ตั้งค่า</span>
        </button>

        {/* Current User & Logout */}
        {user && (
          <div className="pt-2 border-t border-[#DED8CF]/60 flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-full bg-[#5D7052]/10 border border-[#5D7052]/20 flex items-center justify-center text-[#5D7052] shrink-0 font-bold text-xs">
                {user.avatar ? (
                  <img src={user.avatar} alt={vhvProfile.name || 'User'} className="w-full h-full rounded-full object-cover" />
                ) : (
                  (vhvProfile.name?.[0] || user.name?.[0] || 'อ').toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#2C2C24] truncate leading-tight">
                  {vhvProfile.name || user.name || 'ผู้ใช้งาน อสม.'}
                </p>
                <p className="text-[10px] text-[#78786C] truncate leading-none mt-0.5">
                  {vhvProfile.villageName ? `${vhvProfile.villageName} ${vhvProfile.moo}` : (user.phone || user.email || '')}
                </p>
              </div>
            </div>

            <button
              type="button"
              id="sidebar-btn-logout"
              onClick={logout}
              className="p-1.5 rounded-lg text-[#78786C] hover:text-[#A85448] hover:bg-[#A85448]/10 transition-colors shrink-0 cursor-pointer"
              title="ออกจากระบบ"
              aria-label="ออกจากระบบ"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </aside>
  );
};
