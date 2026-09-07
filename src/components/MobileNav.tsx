import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Stethoscope, 
  BarChart3, 
  Menu, 
  Home, 
  FileSpreadsheet, 
  Send, 
  Inbox, 
  Settings, 
  LogOut, 
  X, 
  TrendingUp,
  User,
  HeartHandshake
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ActiveTab } from '../types';

interface MobileNavProps {
  moreDrawerOpen: boolean;
  setMoreDrawerOpen: (open: boolean) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ moreDrawerOpen, setMoreDrawerOpen }) => {
  const { 
    activeTab, 
    setActiveTab, 
    analyticsViewMode,
    setAnalyticsViewMode,
    inboxActiveTab,
    setInboxActiveTab,
    unreadReceivedCount,
    logout,
    user,
    vhvProfile,
    setSelectedCitizenForCheckup
  } = useApp();

  const handleNav = (tab: ActiveTab, sub?: string) => {
    setActiveTab(tab);
    if (tab === 'analytics' && (sub === 'overview' || sub === 'individual')) {
      setAnalyticsViewMode(sub);
    }
    if (tab === 'inbox' && (sub === 'manage' || sub === 'send' || sub === 'receive')) {
      setInboxActiveTab(sub);
    }
    setMoreDrawerOpen(false);
  };

  const isMoreActive = activeTab === 'households' || activeTab === 'inbox' || activeTab === 'settings';

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav 
        id="mobile-bottom-nav"
        aria-label="เมนูนำทางด้านล่าง"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FEFEFA]/95 backdrop-blur-md border-t border-[#DED8CF] px-2 py-1.5 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] select-none safe-area-pb"
      >
        <div className="flex items-center justify-around max-w-lg mx-auto">
          
          {/* 1. หน้าหลัก */}
          <button
            type="button"
            id="mobile-nav-dashboard"
            onClick={() => handleNav('dashboard')}
            className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] py-1 px-2 rounded-xl transition-all ${
              activeTab === 'dashboard'
                ? 'text-[#5D7052] font-bold'
                : 'text-[#78786C] hover:text-[#2C2C24]'
            }`}
          >
            <LayoutDashboard className={`w-5 h-5 ${activeTab === 'dashboard' ? 'text-[#5D7052] scale-105' : 'text-[#78786C]'}`} />
            <span className="text-[10px] mt-0.5 whitespace-nowrap">หน้าหลัก</span>
          </button>

          {/* 2. ประชาชน */}
          <button
            type="button"
            id="mobile-nav-citizens"
            onClick={() => handleNav('citizens')}
            className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] py-1 px-2 rounded-xl transition-all ${
              activeTab === 'citizens'
                ? 'text-[#5D7052] font-bold'
                : 'text-[#78786C] hover:text-[#2C2C24]'
            }`}
          >
            <Users className={`w-5 h-5 ${activeTab === 'citizens' ? 'text-[#5D7052] scale-105' : 'text-[#78786C]'}`} />
            <span className="text-[10px] mt-0.5 whitespace-nowrap">ประชาชน</span>
          </button>

          {/* 3. ตรวจสุขภาพ (Center prominent) */}
          <button
            type="button"
            id="mobile-nav-checkup"
            onClick={() => {
              setSelectedCitizenForCheckup(null);
              handleNav('checkup');
            }}
            className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] py-1 px-2 rounded-xl transition-all ${
              activeTab === 'checkup'
                ? 'text-[#5D7052] font-bold'
                : 'text-[#78786C] hover:text-[#2C2C24]'
            }`}
          >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center -mt-2 transition-all ${
              activeTab === 'checkup'
                ? 'bg-[#5D7052] text-white shadow-soft ring-2 ring-[#5D7052]/30'
                : 'bg-[#5D7052]/10 text-[#5D7052]'
            }`}>
              <Stethoscope className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 whitespace-nowrap">ตรวจ</span>
          </button>

          {/* 4. สถิติ */}
          <button
            type="button"
            id="mobile-nav-analytics"
            onClick={() => handleNav('analytics', 'overview')}
            className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] py-1 px-2 rounded-xl transition-all ${
              activeTab === 'analytics'
                ? 'text-[#5D7052] font-bold'
                : 'text-[#78786C] hover:text-[#2C2C24]'
            }`}
          >
            <BarChart3 className={`w-5 h-5 ${activeTab === 'analytics' ? 'text-[#5D7052] scale-105' : 'text-[#78786C]'}`} />
            <span className="text-[10px] mt-0.5 whitespace-nowrap">สถิติ</span>
          </button>

          {/* 5. เพิ่มเติม */}
          <button
            type="button"
            id="mobile-nav-more"
            onClick={() => setMoreDrawerOpen(true)}
            className={`relative flex flex-col items-center justify-center min-w-[54px] min-h-[44px] py-1 px-2 rounded-xl transition-all ${
              isMoreActive || moreDrawerOpen
                ? 'text-[#5D7052] font-bold'
                : 'text-[#78786C] hover:text-[#2C2C24]'
            }`}
          >
            <Menu className={`w-5 h-5 ${isMoreActive ? 'text-[#5D7052]' : 'text-[#78786C]'}`} />
            <span className="text-[10px] mt-0.5 whitespace-nowrap">เพิ่มเติม</span>
            {Boolean(unreadReceivedCount && unreadReceivedCount > 0) && (
              <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-[#A85448]" />
            )}
          </button>

        </div>
      </nav>

      {/* "เพิ่มเติม" Bottom Sheet Drawer */}
      {moreDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="w-full bg-[#FEFEFA] rounded-t-3xl border-t border-[#DED8CF] p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-250"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#DED8CF]/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#5D7052] flex items-center justify-center text-white">
                  <HeartHandshake className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-[#2C2C24]">เมนูเพิ่มเติม</h3>
                  <p className="text-[10px] text-[#78786C]">VHV Smart Health Community</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMoreDrawerOpen(false)}
                className="p-1.5 rounded-full text-[#78786C] hover:bg-[#F0EBE5]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu Items Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              
              {/* หลังคาเรือน */}
              <button
                type="button"
                onClick={() => handleNav('households')}
                className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-all ${
                  activeTab === 'households'
                    ? 'bg-[#5D7052]/10 border-[#5D7052]/30 text-[#5D7052] font-semibold'
                    : 'bg-[#FAF8F5] border-[#DED8CF]/70 text-[#2C2C24] hover:bg-[#F0EBE5]'
                }`}
              >
                <Home className="w-4 h-4 text-[#5D7052] shrink-0" />
                <span className="truncate">หลังคาเรือน</span>
              </button>

              {/* สถิติรายคน */}
              <button
                type="button"
                onClick={() => handleNav('analytics', 'individual')}
                className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-all ${
                  activeTab === 'analytics' && analyticsViewMode === 'individual'
                    ? 'bg-[#5D7052]/10 border-[#5D7052]/30 text-[#5D7052] font-semibold'
                    : 'bg-[#FAF8F5] border-[#DED8CF]/70 text-[#2C2C24] hover:bg-[#F0EBE5]'
                }`}
              >
                <User className="w-4 h-4 text-[#5D7052] shrink-0" />
                <span className="truncate">สถิติรายบุคคล</span>
              </button>

              {/* รายงานทั้งหมด */}
              <button
                type="button"
                onClick={() => handleNav('inbox', 'manage')}
                className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-all ${
                  activeTab === 'inbox' && inboxActiveTab === 'manage'
                    ? 'bg-[#5D7052]/10 border-[#5D7052]/30 text-[#5D7052] font-semibold'
                    : 'bg-[#FAF8F5] border-[#DED8CF]/70 text-[#2C2C24] hover:bg-[#F0EBE5]'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-[#5D7052] shrink-0" />
                <span className="truncate">รายงานทั้งหมด</span>
              </button>

              {/* ส่งรายงาน */}
              <button
                type="button"
                onClick={() => handleNav('inbox', 'send')}
                className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-all ${
                  activeTab === 'inbox' && inboxActiveTab === 'send'
                    ? 'bg-[#5D7052]/10 border-[#5D7052]/30 text-[#5D7052] font-semibold'
                    : 'bg-[#FAF8F5] border-[#DED8CF]/70 text-[#2C2C24] hover:bg-[#F0EBE5]'
                }`}
              >
                <Send className="w-4 h-4 text-[#5D7052] shrink-0" />
                <span className="truncate">ส่งรายงาน</span>
              </button>

              {/* รับรายงาน */}
              <button
                type="button"
                onClick={() => handleNav('inbox', 'receive')}
                className={`col-span-2 flex items-center justify-between p-3 rounded-2xl border transition-all ${
                  activeTab === 'inbox' && inboxActiveTab === 'receive'
                    ? 'bg-[#5D7052]/10 border-[#5D7052]/30 text-[#5D7052] font-semibold'
                    : 'bg-[#FAF8F5] border-[#DED8CF]/70 text-[#2C2C24] hover:bg-[#F0EBE5]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Inbox className="w-4 h-4 text-[#5D7052] shrink-0" />
                  <span className="font-medium">รับรายงาน (Inbox)</span>
                </div>
                {Boolean(unreadReceivedCount && unreadReceivedCount > 0) && (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-[#A85448] text-white rounded-full">
                    {unreadReceivedCount} ใหม่
                  </span>
                )}
              </button>

              {/* ตั้งค่า */}
              <button
                type="button"
                onClick={() => handleNav('settings')}
                className={`col-span-2 flex items-center gap-2.5 p-3 rounded-2xl border transition-all ${
                  activeTab === 'settings'
                    ? 'bg-[#5D7052]/10 border-[#5D7052]/30 text-[#5D7052] font-semibold'
                    : 'bg-[#FAF8F5] border-[#DED8CF]/70 text-[#2C2C24] hover:bg-[#F0EBE5]'
                }`}
              >
                <Settings className="w-4 h-4 text-[#78786C] shrink-0" />
                <span>ตั้งค่าระบบและโปรไฟล์</span>
              </button>
            </div>

            {/* User Account / Logout */}
            {user && (
              <div className="pt-3 border-t border-[#DED8CF]/70 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#2C2C24] truncate">
                    {vhvProfile.name || user.name || 'ผู้ใช้งาน อสม.'}
                  </p>
                  <p className="text-[10px] text-[#78786C] truncate">
                    {vhvProfile.villageName ? `${vhvProfile.villageName} ${vhvProfile.moo}` : (user.phone || user.email || '')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMoreDrawerOpen(false);
                    logout();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#A85448] bg-[#A85448]/10 hover:bg-[#A85448]/20 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>ออกจากระบบ</span>
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
};
