import React from 'react';
import { 
  Menu, 
  RotateCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  PlusCircle,
  ChevronRight,
  HeartHandshake,
  Search
} from 'lucide-react';
import { useApp } from '../context/AppContext';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
  onOpenSearch?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu, onOpenSearch }) => {
  const { 
    activeTab, 
    analyticsViewMode,
    inboxActiveTab,
    syncStatus, 
    isSyncing, 
    pendingSyncCount,
    triggerManualSync, 
    setSelectedCitizenForCheckup, 
    setActiveTab,
    vhvProfile,
    user
  } = useApp();

  // Determine current breadcrumb & title
  const getPageInfo = () => {
    switch (activeTab) {
      case 'dashboard':
        return { category: 'ภาพรวมระบบ', title: 'หน้าหลัก' };
      case 'citizens':
        return { category: 'ประชาชน', title: 'ทะเบียนประชาชน' };
      case 'households':
        return { category: 'ประชาชน', title: 'หลังคาเรือน' };
      case 'checkup':
        return { category: 'การแพทย์และสุขภาพ', title: 'บันทึกตรวจสุขภาพ' };
      case 'analytics':
        return { 
          category: 'สถิติสุขภาพ', 
          title: analyticsViewMode === 'individual' ? 'สถิติรายบุคคล' : 'สถิติภาพรวม' 
        };
      case 'inbox':
        return { 
          category: 'ระบบรายงาน', 
          title: inboxActiveTab === 'send' ? 'ส่งรายงาน' : inboxActiveTab === 'receive' ? 'รับรายงาน' : 'รายงานทั้งหมด' 
        };
      case 'settings':
        return { category: 'ระบบ', title: 'ตั้งค่าการใช้งาน' };
      default:
        return { category: 'ระบบ', title: 'VHV Smart Health' };
    }
  };

  const pageInfo = getPageInfo();

  return (
    <header 
      id="app-top-header"
      aria-label="แถบหัวเรื่องหลัก"
      className="sticky top-0 z-20 bg-[#FDFCF8]/90 backdrop-blur-md border-b border-[#DED8CF]/80 px-3.5 sm:px-6 lg:px-8 py-2.5 sm:py-3 transition-all select-none"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        
        {/* Left: Mobile Brand / Desktop Breadcrumb */}
        <div className="flex items-center gap-2.5 min-w-0">
          
          {/* Mobile Menu Open Button */}
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 rounded-xl text-[#4A4A40] hover:bg-[#F0EBE5] border border-[#DED8CF]/60 transition-colors shrink-0"
            aria-label="เปิดเมนูนำทาง"
          >
            <Menu className="w-4 h-4 text-[#2C2C24]" />
          </button>

          {/* Mobile Brand Icon */}
          <div className="lg:hidden w-8 h-8 rounded-xl bg-[#5D7052] flex items-center justify-center text-[#FDFCF8] shadow-xs shrink-0">
            <HeartHandshake className="w-4 h-4" />
          </div>

          {/* Breadcrumb / Title */}
          <div className="min-w-0">
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-[#78786C]">
              <span>{pageInfo.category}</span>
              <ChevronRight className="w-3 h-3 text-[#78786C]/60" />
            </div>
            <h2 className="font-heading font-bold text-sm sm:text-base md:text-lg text-[#2C2C24] truncate leading-tight">
              {pageInfo.title}
            </h2>
          </div>
        </div>

        {/* Center / Right: Global Search & Sync Status & Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          
          {/* Global Search Trigger */}
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#FEFEFA] hover:bg-white border border-[#DED8CF] rounded-full text-xs text-[#78786C] hover:text-[#2C2C24] transition-all shadow-2xs cursor-pointer"
            title="ค้นหาด่วน (Ctrl + K)"
          >
            <Search className="w-3.5 h-3.5 text-[#5D7052]" />
            <span className="hidden md:inline">ค้นหาด่วน...</span>
            <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-[#F0EBE5] rounded text-[#4A4A40]">
              Ctrl+K
            </kbd>
          </button>

          {/* Real Sync Status Indicator */}
          <div className="flex items-center">
            {isSyncing ? (
              <div 
                id="header-sync-syncing"
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-[#5D7052]/10 border border-[#5D7052]/20 text-[#5D7052] text-xs font-semibold"
                title="กำลังซิงค์ข้อมูลกับคลาวด์"
              >
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">กำลังซิงค์...</span>
                <span className="sm:hidden">ซิงค์...</span>
              </div>
            ) : pendingSyncCount > 0 ? (
              <button
                type="button"
                id="header-sync-pending"
                onClick={() => triggerManualSync()}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-[#C18C5D]/15 border border-[#C18C5D]/30 text-[#C18C5D] hover:bg-[#C18C5D]/25 transition-colors text-xs font-semibold cursor-pointer"
                title="คลิกเพื่อซิงค์ข้อมูลทันที"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>รอซิงค์ {pendingSyncCount}</span>
              </button>
            ) : syncStatus === 'error' ? (
              <button
                type="button"
                id="header-sync-error"
                onClick={() => triggerManualSync()}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-[#A85448]/10 border border-[#A85448]/25 text-[#A85448] hover:bg-[#A85448]/20 transition-colors text-xs font-semibold cursor-pointer"
                title="เกิดข้อผิดพลาดในการเชื่อมต่อ คลิกเพื่อลองใหม่"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">มีข้อผิดพลาด (ลองใหม่)</span>
                <span className="sm:hidden">ลองใหม่</span>
              </button>
            ) : (
              <button
                type="button"
                id="header-sync-synced"
                onClick={() => triggerManualSync()}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-[#5D7052]/10 border border-[#5D7052]/20 text-[#5D7052] text-xs font-semibold hover:bg-[#5D7052]/20 transition-colors cursor-pointer"
                title="ข้อมูลทั้งหมดตรงกับระบบคลาวด์แล้ว คลิกเพื่อตรวจสอบการซิงค์"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#5D7052]" />
                <span className="hidden sm:inline">ซิงค์แล้ว</span>
              </button>
            )}
          </div>

          {/* Quick Checkup Button (Desktop / Tablet) */}
          <button
            type="button"
            id="header-btn-quick-checkup"
            onClick={() => {
              setSelectedCitizenForCheckup(null);
              setActiveTab('checkup');
            }}
            className="hidden md:flex items-center gap-1.5 bg-[#5D7052] hover:bg-[#48573F] text-[#FDFCF8] px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-xs transition-all active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>ตรวจใหม่</span>
          </button>

          {/* Small User Info / Location on Header */}
          {vhvProfile.villageName && (
            <div className="hidden xl:flex items-center gap-1.5 text-xs text-[#78786C] bg-[#F0EBE5]/60 px-3 py-1 rounded-full border border-[#DED8CF]/60">
              <span className="font-semibold text-[#2C2C24]">{vhvProfile.villageName} {vhvProfile.moo}</span>
            </div>
          )}

        </div>

      </div>
    </header>
  );
};
