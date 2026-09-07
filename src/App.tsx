import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ToastProvider } from './components/ToastNotification';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { MobileNav } from './components/MobileNav';
import { LoginView } from './components/LoginView';
import { AuthModal } from './components/AuthModal';
import { DashboardView } from './components/DashboardView';
import { CitizenDatabaseView } from './components/CitizenDatabaseView';
import { HouseholdView } from './components/HouseholdView';
import { HealthCheckupForm } from './components/HealthCheckupForm';
import { AnalyticsView } from './components/AnalyticsView';
import { InboxView } from './components/InboxView';
import { SettingsView } from './components/SettingsView';
import { CitizenProfileModal } from './components/CitizenProfileModal';

const MainLayout: React.FC = () => {
  const { 
    user,
    authLoading,
    activeTab, 
    fontSize, 
    selectedCitizenForProfile, 
    setSelectedCitizenForProfile 
  } = useApp();

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);

  const fontClass = 
    fontSize === 'lg' 
      ? 'text-lg' 
      : fontSize === 'sm' 
      ? 'text-xs' 
      : 'text-sm';

  // 1. Loading State while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FDFCF8] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-3 border-[#5D7052] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs sm:text-sm font-semibold text-[#78786C]">กำลังตรวจสอบการลงชื่อเข้าใช้...</p>
      </div>
    );
  }

  // 2. Unauthenticated: Show Login Gate First!
  if (!user || !user.isLoggedIn) {
    return <LoginView />;
  }

  // 3. Authenticated: Render Main App Experience with Sidebar & Header
  return (
    <div className={`min-h-screen bg-[#FDFCF8] text-[#2C2C24] font-body flex flex-col lg:flex-row overflow-x-hidden ${fontClass}`}>
      
      {/* Background Soft Blobs */}
      <div className="fixed top-[-100px] left-[-100px] w-[450px] h-[450px] bg-[#E2ECE0] opacity-35 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-[30%] right-[-150px] w-[500px] h-[500px] bg-[#F4E8DB] opacity-35 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-[-100px] left-[20%] w-[450px] h-[450px] bg-[#E8DDD4] opacity-30 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Desktop Sidebar (lg:flex, hidden on mobile) */}
      <Sidebar onOpenAuth={() => setAuthModalOpen(true)} />

      {/* Main Content Area Container */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        
        {/* Top Header Bar */}
        <Header onOpenMobileMenu={() => setMoreDrawerOpen(true)} />

        {/* Dynamic View Render */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-24 lg:pb-12 animate-in fade-in overflow-x-hidden">
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'citizens' && <CitizenDatabaseView />}
          {activeTab === 'households' && <HouseholdView />}
          {activeTab === 'checkup' && <HealthCheckupForm />}
          {activeTab === 'analytics' && <AnalyticsView />}
          {activeTab === 'inbox' && <InboxView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>

      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav 
        moreDrawerOpen={moreDrawerOpen} 
        setMoreDrawerOpen={setMoreDrawerOpen} 
      />

      {/* Global Modals */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      <CitizenProfileModal 
        citizen={selectedCitizenForProfile} 
        onClose={() => setSelectedCitizenForProfile(null)} 
      />

    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <MainLayout />
      </ToastProvider>
    </AppProvider>
  );
}
