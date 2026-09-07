import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Stethoscope, 
  Check, 
  CheckSquare, 
  Square, 
  Sparkles, 
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { 
  PATIENT_STATUS_OPTIONS, 
  MEDICAL_EQUIPMENT_OPTIONS,
  getRecommendedTermForStatus,
  getPatientStatusBadge
} from '../utils/patientAssessment';

interface PatientAssessmentSectionProps {
  patientStatus?: string;
  recommendedTerm?: string;
  medicalEquipment?: string[];
  medicalEquipmentOther?: string;
  onChange: (updated: {
    patientStatus: string;
    recommendedTerm: string;
    medicalEquipment: string[];
    medicalEquipmentOther: string;
  }) => void;
}

export const PatientAssessmentSection: React.FC<PatientAssessmentSectionProps> = ({
  patientStatus = '',
  recommendedTerm = '',
  medicalEquipment = [],
  medicalEquipmentOther = '',
  onChange,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>(patientStatus);
  const [customStatusText, setCustomStatusText] = useState<string>(
    patientStatus && !PATIENT_STATUS_OPTIONS.some(o => o.label === patientStatus) ? patientStatus : ''
  );
  const [activeRecommendedTerm, setActiveRecommendedTerm] = useState<string>(
    recommendedTerm || getRecommendedTermForStatus(patientStatus)
  );
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>(medicalEquipment || []);
  const [otherEquipmentText, setOtherEquipmentText] = useState<string>(medicalEquipmentOther || '');

  // Keep internal state synchronized when incoming props change (e.g. modal opens for different citizen)
  useEffect(() => {
    setSelectedStatus(patientStatus || '');
    if (patientStatus && !PATIENT_STATUS_OPTIONS.some(o => o.label === patientStatus && o.id !== 'other')) {
      if (patientStatus !== 'อื่นๆ') {
        setCustomStatusText(patientStatus);
      }
    } else {
      setCustomStatusText('');
    }

    const term = recommendedTerm || getRecommendedTermForStatus(patientStatus);
    setActiveRecommendedTerm(term);
    setSelectedEquipment(medicalEquipment || []);
    setOtherEquipmentText(medicalEquipmentOther || '');
  }, [patientStatus, recommendedTerm, medicalEquipment, medicalEquipmentOther]);

  // Handle status selection
  const handleSelectStatus = (statusLabel: string) => {
    let newStatus = statusLabel;
    let newTerm = '';

    if (statusLabel === 'อื่นๆ') {
      newStatus = customStatusText.trim() || 'อื่นๆ';
      newTerm = customStatusText.trim() || 'อื่นๆ';
    } else {
      newTerm = getRecommendedTermForStatus(statusLabel);
    }

    setSelectedStatus(statusLabel);
    setActiveRecommendedTerm(newTerm);

    onChange({
      patientStatus: newStatus,
      recommendedTerm: newTerm,
      medicalEquipment: selectedEquipment,
      medicalEquipmentOther: otherEquipmentText,
    });
  };

  // Handle custom status input change
  const handleCustomStatusChange = (val: string) => {
    setCustomStatusText(val);
    const finalStatus = val.trim() || 'อื่นๆ';
    setSelectedStatus('อื่นๆ');
    setActiveRecommendedTerm(finalStatus);

    onChange({
      patientStatus: finalStatus,
      recommendedTerm: finalStatus,
      medicalEquipment: selectedEquipment,
      medicalEquipmentOther: otherEquipmentText,
    });
  };

  // Handle equipment toggle
  const handleToggleEquipment = (item: string) => {
    let nextList: string[];
    if (selectedEquipment.includes(item)) {
      nextList = selectedEquipment.filter(e => e !== item);
    } else {
      nextList = [...selectedEquipment, item];
    }

    setSelectedEquipment(nextList);

    // If "อื่นๆ" was unselected, clear other text
    const nextOtherText = nextList.includes('อื่นๆ') ? otherEquipmentText : '';
    if (!nextList.includes('อื่นๆ')) {
      setOtherEquipmentText('');
    }

    onChange({
      patientStatus: selectedStatus === 'อื่นๆ' ? (customStatusText.trim() || 'อื่นๆ') : selectedStatus,
      recommendedTerm: activeRecommendedTerm,
      medicalEquipment: nextList,
      medicalEquipmentOther: nextOtherText,
    });
  };

  // Handle other equipment input change
  const handleOtherEquipmentChange = (val: string) => {
    setOtherEquipmentText(val);
    onChange({
      patientStatus: selectedStatus === 'อื่นๆ' ? (customStatusText.trim() || 'อื่นๆ') : selectedStatus,
      recommendedTerm: activeRecommendedTerm,
      medicalEquipment: selectedEquipment,
      medicalEquipmentOther: val,
    });
  };

  const currentBadge = getPatientStatusBadge(selectedStatus, activeRecommendedTerm);

  return (
    <div className="space-y-6 pt-2">
      {/* 1. Patient Status Evaluation Section */}
      <div className="bg-[#FEFEFA] p-4 sm:p-5 rounded-3xl border border-[#DED8CF] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#DED8CF]/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#5D7052]/15 text-[#5D7052] flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-heading font-bold text-sm sm:text-base text-[#2C2C24]">
                ประเมินสถานะผู้ป่วย
              </h4>
              <p className="text-[11px] text-[#78786C]">
                เลือกสถานะที่สอดคล้องกับสภาพร่างกายและการช่วยเหลือตนเองของผู้รับบริการ
              </p>
            </div>
          </div>

          {selectedStatus && (
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <span className="text-[10px] text-[#78786C]">สถานะที่เลือก:</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${currentBadge.badgeColor}`}>
                {currentBadge.term || selectedStatus}
              </span>
            </div>
          )}
        </div>

        {/* Status Option Cards (Touch-friendly radio style) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {PATIENT_STATUS_OPTIONS.map((option) => {
            const isSelected = selectedStatus === option.label || (option.id === 'other' && selectedStatus === 'อื่นๆ');
            
            return (
              <div
                key={option.id}
                onClick={() => handleSelectStatus(option.label)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 text-left relative ${
                  isSelected
                    ? 'bg-[#5D7052]/8 border-[#5D7052] ring-1 ring-[#5D7052]/30 shadow-xs'
                    : 'bg-white border-[#DED8CF] hover:border-[#5D7052]/40 hover:bg-[#FAF8F5]'
                }`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectStatus(option.label);
                  }
                }}
              >
                <div className="flex items-start gap-2.5">
                  <div className="pt-0.5 shrink-0">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                      isSelected 
                        ? 'border-[#5D7052] bg-[#5D7052]' 
                        : 'border-[#78786C]/40 bg-white'
                    }`}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-xs sm:text-sm text-[#2C2C24] leading-snug">
                      {option.label}
                    </div>
                    <div className="text-[11px] text-[#78786C] mt-0.5 line-clamp-2">
                      {option.description}
                    </div>
                  </div>
                </div>

                {/* Sub-pill: Recommended Term indication */}
                {option.id !== 'other' && (
                  <div className="mt-1 pt-1.5 border-t border-[#DED8CF]/40 flex items-center justify-between text-[11px]">
                    <span className="text-[#78786C]">คำแนะนำ:</span>
                    <span className="font-semibold text-[#5D7052]">
                      &quot;{option.recommendedTerm}&quot;
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* If "อื่นๆ" is chosen, show text input */}
        {selectedStatus === 'อื่นๆ' && (
          <div className="p-3.5 bg-white border border-[#DED8CF] rounded-2xl space-y-1.5 animate-in fade-in">
            <label className="block text-xs font-semibold text-[#2C2C24]">
              ระบุสถานะผู้ป่วยเพิ่มเติม:
            </label>
            <input
              type="text"
              value={customStatusText}
              onChange={(e) => handleCustomStatusChange(e.target.value)}
              placeholder="เช่น ผู้ป่วยพักฟื้นหลังผ่าตัด, อยู่ระหว่างสังเกตอาการ ฯลฯ"
              className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DED8CF] rounded-xl text-xs sm:text-sm text-[#2C2C24] focus:ring-2 focus:ring-[#5D7052]/30 focus:bg-white"
            />
          </div>
        )}

        {/* 2. Recommended Term Display Box (Auto populated) */}
        <div className="p-3 sm:p-4 bg-[#F4F1EA]/80 border border-[#DED8CF] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#C18C5D]/20 text-[#C18C5D] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-[#78786C]">
                คำที่แนะนำใช้เรียกกลุ่มผู้ป่วยนี้
              </div>
              <div className="text-sm font-heading font-bold text-[#2C2C24]">
                {activeRecommendedTerm ? (
                  <span className="text-[#5D7052]">{activeRecommendedTerm}</span>
                ) : (
                  <span className="text-[#78786C] font-normal italic">
                    (เลือกสถานะผู้ป่วยด้านบน ระบบจะแสดงคำแนะนำโดยอัตโนมัติ)
                  </span>
                )}
              </div>
            </div>
          </div>

          {activeRecommendedTerm && (
            <div className="text-[11px] text-[#78786C] bg-white px-3 py-1.5 rounded-xl border border-[#DED8CF]/80 shrink-0">
              ✓ บันทึกจัดกลุ่มให้อัตโนมัติ
            </div>
          )}
        </div>
      </div>

      {/* 3. Medical Equipment Section */}
      <div className="bg-[#FEFEFA] p-4 sm:p-5 rounded-3xl border border-[#DED8CF] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#DED8CF]/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#C18C5D]/15 text-[#C18C5D] flex items-center justify-center">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-heading font-bold text-sm sm:text-base text-[#2C2C24]">
                อุปกรณ์ทางการแพทย์ที่ผู้ป่วยใช้อยู่
              </h4>
              <p className="text-[11px] text-[#78786C]">
                ทำเครื่องหมายถูกหน้ารายการอุปกรณ์ที่ผู้ป่วยกำลังใช้งาน (เลือกได้หลายรายการ)
              </p>
            </div>
          </div>

          {selectedEquipment.length > 0 && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#C18C5D]/15 text-[#C18C5D] border border-[#C18C5D]/30 self-start sm:self-auto">
              ใช้งานอยู่ {selectedEquipment.length} ชนิด
            </span>
          )}
        </div>

        {/* Multi-select Checkboxes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {MEDICAL_EQUIPMENT_OPTIONS.map((item) => {
            const isChecked = selectedEquipment.includes(item);

            return (
              <label
                key={item}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 select-none ${
                  isChecked
                    ? 'bg-[#C18C5D]/10 border-[#C18C5D] shadow-xs'
                    : 'bg-white border-[#DED8CF] hover:bg-[#FAF8F5]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggleEquipment(item)}
                  className="sr-only"
                />
                
                <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                  isChecked
                    ? 'border-[#C18C5D] bg-[#C18C5D] text-white'
                    : 'border-[#78786C]/40 bg-white text-transparent'
                }`}>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>

                <span className={`text-xs font-semibold ${isChecked ? 'text-[#2C2C24]' : 'text-[#4A4A40]'}`}>
                  {item}
                </span>
              </label>
            );
          })}
        </div>

        {/* If "อื่นๆ" is checked, show input for extra equipment */}
        {selectedEquipment.includes('อื่นๆ') && (
          <div className="p-3.5 bg-white border border-[#DED8CF] rounded-2xl space-y-1.5 animate-in fade-in">
            <label className="block text-xs font-semibold text-[#2C2C24]">
              อุปกรณ์ทางการแพทย์อื่น ๆ ที่ใช้อยู่:
            </label>
            <input
              type="text"
              value={otherEquipmentText}
              onChange={(e) => handleOtherEquipmentChange(e.target.value)}
              placeholder="เช่น อุปกรณ์ดูดเสมหะ, เครื่องวัดความดันประจำตัว, รถเข็นช่วยเดิน ฯลฯ"
              className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DED8CF] rounded-xl text-xs sm:text-sm text-[#2C2C24] focus:ring-2 focus:ring-[#C18C5D]/30 focus:bg-white"
            />
          </div>
        )}

        {selectedEquipment.length === 0 && (
          <div className="text-[11px] text-[#78786C] italic bg-[#FAF8F5] p-2.5 rounded-xl border border-[#DED8CF]/60 text-center">
            (หากผู้ป่วยไม่ได้ใช้งานอุปกรณ์ทางการแพทย์ สามารถเว้นว่างไว้ได้)
          </div>
        )}
      </div>
    </div>
  );
};
