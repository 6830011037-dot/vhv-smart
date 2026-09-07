import React, { useState } from 'react';
import { 
  Heart, 
  LogIn, 
  UserPlus, 
  ShieldCheck, 
  User, 
  Phone, 
  Calendar, 
  Building2, 
  MapPin, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle,
  Database,
  CloudCheck
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { VhvProfile } from '../types';

export const LoginView: React.FC = () => {
  const { loginWithPhone, signUpWithPhone, authLoading, isOnline, supabaseConnected } = useApp();
  
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  
  // Login Form States
  const [loginPhone, setLoginPhone] = useState('');
  const [loginBirthDate, setLoginBirthDate] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Signup Form States
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [vhvId, setVhvId] = useState('');
  const [villageName, setVillageName] = useState('');
  const [moo, setMoo] = useState('');
  const [subdistrict, setSubdistrict] = useState('');
  const [district, setDistrict] = useState('');
  const [province, setProvince] = useState('');
  const [healthCenterName, setHealthCenterName] = useState('');
  
  // Alert messages
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Handle Login Submit
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!loginPhone.trim()) {
      setErrorMessage('กรุณากรอกเบอร์โทรศัพท์ (ช่องบน)');
      return;
    }
    if (!loginBirthDate.trim() || loginBirthDate.trim().length < 8) {
      setErrorMessage('กรุณากรอกวันเกิด 8 หลัก (ช่องล่าง เช่น 08052549)');
      return;
    }

    const res = await loginWithPhone(loginPhone, loginBirthDate);
    if (!res.success) {
      setErrorMessage(res.message || 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบข้อมูล');
    }
  };

  // Handle Sign Up Submit
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!name.trim()) {
      setErrorMessage('กรุณากรอกชื่อ-นามสกุล อสม. (จำเป็น)');
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 9) {
      setErrorMessage('กรุณากรอกเบอร์โทรศัพท์ติดต่อ 9-10 หลัก (จำเป็น)');
      return;
    }
    if (!birthDate.trim() || birthDate.trim().length < 8) {
      setErrorMessage('กรุณากรอกวันเกิด 8 หลัก (เช่น 08052549) สำหรับใช้เป็นรหัสผ่าน');
      return;
    }

    const newProfile: VhvProfile = {
      name: name.trim(),
      phone: phone.trim(),
      birthDate: birthDate.trim(),
      vhvId: vhvId.trim() || undefined,
      villageName: villageName.trim() || undefined,
      moo: moo.trim() || undefined,
      subdistrict: subdistrict.trim() || undefined,
      district: district.trim() || undefined,
      province: province.trim() || undefined,
      healthCenterName: healthCenterName.trim() || undefined,
      fontSize: 'md'
    };

    const res = await signUpWithPhone(newProfile);
    if (res.success) {
      setSuccessMessage('สมัครสมาชิกสำเร็จและเข้าสู่ระบบเรียบร้อย');
    } else {
      setErrorMessage(res.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก');
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCF8] text-[#2C2C24] font-body flex flex-col justify-center items-center px-4 py-8 sm:py-12 relative overflow-hidden">
      
      {/* Glow Background Elements */}
      <div className="fixed top-[-120px] left-[-120px] w-[550px] h-[550px] bg-[#E2ECE0] opacity-70 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-[-120px] right-[-120px] w-[550px] h-[550px] bg-[#F4E8DB] opacity-70 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Main Container Card */}
      <div className="w-full max-w-xl bg-white border border-[#DED8CF] rounded-3xl shadow-card p-6 sm:p-9 space-y-6 animate-in fade-in zoom-in-95 duration-300">
        
        {/* Header & App Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#5D7052] text-white shadow-soft mb-1">
            <Heart className="w-8 h-8 fill-current" />
          </div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#2C2C24]">
            อสม. สมาร์ทเฮลท์ ชุมชน
          </h1>
          <p className="text-xs sm:text-sm text-[#78786C] max-w-md mx-auto">
            ระบบบันทึกตรวจสุขภาพ ข้อมูลประชาชน และหลังคาเรือน เชื่อมต่อฐานข้อมูล Supabase
          </p>
        </div>

        {/* Database Status Badge */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#FAF8F5] border border-[#DED8CF] rounded-2xl text-xs">
          <div className="flex items-center gap-2 text-[#4A4A40]">
            <Database className="w-4 h-4 text-[#5D7052]" />
            <span className="font-semibold">ฐานข้อมูล Supabase:</span>
            <span className="text-[#5D7052] font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#5D7052] animate-pulse"></span>
              พร้อมใช้งาน (Cloud Sync)
            </span>
          </div>
          <span className="text-[11px] text-[#78786C] font-mono">
            {isOnline ? 'ออนไลน์' : 'ออฟไลน์'}
          </span>
        </div>

        {/* Tab Switcher: เข้าสู่ระบบ vs สมัครสมาชิก */}
        <div className="grid grid-cols-2 p-1.5 bg-[#F2EEE9] rounded-2xl border border-[#DED8CF]/80">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'login'
                ? 'bg-white text-[#2C2C24] shadow-sm border border-[#DED8CF]/60'
                : 'text-[#78786C] hover:text-[#2C2C24]'
            }`}
          >
            <LogIn className="w-4 h-4 text-[#5D7052]" />
            <span>เข้าสู่ระบบ</span>
          </button>
          
          <button
            type="button"
            onClick={() => {
              setActiveTab('signup');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'signup'
                ? 'bg-white text-[#2C2C24] shadow-sm border border-[#DED8CF]/60'
                : 'text-[#78786C] hover:text-[#2C2C24]'
            }`}
          >
            <UserPlus className="w-4 h-4 text-[#C18C5D]" />
            <span>สมัครสมาชิก อสม.</span>
          </button>
        </div>

        {/* Alert Error / Success */}
        {errorMessage && (
          <div className="p-3.5 bg-[#A85448]/10 border border-[#A85448]/30 rounded-2xl text-xs sm:text-sm text-[#A85448] font-semibold flex items-start gap-2.5 animate-in fade-in duration-200">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 bg-[#5D7052]/10 border border-[#5D7052]/30 rounded-2xl text-xs sm:text-sm text-[#5D7052] font-semibold flex items-start gap-2.5 animate-in fade-in duration-200">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{successMessage}</div>
          </div>
        )}

        {/* ----------------- TAB 1: LOGIN FORM ----------------- */}
        {activeTab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="bg-[#FAF8F5] border border-[#DED8CF] rounded-2xl p-4 space-y-4">
              
              {/* ช่องบน: เบอร์โทรศัพท์ */}
              <div>
                <label className="block text-xs font-bold text-[#4A4A40] mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#5D7052]" />
                    เบอร์โทรศัพท์ (ช่องบน)
                  </span>
                  <span className="text-[11px] text-[#A85448] font-semibold">* บังคับ</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    placeholder="เช่น 0999999999"
                    className="w-full px-4 py-3 bg-white border border-[#DED8CF] rounded-xl text-sm sm:text-base font-medium text-[#2C2C24] placeholder:text-[#78786C]/50 focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
                  />
                </div>
              </div>

              {/* ช่องล่าง: วันเกิด 8 หลัก */}
              <div>
                <label className="block text-xs font-bold text-[#4A4A40] mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#C18C5D]" />
                    วันเกิด 8 หลัก / รหัสผ่าน (ช่องล่าง)
                  </span>
                  <span className="text-[11px] text-[#A85448] font-semibold">* บังคับ (8 ตัว)</span>
                </label>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    maxLength={8}
                    inputMode="numeric"
                    value={loginBirthDate}
                    onChange={(e) => setLoginBirthDate(e.target.value.replace(/\D/g, ''))}
                    placeholder="เช่น 08052549 (วัน-เดือน-ปี พ.ศ.)"
                    className="w-full pl-4 pr-12 py-3 bg-white border border-[#DED8CF] rounded-xl text-sm sm:text-base font-mono tracking-wider text-[#2C2C24] placeholder:text-[#78786C]/50 focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#78786C] hover:text-[#2C2C24] p-1.5 cursor-pointer"
                    title={showLoginPassword ? 'ซ่อนรหัส' : 'ดูรหัส'}
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-[#78786C] mt-1.5">
                  รูปแบบ: วันเกิด 8 หลัก เช่น วันที่ 8 พ.ค. 2549 ให้กรอก <span className="font-mono font-bold text-[#2C2C24]">08052549</span>
                </p>
              </div>

            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-[#5D7052] hover:bg-[#48573F] text-white font-bold text-sm sm:text-base rounded-2xl shadow-soft hover:shadow-moss-glow transition-all active:scale-95 cursor-pointer disabled:opacity-50 mt-2"
            >
              {authLoading ? (
                <span>กำลังเข้าสู่ระบบ...</span>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>เข้าสู่ระบบ อสม.</span>
                </>
              )}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setActiveTab('signup')}
                className="text-xs text-[#5D7052] hover:underline font-semibold cursor-pointer"
              >
                ยังไม่มีบัญชี อสม.? กดที่นี่เพื่อสมัครสมาชิกใหม่
              </button>
            </div>
          </form>
        )}

        {/* ----------------- TAB 2: SIGN UP FORM ----------------- */}
        {activeTab === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-4">
            
            {/* Required Fields Section */}
            <div className="bg-[#FAF8F5] border border-[#DED8CF] rounded-2xl p-4 space-y-3.5">
              <div className="text-xs font-bold text-[#2C2C24] flex items-center gap-1.5 pb-1 border-b border-[#DED8CF]/60">
                <ShieldCheck className="w-4 h-4 text-[#5D7052]" />
                <span>ข้อมูลที่จำเป็นสำหรับบัญชีผู้ใช้ (*)</span>
              </div>

              {/* 1. ชื่อ-นามสกุล อสม. (Required) */}
              <div>
                <label className="block text-xs font-semibold text-[#4A4A40] mb-1">
                  ชื่อ-นามสกุล อสม. <span className="text-[#A85448] font-bold">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#78786C] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="เช่น นางสมร แจ่มจันทร์"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-[#DED8CF] rounded-xl text-xs sm:text-sm text-[#2C2C24] placeholder:text-[#78786C]/50 focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 2. เบอร์โทรศัพท์ (Required) */}
                <div>
                  <label className="block text-xs font-semibold text-[#4A4A40] mb-1">
                    เบอร์โทรศัพท์ติดต่อ <span className="text-[#A85448] font-bold">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-[#78786C] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      inputMode="numeric"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="เช่น 0999999999"
                      className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-[#DED8CF] rounded-xl text-xs sm:text-sm text-[#2C2C24] placeholder:text-[#78786C]/50 focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
                    />
                  </div>
                </div>

                {/* 3. วันเกิด 8 หลัก (Required) */}
                <div>
                  <label className="block text-xs font-semibold text-[#4A4A40] mb-1">
                    วันเกิด 8 หลัก (รหัสผ่าน) <span className="text-[#A85448] font-bold">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showSignupPassword ? 'text' : 'password'}
                      required
                      maxLength={8}
                      inputMode="numeric"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value.replace(/\D/g, ''))}
                      placeholder="เช่น 08052549"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-[#DED8CF] rounded-xl text-xs sm:text-sm font-mono tracking-wider text-[#2C2C24] placeholder:text-[#78786C]/50 focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#78786C] hover:text-[#2C2C24] p-1 cursor-pointer"
                      title={showSignupPassword ? 'ซ่อนรหัส' : 'ดูรหัส'}
                    >
                      {showSignupPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Optional Fields Section */}
            <div className="bg-[#FAF8F5] border border-[#DED8CF] rounded-2xl p-4 space-y-3.5">
              <div className="text-xs font-bold text-[#78786C] flex items-center justify-between pb-1 border-b border-[#DED8CF]/60">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#C18C5D]" />
                  ข้อมูลพื้นที่ปฏิบัติงาน อสม.
                </span>
                <span className="text-[11px] text-[#78786C]">(ไม่บังคับ กรอกภายหลังได้)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#4A4A40] mb-1">
                    รหัสประจำตัว อสม.
                  </label>
                  <input
                    type="text"
                    value={vhvId}
                    onChange={(e) => setVhvId(e.target.value)}
                    placeholder="เช่น VHV-0123"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#DED8CF] rounded-xl text-xs sm:text-sm text-[#2C2C24] placeholder:text-[#78786C]/50 focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A4A40] mb-1">
                    หมู่ที่
                  </label>
                  <input
                    type="text"
                    value={moo}
                    onChange={(e) => setMoo(e.target.value)}
                    placeholder="เช่น หมู่ที่ 3"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#DED8CF] rounded-xl text-xs sm:text-sm text-[#2C2C24] placeholder:text-[#78786C]/50 focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#4A4A40] mb-1">
                    ชื่อหมู่บ้าน / ชุมชน
                  </label>
                  <input
                    type="text"
                    value={villageName}
                    onChange={(e) => setVillageName(e.target.value)}
                    placeholder="เช่น บ้านหนองผักชี"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#DED8CF] rounded-xl text-xs sm:text-sm text-[#2C2C24] placeholder:text-[#78786C]/50 focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A4A40] mb-1">
                    ตำบล
                  </label>
                  <input
                    type="text"
                    value={subdistrict}
                    onChange={(e) => setSubdistrict(e.target.value)}
                    placeholder="เช่น หนองบัว"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#DED8CF] rounded-xl text-xs sm:text-sm text-[#2C2C24] placeholder:text-[#78786C]/50 focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A4A40] mb-1">
                    อำเภอ
                  </label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="เช่น เมือง"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#DED8CF] rounded-xl text-xs sm:text-sm text-[#2C2C24] placeholder:text-[#78786C]/50 focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A4A40] mb-1">
                    จังหวัด
                  </label>
                  <input
                    type="text"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    placeholder="เช่น เชียงใหม่"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#DED8CF] rounded-xl text-xs sm:text-sm text-[#2C2C24] placeholder:text-[#78786C]/50 focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A4A40] mb-1">
                    หน่วยบริการ / รพ.สต. สังกัด
                  </label>
                  <input
                    type="text"
                    value={healthCenterName}
                    onChange={(e) => setHealthCenterName(e.target.value)}
                    placeholder="เช่น รพ.สต. หนองบัว"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#DED8CF] rounded-xl text-xs sm:text-sm text-[#2C2C24] placeholder:text-[#78786C]/50 focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
                  />
                </div>
              </div>
            </div>

            <div className="p-3 bg-[#FAF8F5] border border-[#DED8CF] rounded-2xl text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-[#2C2C24]">
                <ShieldCheck className="w-4 h-4 text-[#5D7052]" />
                <span>คำแนะนำการตั้งค่า Supabase:</span>
              </div>
              <p className="text-[11px] text-[#78786C] leading-relaxed">
                ใน Supabase Dashboard อย่าลืมไปที่ <strong className="text-[#2C2C24]">Authentication &gt; Providers &gt; Email &gt; ปิด "Confirm email"</strong> เพื่อให้ระบบสมัครสมาชิกได้ทันทีโดยไม่ต้องรอยืนยันอีเมล
              </p>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-[#5D7052] hover:bg-[#48573F] text-white font-bold text-sm sm:text-base rounded-2xl shadow-soft hover:shadow-moss-glow transition-all active:scale-95 cursor-pointer disabled:opacity-50 mt-2"
            >
              {authLoading ? (
                <span>กำลังบันทึกและสมัครสมาชิก...</span>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  <span>ยืนยันการสมัครสมาชิก อสม.</span>
                </>
              )}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setActiveTab('login')}
                className="text-xs text-[#5D7052] hover:underline font-semibold cursor-pointer"
              >
                มีบัญชี อสม. อยู่แล้ว? กลับไปหน้าเข้าสู่ระบบ
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
