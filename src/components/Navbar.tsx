import React, { useState } from 'react';
import { 
  HeartHandshake, 
  LayoutDashboard, 
  Users, 
  Home, 
  Stethoscope, 
  AlertTriangle, 
  BarChart3, 
  Settings, 
  PlusCircle, 
  Menu, 
  X, 
  User as UserIcon,
  LogOut,
  Sparkles,
  Inbox
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ActiveTab } from '../types';

interface NavbarProps {
  onOpenAuth?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAuth }) => {
  const { 
    activeTab, 
    setActiveTab, 
    user, 
    logout, 
    vhvProfile,
    setSelectedCitizenForCheckup,
    unreadReceivedCount
  } = useApp();
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const navItems: { id: ActiveTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'dashboard', label: 'หน้าหลัก', icon: LayoutDashboard },
    { id: 'citizens', label: 'ทะเบียนประชาชน', icon: Users },
    { id: 'households', label: 'หลังคาเรือน', icon: Home },
    { id: 'checkup', label: 'ตรวจสุขภาพ', icon: Stethoscope },
    { id: 'analytics', label: 'สถิติ', icon: BarChart3 },
    { id: 'inbox', label: 'รายงาน', icon: Inbox, badge: unreadReceivedCount },
    { id: 'settings', label: 'ตั้งค่า', icon: Settings },
  ];

  const handleNavClick = (tabId: ActiveTab) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  const handleQuickCheckup = () => {
    setSelectedCitizenForCheckup(null);
    setActiveTab('checkup');
    setMobileMenuOpen(false);
  };

  const handleAuthClick = () => {
    if (onOpenAuth) {
      onOpenAuth();
    }
  };

  return (
    <header className="sticky top-3 z-40 px-3 sm:px-6 w-full max-w-7xl mx-auto transition-all duration-300">
      <div className="bg-[#FDFCF8]/95 backdrop-blur-md border border-[#DED8CF]/80 shadow-soft rounded-full px-3 sm:px-5 py-2 flex items-center justify-between gap-2 max-w-full">
        
        {/* Brand Logo & Title */}
        <button 
          onClick={() => handleNavClick('dashboard')}
          className="flex items-center gap-2.5 text-left group focus:outline-none shrink-0"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#5D7052] flex items-center justify-center text-white shadow-[0_2px_10px_rgba(93,112,82,0.3)] transition-transform duration-300 group-hover:scale-105 shrink-0">
            <HeartHandshake className="w-4 h-4 sm:w-5 sm:h-5 text-[#FDFCF8]" />
          </div>
          <div className="shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-bold text-sm sm:text-base md:text-lg text-[#2C2C24] leading-tight whitespace-nowrap">
                อสม. สมาร์ทเฮลท์
              </span>
              <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-semibold bg-[#5D7052]/10 text-[#5D7052] rounded-full border border-[#5D7052]/20">
                ชุมชน
              </span>
            </div>
            <p className="text-[10px] text-[#78786C] font-medium hidden md:block leading-none mt-0.5 truncate max-w-[150px]">
              {vhvProfile.villageName} {vhvProfile.moo}
            </p>
          </div>
        </button>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 shrink">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`relative px-2.5 xl:px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap ${
                  isActive
                    ? 'bg-[#5D7052] text-[#FDFCF8] shadow-sm font-semibold'
                    : 'text-[#4A4A40] hover:text-[#2C2C24] hover:bg-[#F0EBE5]/80'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#FDFCF8]' : 'text-[#78786C]'}`} />
                <span>{item.label}</span>
                {Boolean(item.badge && item.badge > 0) && (
                  <span className="ml-0.5 px-1.5 py-0.2 text-[10px] font-bold bg-[#A85448] text-white rounded-full leading-tight animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Quick Checkup Button */}
          <button
            onClick={handleQuickCheckup}
            className="hidden md:flex items-center gap-1.5 bg-[#5D7052] hover:bg-[#48573F] text-[#FDFCF8] px-3.5 py-1.5 sm:py-2 rounded-full text-xs font-semibold shadow-soft hover:shadow-moss-glow transition-all duration-300 active:scale-95 whitespace-nowrap shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>ตรวจใหม่</span>
          </button>

          {/* User Profile / Login */}
          {user ? (
            <div className="relative shrink-0">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-1.5 sm:gap-2 bg-[#F0EBE5]/80 hover:bg-[#E6DCCD] p-1 sm:p-1.5 pr-2.5 sm:pr-3 rounded-full border border-[#DED8CF] transition-colors focus:outline-none"
              >
                {user.avatar ? (
                  <img 
                    src={user.avatar} 
                    alt={user.name} 
                    className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-[#5D7052]"
                  />
                ) : (
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#C18C5D] text-white flex items-center justify-center text-xs font-bold">
                    {user.name.charAt(0)}
                  </div>
                )}
                <span className="text-xs font-medium text-[#2C2C24] max-w-[80px] sm:max-w-[100px] truncate hidden md:inline-block">
                  {user.name}
                </span>
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-[#FDFCF8] rounded-2xl border border-[#DED8CF] shadow-float py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2 border-b border-[#DED8CF]/60">
                    <p className="text-xs font-semibold text-[#2C2C24] truncate">{user.name}</p>
                    <p className="text-[11px] text-[#78786C] truncate">{user.email}</p>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-[#5D7052] font-medium">
                      <Sparkles className="w-3 h-3" />
                      <span>{vhvProfile.healthCenterName}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (onOpenAuth) onOpenAuth();
                      setUserDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-[#5D7052] hover:bg-[#5D7052]/10 flex items-center gap-2 cursor-pointer"
                  >
                    <UserIcon className="w-3.5 h-3.5" />
                    <span>สลับบัญชี อสม.</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('settings');
                      setUserDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-[#4A4A40] hover:bg-[#F0EBE5] flex items-center gap-2 cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-[#78786C]" />
                    <span>ตั้งค่าระบบและโปรไฟล์</span>
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      setUserDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-[#A85448] hover:bg-[#A85448]/10 flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>ออกจากระบบ</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={handleAuthClick}
              className="flex items-center gap-1.5 bg-[#C18C5D] hover:bg-[#b07b4d] text-white px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm shrink-0 whitespace-nowrap"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>เข้าสู่ระบบ</span>
            </button>
          )}

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 sm:p-2 text-[#4A4A40] hover:text-[#2C2C24] hover:bg-[#F0EBE5] rounded-full focus:outline-none shrink-0"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      {mobileMenuOpen && (
        <div className="lg:hidden mt-2 bg-[#FDFCF8] border border-[#DED8CF] shadow-float rounded-3xl p-4 animate-in fade-in slide-in-from-top-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`relative p-2.5 rounded-2xl text-xs font-medium flex items-center justify-between gap-2 transition-all ${
                    isActive
                      ? 'bg-[#5D7052] text-[#FDFCF8] font-semibold shadow-sm'
                      : 'bg-[#F0EBE5]/60 text-[#4A4A40] hover:bg-[#E6DCCD]'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#5D7052]'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {Boolean(item.badge && item.badge > 0) && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#A85448] text-white rounded-full leading-none">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-[#DED8CF] flex items-center justify-between gap-2">
            <button
              onClick={handleQuickCheckup}
              className="w-full flex items-center justify-center gap-2 bg-[#5D7052] text-white py-2.5 px-4 rounded-full text-xs font-semibold"
            >
              <PlusCircle className="w-4 h-4" />
              <span>บันทึกตรวจสุขภาพด่วน</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
