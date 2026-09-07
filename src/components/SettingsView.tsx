import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  Type, 
  Database, 
  Save, 
  RotateCcw, 
  Check, 
  Download, 
  Upload,
  Trash2,
  Cloud,
  RefreshCw,
  Copy,
  Code,
  CheckCircle2,
  Phone,
  Calendar,
  Lock
} from 'lucide-react';
import { useApp, saveUserData } from '../context/AppContext';
import { useToast } from './ToastNotification';
import { VhvProfile } from '../types';
import { SUPABASE_SQL_SCHEMA } from '../lib/supabase';

export const SettingsView: React.FC = () => {
  const { 
    vhvProfile, 
    updateProfile, 
    fontSize, 
    setFontSize,
    citizens,
    records,
    clearAllRecords,
    clearAllData,
    syncWithSupabase,
    isSyncing,
    isOnline,
    user
  } = useApp();

  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profileForm, setProfileForm] = useState<VhvProfile>({ ...vhvProfile });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    setProfileForm({ ...vhvProfile });
  }, [vhvProfile]);

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile(profileForm);
    setSavedSuccess(true);
    showToast(
      'บันทึกการตั้งค่าเรียบร้อยแล้ว',
      'ข้อมูลโปรไฟล์ อสม. ถูกบันทึกและซิงค์เรียบร้อย',
      'success'
    );
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleManualSync = async () => {
    await syncWithSupabase();
    showToast(
      'ซิงค์ข้อมูลสำเร็จ',
      'ดึงและอัปเดตข้อมูลล่าสุดจาก Supabase เรียบร้อยแล้ว',
      'success'
    );
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    showToast(
      'คัดลอกคำสั่ง SQL สำเร็จ',
      'นำไปวางใน Supabase SQL Editor แล้วกด RUN ได้เลย',
      'success'
    );
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleExportBackupJson = () => {
    const backupData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      profile: profileForm,
      citizens,
      records
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VHV_Smart_Health_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(
      'ดาวน์โหลดไฟล์สำรองข้อมูลสำเร็จ',
      `ส่งออกไฟล์ ${a.download} เรียบร้อยแล้ว`,
      'success'
    );
  };

  const handleImportBackupJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        
        if (parsed.profile) updateProfile(parsed.profile);
        if (user?.id) {
          if (Array.isArray(parsed.citizens)) {
            saveUserData(user.id, 'citizens', parsed.citizens);
          }
          if (Array.isArray(parsed.records)) {
            saveUserData(user.id, 'records', parsed.records);
          }
        }

        showToast(
          'นำเข้าไฟล์ข้อมูลสำเร็จ',
          'กู้คืนข้อมูลเรียบร้อยแล้ว กรุณารีเฟรชหน้าเพื่ออัปเดตข้อมูล',
          'success'
        );
        setTimeout(() => window.location.reload(), 1200);
      } catch (err) {
        showToast('ไฟล์ไม่ถูกต้อง', 'กรุณาเลือกไฟล์สำรองข้อมูล JSON ที่ถูกต้อง', 'warning');
      }
    };
    reader.readAsText(file);
  };

  const handleClearRecords = () => {
    if (confirm('คุณต้องการล้างประวัติการตรวจทั้งหมดใช่หรือไม่? (ข้อมูลรายชื่อประชาชนจะยังคงอยู่)')) {
      clearAllRecords();
      showToast(
        'ล้างประวัติการตรวจเรียบร้อย',
        'ข้อมูลประวัติการตรวจสุขภาพทั้งหมดถูกล้างเป็น 0 เรียบร้อย',
        'info'
      );
    }
  };

  const handleClearAllData = () => {
    if (confirm('คุณต้องการล้างข้อมูลทั้งหมดในระบบใช่หรือไม่? (รายชื่อประชาชนและประวัติการตรวจทั้งหมดจะถูกลบเป็น 0)')) {
      clearAllData();
      showToast(
        'ล้างข้อมูลทั้งหมดเรียบร้อย',
        'รายชื่อประชาชนและประวัติการตรวจทั้งหมดถูกล้างเป็น 0 เรียบร้อย',
        'info'
      );
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-16 w-full max-w-full">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading font-bold text-2xl sm:text-3xl text-[#2C2C24]">
            การตั้งค่าระบบและฐานข้อมูล
          </h2>
          <p className="text-xs sm:text-sm text-[#78786C] mt-1">
            ปรับแต่งข้อมูลประจำตัว อสม. การเชื่อมต่อฐานข้อมูล Supabase และการจัดการข้อมูล
          </p>
        </div>

        {savedSuccess && (
          <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#5D7052]/15 border border-[#5D7052]/30 text-[#5D7052] text-xs font-bold animate-in fade-in">
            <Check className="w-4 h-4" />
            <span>บันทึกการเปลี่ยนแปลงแล้ว</span>
          </div>
        )}
      </div>

      {/* Supabase Connection Status Card */}
      <div className="bg-[#FEFEFA] border border-[#DED8CF] rounded-3xl p-5 sm:p-7 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DED8CF]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#5D7052]/15 flex items-center justify-center text-[#5D7052]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-bold text-base sm:text-lg text-[#2C2C24]">
                  ฐานข้อมูล Supabase Cloud
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#5D7052]/15 text-[#5D7052] border border-[#5D7052]/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5D7052] animate-pulse"></span>
                  เชื่อมต่อแล้ว
                </span>
              </div>
              <p className="text-xs text-[#78786C]">
                บัญชีผู้ใช้: <span className="font-semibold text-[#2C2C24]">{user?.phone || user?.name || 'อสม.'}</span> • สถานะเครือข่าย: {isOnline ? 'ออนไลน์' : 'ออฟไลน์'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#5D7052]/40 bg-[#5D7052]/10 hover:bg-[#5D7052]/20 text-xs font-bold text-[#5D7052] transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'กำลังซิงค์...' : 'ซิงค์ข้อมูลเดี๋ยวนี้'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSqlModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#DED8CF] bg-white hover:bg-[#F0EBE5] text-xs font-bold text-[#4A4A40] transition-colors cursor-pointer"
            >
              <Code className="w-3.5 h-3.5 text-[#C18C5D]" />
              <span>ดู SQL Schema</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-[#FAF8F5] border border-[#DED8CF] rounded-2xl">
            <span className="text-[#78786C] block">ตารางบัญชี อสม.</span>
            <span className="font-mono font-bold text-[#2C2C24]">public.profiles</span>
          </div>
          <div className="p-3 bg-[#FAF8F5] border border-[#DED8CF] rounded-2xl">
            <span className="text-[#78786C] block">ตารางทะเบียนประชาชน</span>
            <span className="font-mono font-bold text-[#2C2C24]">public.citizens ({citizens.length} รายการ)</span>
          </div>
          <div className="p-3 bg-[#FAF8F5] border border-[#DED8CF] rounded-2xl">
            <span className="text-[#78786C] block">ตารางผลตรวจสุขภาพ</span>
            <span className="font-mono font-bold text-[#2C2C24]">public.health_records ({records.length} ครั้ง)</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSaveAll} className="space-y-6 sm:space-y-8">
        
        {/* Section 1: VHV Profile Settings */}
        <div className="bg-[#FEFEFA] border border-[#DED8CF] rounded-3xl p-5 sm:p-7 shadow-soft space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-[#DED8CF]/60">
            <User className="w-5 h-5 text-[#5D7052]" />
            <div>
              <h3 className="font-heading font-bold text-base sm:text-lg text-[#2C2C24]">
                ข้อมูลประจำตัว อสม. และพื้นที่รับผิดชอบ
              </h3>
              <p className="text-xs text-[#78786C]">
                ข้อมูลนี้จะแสดงบนหัวรายงานการตรวจและเอกสารสรุปผลสุขภาพ
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#4A4A40] mb-1.5">
                ชื่อ-นามสกุล อสม. <span className="text-[#A85448] font-bold">*</span>
              </label>
              <input
                type="text"
                required
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                placeholder="เช่น นายสมศักดิ์ รักดี"
                className="w-full px-4 py-2.5 bg-white border border-[#DED8CF] rounded-2xl text-xs sm:text-sm text-[#2C2C24] placeholder:text-[#78786C]/60 focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A4A40] mb-1.5">
                เบอร์โทรศัพท์ (ชื่อเข้าใช้งาน) <span className="text-[#A85448] font-bold">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-[#78786C] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  placeholder="เช่น 0999999999"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-[#DED8CF] rounded-2xl text-xs sm:text-sm text-[#2C2C24] placeholder:text-[#78786C]/60 focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A4A40] mb-1.5">
                วันเกิด 8 หลัก (รหัสผ่าน)
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-[#78786C] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  maxLength={8}
                  value={profileForm.birthDate}
                  onChange={(e) => setProfileForm({ ...profileForm, birthDate: e.target.value.replace(/\D/g, '') })}
                  placeholder="เช่น 08052549"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-[#DED8CF] rounded-2xl text-xs sm:text-sm font-mono text-[#2C2C24] placeholder:text-[#78786C]/60 focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A4A40] mb-1.5">
                รหัสประจำตัว อสม.
              </label>
              <input
                type="text"
                value={profileForm.vhvId || ''}
                onChange={(e) => setProfileForm({ ...profileForm, vhvId: e.target.value })}
                placeholder="เช่น VHV-0123"
                className="w-full px-4 py-2.5 bg-white border border-[#DED8CF] rounded-2xl text-xs sm:text-sm text-[#2C2C24] placeholder:text-[#78786C]/60 focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A4A40] mb-1.5">
                ชื่อหมู่บ้าน / ชุมชน
              </label>
              <input
                type="text"
                value={profileForm.villageName || ''}
                onChange={(e) => setProfileForm({ ...profileForm, villageName: e.target.value })}
                placeholder="เช่น บ้านหนองหอย"
                className="w-full px-4 py-2.5 bg-white border border-[#DED8CF] rounded-2xl text-xs sm:text-sm text-[#2C2C24] placeholder:text-[#78786C]/60 focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A4A40] mb-1.5">
                หมู่ที่
              </label>
              <input
                type="text"
                value={profileForm.moo || ''}
                onChange={(e) => setProfileForm({ ...profileForm, moo: e.target.value })}
                placeholder="เช่น หมู่ที่ 2"
                className="w-full px-4 py-2.5 bg-white border border-[#DED8CF] rounded-2xl text-xs sm:text-sm text-[#2C2C24] placeholder:text-[#78786C]/60 focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A4A40] mb-1.5">
                ตำบล
              </label>
              <input
                type="text"
                value={profileForm.subdistrict || ''}
                onChange={(e) => setProfileForm({ ...profileForm, subdistrict: e.target.value })}
                placeholder="เช่น ตำบลท่าม่วง"
                className="w-full px-4 py-2.5 bg-white border border-[#DED8CF] rounded-2xl text-xs sm:text-sm text-[#2C2C24] placeholder:text-[#78786C]/60 focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A4A40] mb-1.5">
                อำเภอ
              </label>
              <input
                type="text"
                value={profileForm.district || ''}
                onChange={(e) => setProfileForm({ ...profileForm, district: e.target.value })}
                placeholder="เช่น อำเภอเมือง"
                className="w-full px-4 py-2.5 bg-white border border-[#DED8CF] rounded-2xl text-xs sm:text-sm text-[#2C2C24] placeholder:text-[#78786C]/60 focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A4A40] mb-1.5">
                จังหวัด
              </label>
              <input
                type="text"
                value={profileForm.province || ''}
                onChange={(e) => setProfileForm({ ...profileForm, province: e.target.value })}
                placeholder="เช่น จังหวัดเชียงใหม่"
                className="w-full px-4 py-2.5 bg-white border border-[#DED8CF] rounded-2xl text-xs sm:text-sm text-[#2C2C24] placeholder:text-[#78786C]/60 focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-semibold text-[#4A4A40] mb-1.5">
                หน่วยบริการสาธารณสุข / รพ.สต. สังกัด
              </label>
              <input
                type="text"
                value={profileForm.healthCenterName || ''}
                onChange={(e) => setProfileForm({ ...profileForm, healthCenterName: e.target.value })}
                placeholder="เช่น รพ.สต. บ้านหนองหอย"
                className="w-full px-4 py-2.5 bg-white border border-[#DED8CF] rounded-2xl text-xs sm:text-sm text-[#2C2C24] placeholder:text-[#78786C]/60 focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Font Size Setting */}
        <div className="bg-[#FEFEFA] border border-[#DED8CF] rounded-3xl p-5 sm:p-7 shadow-soft space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#DED8CF]/60">
            <Type className="w-5 h-5 text-[#5D7052]" />
            <div>
              <h3 className="font-heading font-bold text-base sm:text-lg text-[#2C2C24]">
                ปรับขนาดตัวอักษรของระบบ
              </h3>
              <p className="text-xs text-[#78786C]">
                เพิ่มความสะดวกสบายในการอ่านสำหรับพี่น้อง อสม. ทุกท่าน
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <button
              type="button"
              onClick={() => setFontSize('sm')}
              className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                fontSize === 'sm'
                  ? 'border-[#5D7052] bg-[#5D7052]/10 ring-2 ring-[#5D7052]/30'
                  : 'border-[#DED8CF] bg-white hover:bg-[#F0EBE5]'
              }`}
            >
              <span className="block font-bold text-sm text-[#2C2C24]">ขนาดปกติ (16px)</span>
              <span className="text-[11px] text-[#78786C]">มาตรฐานทั่วไป</span>
            </button>

            <button
              type="button"
              onClick={() => setFontSize('md')}
              className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                fontSize === 'md'
                  ? 'border-[#5D7052] bg-[#5D7052]/10 ring-2 ring-[#5D7052]/30'
                  : 'border-[#DED8CF] bg-white hover:bg-[#F0EBE5]'
              }`}
            >
              <span className="block font-bold text-base text-[#2C2C24]">ขนาดใหญ่ (18px)</span>
              <span className="text-xs text-[#78786C]">อ่านง่าย สบายตา</span>
            </button>

            <button
              type="button"
              onClick={() => setFontSize('lg')}
              className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                fontSize === 'lg'
                  ? 'border-[#5D7052] bg-[#5D7052]/10 ring-2 ring-[#5D7052]/30'
                  : 'border-[#DED8CF] bg-white hover:bg-[#F0EBE5]'
              }`}
            >
              <span className="block font-bold text-lg text-[#2C2C24]">ขนาดใหญ่พิเศษ (20px)</span>
              <span className="text-xs text-[#78786C]">ตัวหนังสือใหญ่ชัดเจน</span>
            </button>
          </div>
        </div>

        {/* Section 3: Data Management & Backup */}
        <div className="bg-[#FEFEFA] border border-[#DED8CF] rounded-3xl p-5 sm:p-7 shadow-soft space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#DED8CF]/60">
            <Database className="w-5 h-5 text-[#5D7052]" />
            <div>
              <h3 className="font-heading font-bold text-base sm:text-lg text-[#2C2C24]">
                การจัดการและสำรองข้อมูล
              </h3>
              <p className="text-xs text-[#78786C]">
                สำรองข้อมูลหรือล้างข้อมูลในระบบ
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs pt-1">
            <div className="space-y-1">
              <p className="font-semibold text-[#2C2C24]">
                ข้อมูลปัจจุบัน: ประชาชน {citizens.length} คน | บันทึกตรวจ {records.length} ครั้ง
              </p>
              <p className="text-[11px] text-[#78786C]">
                ข้อมูลถูกจัดเก็บบนอุปกรณ์และซิงค์กับ Supabase อย่างปลอดภัย
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportBackupJson}
                accept=".json"
                className="hidden"
              />

              <button
                type="button"
                onClick={handleExportBackupJson}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[#DED8CF] bg-white hover:bg-[#F0EBE5] text-xs font-semibold text-[#2C2C24] transition-colors whitespace-nowrap cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#5D7052]" />
                <span>สำรองข้อมูล (JSON)</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[#DED8CF] bg-white hover:bg-[#F0EBE5] text-xs font-semibold text-[#2C2C24] transition-colors whitespace-nowrap cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[#5D7052]" />
                <span>นำเข้าข้อมูล (JSON)</span>
              </button>

              <button
                type="button"
                onClick={handleClearRecords}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[#C18C5D]/30 bg-[#C18C5D]/10 hover:bg-[#C18C5D]/20 text-xs font-semibold text-[#C18C5D] transition-colors whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>ล้างประวัติการตรวจ</span>
              </button>

              <button
                type="button"
                onClick={handleClearAllData}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[#A85448]/30 bg-[#A85448]/10 hover:bg-[#A85448]/20 text-xs font-semibold text-[#A85448] transition-colors whitespace-nowrap cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>ล้างข้อมูลทั้งหมด</span>
              </button>
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            className="flex items-center gap-2 px-8 py-3 rounded-full bg-[#5D7052] hover:bg-[#48573F] text-white font-bold text-sm shadow-soft hover:shadow-moss-glow transition-all active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>บันทึกการตั้งค่าทั้งหมด</span>
          </button>
        </div>

      </form>

      {/* SQL Schema Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#DED8CF] shadow-float max-w-2xl w-full p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#DED8CF]">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-[#5D7052]" />
                <h3 className="font-heading font-bold text-lg text-[#2C2C24]">
                  Supabase SQL Schema Script
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="p-1 text-[#78786C] hover:text-[#2C2C24] rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#78786C]">
              นำโค้ด SQL ด้านล่างนี้ไปวางใน **Supabase SQL Editor** ของโปรเจกต์คุณ แล้วกด **RUN** เพื่อสร้างตาราง `profiles`, `citizens`, และ `health_records` พร้อมเปิดระบบความปลอดภัย RLS:
            </p>

            <div className="flex-1 overflow-auto bg-[#2C2C24] text-[#E2ECE0] p-4 rounded-2xl font-mono text-xs leading-relaxed">
              <pre>{SUPABASE_SQL_SCHEMA}</pre>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleCopySql}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#5D7052] hover:bg-[#48573F] text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                {copiedSql ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedSql ? 'คัดลอกเรียบร้อยแล้ว!' : 'คัดลอก SQL Script'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="px-4 py-2 border border-[#DED8CF] bg-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
