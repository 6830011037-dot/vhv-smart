import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Scale, 
  Droplet, 
  CheckCircle2, 
  Save, 
  RotateCcw, 
  UserPlus,
  Ruler
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from './ToastNotification';
import { Citizen, HealthRecord } from '../types';
import { calculateBMI } from '../utils/healthCalculations';

export const HealthCheckupForm: React.FC = () => {
  const { 
    citizens, 
    addHealthRecord, 
    vhvProfile, 
    selectedCitizenForCheckup, 
    setSelectedCitizenForCheckup,
    setSelectedCitizenForProfile,
    setActiveTab 
  } = useApp();

  const { showToast } = useToast();

  // Selected Citizen
  const [selectedCitizen, setSelectedCitizen] = useState<Citizen | null>(
    selectedCitizenForCheckup || null
  );
  const [citizenSearch, setCitizenSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Form Vital Signs - ONLY date is pre-filled with today's date!
  const getTodayString = () => new Date().toISOString().split('T')[0];
  const [screeningDate, setScreeningDate] = useState(getTodayString());
  
  // All vital signs START COMPLETELY EMPTY (no pre-filled numbers)
  const [systolic, setSystolic] = useState<number | ''>('');
  const [diastolic, setDiastolic] = useState<number | ''>('');
  const [pulse, setPulse] = useState<number | ''>('');
  
  // Waist (รอบเอว)
  const [waist, setWaist] = useState<number | ''>('');
  const [waistUnit, setWaistUnit] = useState<'inch' | 'cm'>('inch');

  // Weight & Height
  const [weight, setWeight] = useState<number | ''>('');
  const [height, setHeight] = useState<number | ''>('');
  
  // Blood Sugar (ระดับน้ำตาลในเลือด DTX mg/dL)
  const [bloodSugar, setBloodSugar] = useState<number | ''>('');
  const [isFasting, setIsFasting] = useState<boolean>(true); // true = งดอาหาร (FBS), false = ไม่งดอาหาร (RBS)
  
  // Notes
  const [notes, setNotes] = useState<string>('');

  const [saveSuccessRecord, setSaveSuccessRecord] = useState<HealthRecord | null>(null);

  useEffect(() => {
    if (selectedCitizenForCheckup) {
      setSelectedCitizen(selectedCitizenForCheckup);
    }
  }, [selectedCitizenForCheckup]);

  // Real-time BMI Calculation & Classification
  const bmiInfo = useMemo(() => {
    const w = typeof weight === 'number' && weight > 0 ? weight : 0;
    const h = typeof height === 'number' && height > 0 ? height : 0;
    if (w > 0 && h > 0) {
      const calculated = calculateBMI(w, h);
      let category = 'ปกติ (สมส่วน)';
      let color = 'bg-[#5D7052]/10 text-[#5D7052] border-[#5D7052]/30';
      if (calculated < 18.5) {
        category = 'น้ำหนักน้อย / ผอม';
        color = 'bg-[#C18C5D]/15 text-[#C18C5D] border-[#C18C5D]/30';
      } else if (calculated >= 23 && calculated <= 24.9) {
        category = 'ท้วม / น้ำหนักเกิน';
        color = 'bg-[#C18C5D]/20 text-[#C18C5D] border-[#C18C5D]/40';
      } else if (calculated >= 25 && calculated <= 29.9) {
        category = 'อ้วนระดับ 1';
        color = 'bg-[#A85448]/15 text-[#A85448] border-[#A85448]/30';
      } else if (calculated >= 30) {
        category = 'อ้วนระดับ 2 (อันตราย)';
        color = 'bg-[#A85448]/25 text-[#A85448] border-[#A85448]/40';
      }
      return { bmi: calculated, category, color };
    }
    return { bmi: 0, category: '', color: 'text-[#78786C]' };
  }, [weight, height]);

  // Citizen search filtering
  const filteredCitizens = useMemo(() => {
    if (!citizenSearch.trim()) return citizens;
    const q = citizenSearch.toLowerCase();
    return citizens.filter(c =>
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      c.houseNo.toLowerCase().includes(q) ||
      c.idCard.includes(q)
    );
  }, [citizens, citizenSearch]);

  const handleSelectCitizen = (cit: Citizen) => {
    setSelectedCitizen(cit);
    setSelectedCitizenForCheckup(cit);
    setIsDropdownOpen(false);
    setCitizenSearch('');
    setSaveSuccessRecord(null);
  };

  const handleSaveCheckup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCitizen) {
      alert('กรุณาเลือกผู้รับการตรวจสุขภาพ');
      return;
    }

    if (systolic === '' && diastolic === '' && pulse === '' && weight === '' && height === '' && bloodSugar === '' && waist === '') {
      alert('กรุณาระบุค่าวัดสุขภาพอย่างน้อย 1 รายการ เช่น ค่าความดัน หรือ น้ำตาลในเลือด หรือ น้ำหนัก');
      return;
    }

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const newRec = addHealthRecord({
      citizenId: selectedCitizen.id,
      citizenName: `${selectedCitizen.prefix} ${selectedCitizen.firstName} ${selectedCitizen.lastName}`,
      citizenAge: selectedCitizen.age,
      gender: selectedCitizen.gender,
      houseNo: selectedCitizen.houseNo,
      moo: selectedCitizen.moo,
      date: screeningDate || getTodayString(),
      time: timeStr,
      systolic: typeof systolic === 'number' ? Number(systolic) : 0,
      diastolic: typeof diastolic === 'number' ? Number(diastolic) : 0,
      pulse: typeof pulse === 'number' ? Number(pulse) : undefined,
      weight: typeof weight === 'number' ? Number(weight) : undefined,
      height: typeof height === 'number' ? Number(height) : undefined,
      bmi: bmiInfo.bmi > 0 ? bmiInfo.bmi : undefined,
      waist: typeof waist === 'number' ? Number(waist) : undefined,
      waistUnit: waist ? waistUnit : undefined,
      bloodSugar: typeof bloodSugar === 'number' ? Number(bloodSugar) : undefined,
      bloodSugarFasting: typeof bloodSugar === 'number' ? isFasting : undefined,
      notes: notes.trim() || undefined,
      examinerName: `${vhvProfile.name} (อสม.)`
    });

    setSaveSuccessRecord(newRec);
    showToast(
      'บันทึกผลการตรวจสุขภาพสำเร็จเรียบร้อย',
      `บันทึกผลการตรวจของ ${selectedCitizen.prefix} ${selectedCitizen.firstName} ${selectedCitizen.lastName} เรียบร้อยแล้ว`,
      'success'
    );
    
    // Clear the input fields completely after saving, keep only date
    setSystolic('');
    setDiastolic('');
    setPulse('');
    setWaist('');
    setWeight('');
    setHeight('');
    setBloodSugar('');
    setIsFasting(true);
    setNotes('');
  };

  const handleResetForm = () => {
    setScreeningDate(getTodayString());
    setSystolic('');
    setDiastolic('');
    setPulse('');
    setWaist('');
    setWeight('');
    setHeight('');
    setBloodSugar('');
    setIsFasting(true);
    setNotes('');
    setSaveSuccessRecord(null);
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-16 w-full max-w-full">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading font-bold text-2xl sm:text-3xl text-[#2C2C24]">
            บันทึกการตรวจสุขภาพ
          </h2>
          <p className="text-xs sm:text-sm text-[#78786C] mt-1">
            อ่านค่าวัดตามหน้าจอเครื่องวัดความดันดิจิทัล (ค่าบน ค่ากลาง ค่าล่าง) และบันทึกผลการตรวจ
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleResetForm}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#DED8CF] text-xs font-semibold text-[#4A4A40] hover:bg-[#F0EBE5] transition-colors whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>ล้างฟอร์ม</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {saveSuccessRecord && (
        <div className="p-4 sm:p-5 bg-[#5D7052]/15 border border-[#5D7052]/40 rounded-3xl shadow-soft flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#5D7052] text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-semibold text-sm sm:text-base text-[#2C2C24]">
                บันทึกผลตรวจเรียบร้อย ✓
              </h4>
              <p className="text-xs text-[#78786C]">
                {saveSuccessRecord.citizenName} • วันที่ {saveSuccessRecord.date}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSaveSuccessRecord(null);
                setSystolic('');
                setDiastolic('');
                setPulse('');
                setWaist('');
                setWeight('');
                setHeight('');
                setBloodSugar('');
                setIsFasting(true);
                setNotes('');
              }}
              className="px-3.5 py-1.5 bg-[#5D7052] hover:bg-[#48573F] text-white rounded-full text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              ตรวจคนนี้อีกครั้ง
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedCitizen) {
                  setSelectedCitizenForProfile(selectedCitizen);
                }
              }}
              className="px-3.5 py-1.5 bg-white hover:bg-[#F0EBE5] text-[#2C2C24] border border-[#DED8CF] rounded-full text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              ดูประวัติ & กราฟ
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('citizens')}
              className="px-3.5 py-1.5 bg-[#F0EBE5] hover:bg-[#E6DCCD] text-[#2C2C24] rounded-full text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              กลับหน้าประชาชน
            </button>
          </div>
        </div>
      )}

      {/* Form Container */}
      <form onSubmit={handleSaveCheckup} className="space-y-6">
        
        {/* Step 1: Citizen Selection Card */}
        <div className="bg-[#FEFEFA] border border-[#DED8CF] rounded-3xl p-5 sm:p-6 shadow-soft">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#5D7052] text-white flex items-center justify-center text-xs font-bold shrink-0">
                1
              </div>
              <h3 className="font-heading font-bold text-base sm:text-lg text-[#2C2C24]">
                เลือกผู้รับการตรวจสุขภาพ
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('citizens')}
              className="text-xs font-semibold text-[#5D7052] hover:underline flex items-center gap-1 self-start sm:self-auto whitespace-nowrap cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>เพิ่มรายชื่อใหม่</span>
            </button>
          </div>

          {/* Citizen Picker Box */}
          <div className="relative">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              
              {/* Searchable Picker Input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#78786C] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={citizenSearch}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={(e) => {
                    setCitizenSearch(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  placeholder={selectedCitizen ? `${selectedCitizen.prefix} ${selectedCitizen.firstName} ${selectedCitizen.lastName} (บ้านเลขที่ ${selectedCitizen.houseNo})` : 'พิมพ์ค้นหาชื่อ หรือบ้านเลขที่...'}
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#DED8CF] rounded-2xl text-xs sm:text-sm text-[#2C2C24] placeholder:text-[#78786C] font-medium focus:ring-2 focus:ring-[#5D7052]/30"
                />
              </div>

              {/* Date of screening - default to today */}
              <div className="sm:w-48">
                <input
                  type="date"
                  value={screeningDate}
                  onChange={(e) => setScreeningDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#DED8CF] rounded-2xl text-xs sm:text-sm text-[#2C2C24] font-medium focus:ring-2 focus:ring-[#5D7052]/30"
                />
              </div>
            </div>

            {/* Dropdown list */}
            {isDropdownOpen && (
              <div className="absolute top-full mt-2 left-0 right-0 max-w-xl bg-[#FDFCF8] border border-[#DED8CF] rounded-2xl shadow-float max-h-60 overflow-y-auto z-30 p-2 divide-y divide-[#DED8CF]/40">
                {filteredCitizens.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#78786C]">
                    <p className="font-medium text-[#2C2C24]">ไม่พบรายชื่อประชาชนในระบบ</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('citizens')}
                      className="mt-1 text-xs text-[#5D7052] font-semibold hover:underline"
                    >
                      + ไปที่หน้าลงทะเบียนประชาชน
                    </button>
                  </div>
                ) : (
                  filteredCitizens.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectCitizen(c)}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-[#F0EBE5] transition-colors flex items-center justify-between text-xs cursor-pointer"
                    >
                      <div>
                        <span className="font-semibold text-[#2C2C24]">
                          {c.prefix} {c.firstName} {c.lastName}
                        </span>
                        <span className="text-[#78786C] ml-2">
                          อายุ {c.age} ปี | บ้านเลขที่ {c.houseNo} {c.moo}
                        </span>
                      </div>
                      {c.chronicDiseases.length > 0 && (
                        <span className="text-[10px] text-[#A85448] font-medium">
                          {c.chronicDiseases[0]}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected Citizen Quick Card */}
          {selectedCitizen && (
            <div className="mt-4 p-3.5 bg-[#FDFCF8] border border-[#DED8CF]/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#4A4A40]">
              <div className="flex items-center gap-3">
                <div 
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-xs shrink-0"
                  style={{ backgroundColor: selectedCitizen.avatarColor || '#5D7052' }}
                >
                  {selectedCitizen.firstName.charAt(0)}
                </div>
                <div>
                  <span className="font-bold text-[#2C2C24] text-sm">
                    {selectedCitizen.prefix} {selectedCitizen.firstName} {selectedCitizen.lastName}
                  </span>
                  <div className="text-[#78786C] flex flex-wrap items-center gap-2 mt-0.5">
                    <span>เพศ: {selectedCitizen.gender}</span>
                    <span>•</span>
                    <span>อายุ: {selectedCitizen.age} ปี</span>
                    <span>•</span>
                    <span>บ้านเลขที่: {selectedCitizen.houseNo} {selectedCitizen.moo}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-[#5D7052]/10 text-[#5D7052] font-semibold whitespace-nowrap">
                  {selectedCitizen.healthRight}
                </span>
                {selectedCitizen.chronicDiseases.length > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-[#A85448]/10 text-[#A85448] font-semibold whitespace-nowrap">
                    โรค: {selectedCitizen.chronicDiseases.join(', ')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Digital Monitor Layout (ค่าบน, ค่ากลาง, ค่าล่าง ตามเครื่อง) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Column (BP Monitor Screen Layout) */}
          <div className="lg:col-span-7 bg-[#FEFEFA] border-2 border-[#5D7052]/30 rounded-3xl p-5 sm:p-6 shadow-card relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#5D7052] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  2
                </div>
                <div>
                  <h3 className="font-heading font-bold text-base sm:text-lg text-[#2C2C24]">
                    ค่าวัดความดันโลหิตและชีพจร (อ่านตามหน้าจอเครื่อง 3 แถว)
                  </h3>
                  <p className="text-[11px] text-[#78786C]">
                    อ่านตัวเลข 3 แถวจากบนลงล่างตามหน้าจอเครื่องวัดความดันดิจิทัล
                  </p>
                </div>
              </div>
            </div>

            {/* Simulated Digital Machine Box */}
            <div className="bg-[#F4F1EA] border-2 border-[#DED8CF] rounded-2xl p-4 sm:p-6 space-y-4">
              
              {/* Row 1: ค่าบน (SYS) */}
              <div className="bg-white border-2 border-[#A85448]/40 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-4 shadow-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-[#A85448] text-white font-bold text-xs">
                      1. แถวบนสุด
                    </span>
                    <span className="font-bold text-sm sm:text-base text-[#2C2C24]">
                      ค่าบน (SYS)
                    </span>
                  </div>
                  <p className="text-[11px] text-[#78786C]">ความดันตัวบน (Systolic mmHg)</p>
                </div>
                <div className="w-32 sm:w-40">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="40"
                    max="260"
                    value={systolic}
                    onChange={(e) => setSystolic(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="กรอกค่าบน"
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DED8CF] rounded-xl font-bold text-xl sm:text-2xl text-[#2C2C24] text-center focus:ring-2 focus:ring-[#A85448]/30"
                  />
                </div>
              </div>

              {/* Row 2: ค่ากลาง (DIA) */}
              <div className="bg-white border-2 border-[#C18C5D]/40 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-4 shadow-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-[#C18C5D] text-white font-bold text-xs">
                      2. แถวกลาง
                    </span>
                    <span className="font-bold text-sm sm:text-base text-[#2C2C24]">
                      ค่ากลาง (DIA)
                    </span>
                  </div>
                  <p className="text-[11px] text-[#78786C]">ความดันตัวล่าง (Diastolic mmHg)</p>
                </div>
                <div className="w-32 sm:w-40">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="30"
                    max="180"
                    value={diastolic}
                    onChange={(e) => setDiastolic(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="กรอกค่ากลาง"
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DED8CF] rounded-xl font-bold text-xl sm:text-2xl text-[#2C2C24] text-center focus:ring-2 focus:ring-[#C18C5D]/30"
                  />
                </div>
              </div>

              {/* Row 3: ค่าล่าง (PUL / ชีพจร) */}
              <div className="bg-white border-2 border-[#5D7052]/40 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-4 shadow-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-[#5D7052] text-white font-bold text-xs">
                      3. แถวล่างสุด
                    </span>
                    <span className="font-bold text-sm sm:text-base text-[#2C2C24]">
                      ค่าล่าง (PUL / ชีพจร)
                    </span>
                  </div>
                  <p className="text-[11px] text-[#78786C]">อัตราการเต้นหัวใจ (ครั้ง/นาที)</p>
                </div>
                <div className="w-32 sm:w-40">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="30"
                    max="220"
                    value={pulse}
                    onChange={(e) => setPulse(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="กรอกค่าชีพจร"
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DED8CF] rounded-xl font-bold text-xl sm:text-2xl text-[#2C2C24] text-center focus:ring-2 focus:ring-[#5D7052]/30"
                  />
                </div>
              </div>

            </div>

            {/* Waist (รอบเอว) */}
            <div className="mt-4 p-4 bg-white border border-[#DED8CF] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#5D7052]/10 text-[#5D7052]">
                  <Ruler className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-xs sm:text-sm text-[#2C2C24]">
                    ค่ารอบเอว (Waist)
                  </span>
                  <p className="text-[11px] text-[#78786C]">วัดระดับสะดือขณะหายใจออกปกติ (ไม่บังคับ)</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  value={waist}
                  onChange={(e) => setWaist(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="กรอกรอบเอว"
                  className="w-28 px-3 py-2 bg-[#FAF8F5] border border-[#DED8CF] rounded-xl text-center font-bold text-base text-[#2C2C24]"
                />
                <div className="flex bg-[#F0EBE5] p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setWaistUnit('inch')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      waistUnit === 'inch' ? 'bg-[#5D7052] text-white shadow-xs' : 'text-[#4A4A40]'
                    }`}
                  >
                    นิ้ว
                  </button>
                  <button
                    type="button"
                    onClick={() => setWaistUnit('cm')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      waistUnit === 'cm' ? 'bg-[#5D7052] text-white shadow-xs' : 'text-[#4A4A40]'
                    }`}
                  >
                    ซม.
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Secondary Column: Weight, Height, Temp, Notes */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Weight & Height */}
            <div className="bg-[#FEFEFA] border border-[#DED8CF] rounded-3xl p-4 sm:p-5 shadow-soft space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2 text-[#5D7052]">
                  <Scale className="w-4 h-4 shrink-0" />
                  <span>น้ำหนัก และ ส่วนสูง</span>
                </div>
                {bmiInfo.bmi > 0 && (
                  <span className="text-[11px] font-bold text-[#5D7052]">
                    BMI {bmiInfo.bmi}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[11px] text-[#78786C] mb-1">น้ำหนัก (กก.)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="กรอกน้ำหนัก"
                    className="w-full px-3 py-2 bg-white border border-[#DED8CF] rounded-xl font-bold text-sm text-[#2C2C24] text-center"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#78786C] mb-1">ส่วนสูง (ซม.)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    value={height}
                    onChange={(e) => setHeight(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="กรอกส่วนสูง"
                    className="w-full px-3 py-2 bg-white border border-[#DED8CF] rounded-xl font-bold text-sm text-[#2C2C24] text-center"
                  />
                </div>
              </div>
            </div>

            {/* Blood Sugar (DTX) with Fasting / Non-Fasting selector */}
            <div className="bg-[#FEFEFA] border border-[#DED8CF] rounded-3xl p-4 sm:p-5 shadow-soft space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-bold text-[#4A4A40]">
                  <Droplet className="w-4 h-4 text-[#C18C5D]" />
                  <span>ค่าน้ำตาลในเลือด (DTX มก./ดล.) (ไม่บังคับ)</span>
                </label>
              </div>

              <input
                type="number"
                inputMode="numeric"
                value={bloodSugar}
                onChange={(e) => setBloodSugar(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="กรอกค่าน้ำตาล เช่น 110"
                className="w-full px-3 py-2 bg-white border border-[#DED8CF] rounded-xl font-bold text-sm text-[#2C2C24] text-center"
              />

              {/* Fasting / Non-Fasting Checkbox & Toggle */}
              <div className="pt-1">
                <label className="block text-[11px] font-bold text-[#78786C] mb-1.5">
                  สถานะการรับประทานอาหาร:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFasting(true)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isFasting
                        ? 'bg-[#5D7052] border-[#5D7052] text-white shadow-xs'
                        : 'bg-white border-[#DED8CF] text-[#78786C] hover:bg-[#F0EBE5]'
                    }`}
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isFasting ? 'text-white' : 'opacity-40'}`} />
                    <span>งดอาหาร (≥ 8 ชม.)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsFasting(false)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      !isFasting
                        ? 'bg-[#C18C5D] border-[#C18C5D] text-white shadow-xs'
                        : 'bg-white border-[#DED8CF] text-[#78786C] hover:bg-[#F0EBE5]'
                    }`}
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 ${!isFasting ? 'text-white' : 'opacity-40'}`} />
                    <span>ไม่งดอาหาร / สุ่มตรวจ</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Observations / Notes */}
            <div className="bg-[#FEFEFA] border border-[#DED8CF] rounded-3xl p-4 shadow-soft space-y-2">
              <label className="block text-xs font-bold text-[#4A4A40]">
                ข้อสังเกตและบันทึกเพิ่มเติมของ อสม.
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="เช่น รับประทานยาสม่ำเสมอ อาการทั่วไปปกติ"
                className="w-full px-3 py-2 bg-white border border-[#DED8CF] rounded-xl text-xs focus:ring-2 focus:ring-[#5D7052]/30"
              />
            </div>

          </div>

        </div>

        {/* Submit Actions */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleResetForm}
            className="px-5 py-2.5 rounded-full border border-[#DED8CF] text-[#4A4A40] hover:bg-[#F0EBE5] font-semibold text-xs transition-colors whitespace-nowrap cursor-pointer"
          >
            ยกเลิก / ล้างข้อมูล
          </button>
          
          <button
            type="submit"
            className="flex items-center gap-2 px-8 py-3 rounded-full bg-[#5D7052] hover:bg-[#48573F] text-white font-bold text-sm shadow-soft hover:shadow-moss-glow transition-all active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>บันทึกผลการตรวจสุขภาพ</span>
          </button>
        </div>

      </form>
    </div>
  );
};

