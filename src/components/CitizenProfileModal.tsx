import React, { useState } from 'react';
import { 
  X, 
  User, 
  TrendingUp, 
  Calendar, 
  Stethoscope, 
  Printer, 
  Phone, 
  Home, 
  Shield, 
  Heart, 
  Activity,
  Plus,
  Check,
  QrCode
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Citizen, HealthRecord } from '../types';
import { formatThaiDate, formatThaiBirthDate } from '../utils/healthCalculations';
import { getPatientStatusBadge } from '../utils/patientAssessment';
import { PatientAccessSection } from './PatientAccessSection';

interface CitizenProfileModalProps {
  citizen: Citizen | null;
  onClose: () => void;
}

export const CitizenProfileModal: React.FC<CitizenProfileModalProps> = ({ citizen, onClose }) => {
  const { records, setSelectedCitizenForCheckup, setActiveTab, vhvProfile } = useApp();
  const [activeChartTab, setActiveChartTab] = useState<'bp' | 'bmi' | 'pulse'>('bp');

  if (!citizen) return null;

  // Filter records for this citizen sorted by date ascending for charts, and descending for table
  const citizenRecords = records
    .filter(r => r.citizenId === citizen.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const latestRecord = citizenRecords[citizenRecords.length - 1];
  const historyRecordsDescending = [...citizenRecords].reverse();

  const handleStartCheckup = () => {
    setSelectedCitizenForCheckup(citizen);
    setActiveTab('checkup');
    onClose();
  };

  const handlePrintSlip = () => {
    window.print();
  };

  // SVG Chart Dimensions
  const chartWidth = 540;
  const chartHeight = 200;
  const padding = { top: 25, right: 30, bottom: 35, left: 45 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Generate Chart Path Coordinates
  const generateTrendPath = (dataValues: { date: string; value: number }[], minY: number, maxY: number) => {
    if (dataValues.length === 0) return { path: '', points: [] };
    if (dataValues.length === 1) {
      const x = padding.left + innerWidth / 2;
      const y = padding.top + innerHeight - ((dataValues[0].value - minY) / (maxY - minY || 1)) * innerHeight;
      return { path: `M ${x} ${y}`, points: [{ x, y, val: dataValues[0].value, date: dataValues[0].date }] };
    }

    const points = dataValues.map((d, index) => {
      const x = padding.left + (index / (dataValues.length - 1)) * innerWidth;
      const normalizedY = (d.value - minY) / (maxY - minY || 1);
      const clampedY = Math.max(0, Math.min(1, normalizedY));
      const y = padding.top + innerHeight - clampedY * innerHeight;
      return { x, y, val: d.value, date: d.date };
    });

    const path = points.reduce((acc, curr, idx) => {
      return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
    }, '');

    return { path, points };
  };

  // Data for BP Chart
  const bpSysData = citizenRecords.map(r => ({ date: r.date, value: r.systolic }));
  const bpDiaData = citizenRecords.map(r => ({ date: r.date, value: r.diastolic }));
  const bpMinY = 50;
  const bpMaxY = 180;
  const sysTrend = generateTrendPath(bpSysData, bpMinY, bpMaxY);
  const diaTrend = generateTrendPath(bpDiaData, bpMinY, bpMaxY);

  // Data for Pulse Chart
  const pulseData = citizenRecords
    .filter(r => r.pulse && r.pulse > 0)
    .map(r => ({ date: r.date, value: r.pulse! }));
  const pulseMinY = 40;
  const pulseMaxY = 140;
  const pulseTrend = generateTrendPath(pulseData, pulseMinY, pulseMaxY);

  // Data for BMI Chart
  const bmiData = citizenRecords
    .filter(r => r.bmi && r.bmi > 0)
    .map(r => ({ date: r.date, value: r.bmi! }));
  const bmiMinY = 15;
  const bmiMaxY = 35;
  const bmiTrend = generateTrendPath(bmiData, bmiMinY, bmiMaxY);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#2C2C24]/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#FDFCF8] border border-[#DED8CF] rounded-3xl max-w-4xl w-full p-5 sm:p-8 shadow-float relative max-h-[92vh] overflow-y-auto flex flex-col justify-between">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-[#78786C] hover:text-[#2C2C24] hover:bg-[#F0EBE5] rounded-full transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="space-y-6">
          
          {/* Header Profile Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DED8CF]">
            <div className="flex items-center gap-3 sm:gap-4">
              <div 
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-md shrink-0"
                style={{ backgroundColor: citizen.avatarColor || '#5D7052' }}
              >
                {citizen.firstName.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-bold text-xl sm:text-2xl text-[#2C2C24]">
                    {citizen.prefix} {citizen.firstName} {citizen.lastName}
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#78786C] mt-1">
                  <span>เลขบัตร: {citizen.idCard}</span>
                  <span>•</span>
                  <span>เพศ {citizen.gender}</span>
                  <span>•</span>
                  <span className="font-semibold text-[#2C2C24]">อายุ {citizen.age} ปี</span>
                  {citizen.birthDate && (
                    <>
                      <span>•</span>
                      <span>วันเกิด: {formatThaiBirthDate(citizen.birthDate)}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>บ้านเลขที่ {citizen.houseNo} {citizen.moo}</span>
                </div>
              </div>
            </div>

            {/* Quick Action in Header */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const el = document.getElementById('patient-access-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="p-2 sm:px-3 sm:py-2 bg-white hover:bg-[#F0EBE5] border border-[#5D7052]/40 rounded-full text-xs font-semibold text-[#5D7052] flex items-center gap-1.5 transition-colors cursor-pointer"
                title="สิทธิ์ดูผลตรวจสุขภาพ"
              >
                <QrCode className="w-4 h-4" />
                <span className="hidden sm:inline">สิทธิ์ดูผลตรวจ</span>
              </button>

              <button
                onClick={handlePrintSlip}
                className="p-2 sm:px-3 sm:py-2 bg-white hover:bg-[#F0EBE5] border border-[#DED8CF] rounded-full text-xs font-semibold text-[#4A4A40] flex items-center gap-1.5 transition-colors cursor-pointer"
                title="พิมพ์ประวัติสุขภาพ"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">พิมพ์สลิป</span>
              </button>

              <button
                onClick={handleStartCheckup}
                className="flex items-center gap-1.5 bg-[#5D7052] hover:bg-[#48573F] text-white px-4 py-2 rounded-full text-xs font-semibold shadow-soft transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>บันทึกการตรวจใหม่</span>
              </button>
            </div>
          </div>

          {/* Citizen Background Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-[#FEFEFA] border border-[#DED8CF]/80 rounded-2xl">
              <span className="text-[11px] text-[#78786C] block">สิทธิการรักษา:</span>
              <span className="font-semibold text-[#2C2C24]">{citizen.healthRight}</span>
            </div>
            <div className="p-3 bg-[#FEFEFA] border border-[#DED8CF]/80 rounded-2xl">
              <span className="text-[11px] text-[#78786C] block">โรคประจำตัว:</span>
              <span className="font-semibold text-[#A85448]">
                {citizen.chronicDiseases && citizen.chronicDiseases.length > 0 ? citizen.chronicDiseases.join(', ') : 'ไม่มี'}
              </span>
            </div>
            <div className="p-3 bg-[#FEFEFA] border border-[#DED8CF]/80 rounded-2xl">
              <span className="text-[11px] text-[#78786C] block">ประวัติแพ้ยา/อาหาร:</span>
              <span className="font-semibold text-[#C18C5D]">{citizen.allergies || 'ไม่มี'}</span>
            </div>
          </div>

          {/* Patient Status Assessment & Medical Equipment Display Card */}
          {(() => {
            const badgeInfo = getPatientStatusBadge(citizen.patientStatus, citizen.recommendedTerm);
            const hasEquipment = Boolean(citizen.medicalEquipment && citizen.medicalEquipment.length > 0);

            return (
              <div className="bg-[#FEFEFA] border border-[#DED8CF] rounded-2xl p-4 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DED8CF]/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#5D7052]/15 text-[#5D7052] flex items-center justify-center shrink-0">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] text-[#78786C] block font-medium">สถานะผู้ป่วยและการดูแล:</span>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        {badgeInfo.hasStatus ? (
                          <>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeInfo.badgeColor}`}>
                              {badgeInfo.term || badgeInfo.label}
                            </span>
                            {badgeInfo.term !== badgeInfo.label && (
                              <span className="text-xs text-[#78786C]">
                                ({badgeInfo.label})
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-[#78786C] italic">
                            ยังไม่ได้ระบุสถานะผู้ป่วย
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 text-[11px] text-[#78786C] mb-1.5 font-medium">
                    <Stethoscope className="w-3.5 h-3.5 text-[#C18C5D]" />
                    <span>อุปกรณ์ทางการแพทย์ที่ผู้ป่วยใช้อยู่:</span>
                  </div>

                  {hasEquipment ? (
                    <div className="flex flex-wrap gap-1.5">
                      {citizen.medicalEquipment!.map((eq, idx) => {
                        const displayText = eq === 'อื่นๆ' && citizen.medicalEquipmentOther
                          ? `อื่นๆ: ${citizen.medicalEquipmentOther}`
                          : eq;
                        return (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-[#C18C5D]/15 text-[#C18C5D] border border-[#C18C5D]/30"
                          >
                            <Check className="w-3 h-3 stroke-[2.5]" />
                            <span>{displayText}</span>
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-[#78786C] italic bg-[#FAF8F5] px-3 py-2 rounded-xl border border-[#DED8CF]/40">
                      ไม่มีข้อมูลอุปกรณ์ทางการแพทย์
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Section: Patient Self-Inspection Access (QR Code + PIN) */}
          <div id="patient-access-section">
            <PatientAccessSection citizen={citizen} vhvProfile={vhvProfile} />
          </div>

          {/* Section: Health Trend Chart */}
          <div className="bg-[#FEFEFA] border border-[#DED8CF] rounded-3xl p-4 sm:p-6 shadow-soft">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#5D7052]" />
                <h4 className="font-heading font-bold text-base text-[#2C2C24]">
                  กราฟแนวโน้มสุขภาพย้อนหลัง
                </h4>
              </div>

              {/* Chart Switcher */}
              <div className="flex items-center gap-1 bg-[#F0EBE5] p-1 rounded-full text-xs">
                <button
                  onClick={() => setActiveChartTab('bp')}
                  className={`px-3 py-1 rounded-full font-medium transition-all cursor-pointer ${
                    activeChartTab === 'bp' ? 'bg-[#5D7052] text-white shadow-xs' : 'text-[#4A4A40]'
                  }`}
                >
                  ความดันโลหิต
                </button>
                <button
                  onClick={() => setActiveChartTab('pulse')}
                  className={`px-3 py-1 rounded-full font-medium transition-all cursor-pointer ${
                    activeChartTab === 'pulse' ? 'bg-[#C18C5D] text-white shadow-xs' : 'text-[#4A4A40]'
                  }`}
                >
                  ชีพจร (หัวใจ)
                </button>
                <button
                  onClick={() => setActiveChartTab('bmi')}
                  className={`px-3 py-1 rounded-full font-medium transition-all cursor-pointer ${
                    activeChartTab === 'bmi' ? 'bg-[#4A4A40] text-white shadow-xs' : 'text-[#4A4A40]'
                  }`}
                >
                  ดัชนีมวลกาย (BMI)
                </button>
              </div>
            </div>

            {citizenRecords.length === 0 ? (
              <div className="text-center py-10 text-xs text-[#78786C]">
                ยังไม่มีข้อมูลการตรวจสุขภาพสำหรับสร้างกราฟ
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <div className="min-w-[480px]">
                  {/* SVG Chart Render */}
                  <svg 
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
                    className="w-full h-48 overflow-visible"
                  >
                    {/* Background Grid Lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                      const y = padding.top + ratio * innerHeight;
                      return (
                        <line
                          key={i}
                          x1={padding.left}
                          y1={y}
                          x2={chartWidth - padding.right}
                          y2={y}
                          stroke="#DED8CF"
                          strokeDasharray="4 4"
                          strokeOpacity={0.6}
                        />
                      );
                    })}

                    {/* Chart Content based on tab */}
                    {activeChartTab === 'bp' && (
                      <>
                        {/* Reference normal limit lines */}
                        <line
                          x1={padding.left}
                          y1={padding.top + innerHeight - ((140 - bpMinY) / (bpMaxY - bpMinY)) * innerHeight}
                          x2={chartWidth - padding.right}
                          y2={padding.top + innerHeight - ((140 - bpMinY) / (bpMaxY - bpMinY)) * innerHeight}
                          stroke="#A85448"
                          strokeWidth={1}
                          strokeOpacity={0.4}
                        />
                        <text
                          x={chartWidth - padding.right + 4}
                          y={padding.top + innerHeight - ((140 - bpMinY) / (bpMaxY - bpMinY)) * innerHeight + 3}
                          fill="#A85448"
                          fontSize="9"
                          fontWeight="bold"
                        >
                          140
                        </text>

                        {/* Systolic Line */}
                        <path
                          d={sysTrend.path}
                          fill="none"
                          stroke="#A85448"
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {sysTrend.points.map((p, idx) => (
                          <g key={`sys-${idx}`}>
                            <circle cx={p.x} cy={p.y} r={4.5} fill="#A85448" stroke="#FFFFFF" strokeWidth={2} />
                            <text x={p.x} y={p.y - 8} textAnchor="middle" fill="#A85448" fontSize="10" fontWeight="bold">
                              {p.val}
                            </text>
                            <text x={p.x} y={chartHeight - 10} textAnchor="middle" fill="#78786C" fontSize="9">
                              {formatThaiDate(p.date, false)}
                            </text>
                          </g>
                        ))}

                        {/* Diastolic Line */}
                        <path
                          d={diaTrend.path}
                          fill="none"
                          stroke="#5D7052"
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {diaTrend.points.map((p, idx) => (
                          <g key={`dia-${idx}`}>
                            <circle cx={p.x} cy={p.y} r={4.5} fill="#5D7052" stroke="#FFFFFF" strokeWidth={2} />
                            <text x={p.x} y={p.y + 16} textAnchor="middle" fill="#5D7052" fontSize="10" fontWeight="bold">
                              {p.val}
                            </text>
                          </g>
                        ))}
                      </>
                    )}

                    {activeChartTab === 'pulse' && (
                      <>
                        <path
                          d={pulseTrend.path}
                          fill="none"
                          stroke="#C18C5D"
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {pulseTrend.points.map((p, idx) => (
                          <g key={`pulse-${idx}`}>
                            <circle cx={p.x} cy={p.y} r={4.5} fill="#C18C5D" stroke="#FFFFFF" strokeWidth={2} />
                            <text x={p.x} y={p.y - 8} textAnchor="middle" fill="#C18C5D" fontSize="10" fontWeight="bold">
                              {p.val} bpm
                            </text>
                            <text x={p.x} y={chartHeight - 10} textAnchor="middle" fill="#78786C" fontSize="9">
                              {formatThaiDate(p.date, false)}
                            </text>
                          </g>
                        ))}
                      </>
                    )}

                    {activeChartTab === 'bmi' && (
                      <>
                        <path
                          d={bmiTrend.path}
                          fill="none"
                          stroke="#4A4A40"
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {bmiTrend.points.map((p, idx) => (
                          <g key={`bmi-${idx}`}>
                            <circle cx={p.x} cy={p.y} r={4.5} fill="#4A4A40" stroke="#FFFFFF" strokeWidth={2} />
                            <text x={p.x} y={p.y - 8} textAnchor="middle" fill="#2C2C24" fontSize="10" fontWeight="bold">
                              BMI {p.val}
                            </text>
                            <text x={p.x} y={chartHeight - 10} textAnchor="middle" fill="#78786C" fontSize="9">
                              {formatThaiDate(p.date, false)}
                            </text>
                          </g>
                        ))}
                      </>
                    )}
                  </svg>

                  {/* Chart Legend */}
                  <div className="mt-3 pt-2 border-t border-[#DED8CF]/40 flex items-center justify-center gap-6 text-xs text-[#78786C]">
                    {activeChartTab === 'bp' && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full bg-[#A85448]" />
                          <span>ความดันตัวบน (Systolic mmHg)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full bg-[#5D7052]" />
                          <span>ความดันตัวล่าง (Diastolic mmHg)</span>
                        </div>
                      </>
                    )}
                    {activeChartTab === 'pulse' && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-[#C18C5D]" />
                        <span>อัตราชีพจร / การเต้นหัวใจ (bpm)</span>
                      </div>
                    )}
                    {activeChartTab === 'bmi' && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-[#4A4A40]" />
                        <span>ดัชนีมวลกาย (BMI kg/m²)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section: Historical Health Checkup Table */}
          <div className="bg-[#FEFEFA] border border-[#DED8CF] rounded-3xl p-4 sm:p-6 shadow-soft">
            <h4 className="font-heading font-bold text-base text-[#2C2C24] mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#5D7052]" />
              <span>ประวัติการตรวจสุขภาพที่ผ่านมา ({citizenRecords.length} ครั้ง)</span>
            </h4>

            {citizenRecords.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#78786C]">
                ยังไม่มีรายการบันทึกการตรวจสุขภาพ
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F0EBE5] text-[#2C2C24] font-semibold border-b border-[#DED8CF]">
                    <tr>
                      <th className="py-2.5 px-3">วันที่ตรวจ</th>
                      <th className="py-2.5 px-3">ความดัน (Sys/Dia)</th>
                      <th className="py-2.5 px-3">ชีพจร (Pulse)</th>
                      <th className="py-2.5 px-3">รอบเอว</th>
                      <th className="py-2.5 px-3">น้ำหนัก/ส่วนสูง (BMI)</th>
                      <th className="py-2.5 px-3">น้ำตาล (mg/dL)</th>
                      <th className="py-2.5 px-3">บันทึกของ อสม.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DED8CF]/60 text-[#4A4A40]">
                    {historyRecordsDescending.map((rec) => {
                      return (
                        <tr key={rec.id} className="hover:bg-[#FDFCF8]">
                          <td className="py-2.5 px-3 font-semibold text-[#2C2C24]">
                            {formatThaiDate(rec.date)}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-[#2C2C24]">
                            {rec.systolic}/{rec.diastolic} mmHg
                          </td>
                          <td className="py-2.5 px-3 text-[#5D7052] font-semibold">
                            {rec.pulse ? `${rec.pulse} bpm` : '-'}
                          </td>
                          <td className="py-2.5 px-3">
                            {rec.waist ? `${rec.waist} ${rec.waistUnit === 'inch' ? 'นิ้ว' : 'ซม.'}` : '-'}
                          </td>
                          <td className="py-2.5 px-3">
                            {rec.weight ? `${rec.weight} กก.` : '-'} {rec.height ? `/ ${rec.height} ซม.` : ''} {rec.bmi ? <span className="font-semibold">({rec.bmi})</span> : ''}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-[#C18C5D]">
                            {rec.bloodSugar ? (
                              <div className="flex flex-col">
                                <span>{rec.bloodSugar} mg/dL</span>
                                <span className={`text-[10px] font-medium ${rec.bloodSugarFasting === false ? 'text-[#C18C5D]' : 'text-[#5D7052]'}`}>
                                  {rec.bloodSugarFasting === false ? '(ไม่งดอาหาร)' : '(งดอาหาร)'}
                                </span>
                              </div>
                            ) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] max-w-xs">
                            <p className="text-[#2C2C24]">{rec.notes || '-'}</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-[#DED8CF] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-[#F0EBE5] hover:bg-[#E6DCCD] text-[#2C2C24] rounded-full text-xs font-semibold transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
};
