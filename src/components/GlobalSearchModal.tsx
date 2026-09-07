import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  X, 
  User, 
  FileText, 
  Stethoscope, 
  ChevronRight, 
  Clock, 
  Heart,
  Phone,
  Home,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Citizen, SharedReport } from '../types';
import { formatThaiDate } from '../utils/healthCalculations';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const { 
    citizens, 
    records, 
    sharedReportsReceived, 
    sharedReportsSent,
    setSelectedCitizenForProfile,
    setSelectedCitizenForCheckup,
    setActiveTab,
    setInboxActiveTab
  } = useApp();

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Keyboard shortcut listener (ESC to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Find latest record map for fast lookup
  const latestRecordMap = useMemo(() => {
    const map = new Map<string, { date: string; bp?: string }>();
    records.forEach(r => {
      const existing = map.get(r.citizenId);
      if (!existing || new Date(r.date).getTime() > new Date(existing.date).getTime()) {
        const bpStr = (r.systolic || r.diastolic) ? `${r.systolic || '-'}/${r.diastolic || '-'}` : undefined;
        map.set(r.citizenId, { date: r.date, bp: bpStr });
      }
    });
    return map;
  }, [records]);

  // Filtered Citizens
  const matchingCitizens = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return citizens.filter(c => 
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      (c.idCard && c.idCard.includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.houseNo && c.houseNo.includes(q))
    ).slice(0, 5);
  }, [citizens, query]);

  // Filtered Reports
  const matchingReports = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const allReports = [...sharedReportsReceived, ...sharedReportsSent];
    return allReports.filter(r => 
      (r.title && r.title.toLowerCase().includes(q)) ||
      (r.senderName && r.senderName.toLowerCase().includes(q)) ||
      (r.receiverName && r.receiverName.toLowerCase().includes(q)) ||
      (r.senderPhone && r.senderPhone.includes(q)) ||
      (r.receiverPhone && r.receiverPhone.includes(q))
    ).slice(0, 4);
  }, [sharedReportsReceived, sharedReportsSent, query]);

  if (!isOpen) return null;

  const handleSelectCitizenProfile = (cit: Citizen) => {
    setSelectedCitizenForProfile(cit);
    onClose();
  };

  const handleStartCheckup = (cit: Citizen) => {
    setSelectedCitizenForCheckup(cit);
    setActiveTab('checkup');
    onClose();
  };

  const handleOpenReport = (direction: 'sent' | 'received') => {
    setInboxActiveTab(direction === 'sent' ? 'send' : 'receive');
    setActiveTab('inbox');
    onClose();
  };

  const hasResults = matchingCitizens.length > 0 || matchingReports.length > 0;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-3 sm:p-4 bg-[#2C2C24]/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-[#FDFCF8] border border-[#DED8CF] rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-float relative max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-[#DED8CF]">
          <div className="p-2 rounded-xl bg-[#5D7052]/10 text-[#5D7052] shrink-0">
            <Search className="w-5 h-5" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อ, นามสกุล, เลขบัตร, เบอร์โทร, หรือรายงาน..."
            className="w-full bg-transparent text-sm sm:text-base font-medium text-[#2C2C24] placeholder:text-[#78786C] outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1.5 text-[#78786C] hover:text-[#2C2C24] rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 text-xs font-semibold text-[#78786C] hover:text-[#2C2C24] bg-[#F0EBE5] rounded-lg cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Search Results Area */}
        <div className="overflow-y-auto mt-3 space-y-4 max-h-[60vh] pr-1">
          {!query.trim() ? (
            <div className="py-8 text-center text-xs text-[#78786C] space-y-1">
              <p className="font-medium text-[#2C2C24]">พิมพ์คำค้นหาเพื่อเริ่มต้น</p>
              <p>ค้นหาได้ทั้งชื่อประชาชน, เลขบัตรประชาชน 13 หลัก, เบอร์โทรศัพท์ หรือชื่อรายงาน</p>
            </div>
          ) : !hasResults ? (
            <div className="py-8 text-center text-xs text-[#78786C] space-y-1">
              <p className="font-medium text-[#2C2C24]">ไม่พบข้อมูลที่ตรงกับ "{query}"</p>
              <p>กรุณาตรวจสอบการสะกดหรือลองค้นหาด้วยคำอื่น</p>
            </div>
          ) : (
            <>
              {/* Citizens Results */}
              {matchingCitizens.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-2 text-[11px] font-bold text-[#78786C] uppercase tracking-wider">
                    <span>👥 ประชาชน ({matchingCitizens.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {matchingCitizens.map((cit) => {
                      const latest = latestRecordMap.get(cit.id);
                      return (
                        <div
                          key={cit.id}
                          className="p-3 bg-white hover:bg-[#FAF8F5] border border-[#DED8CF]/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                        >
                          <div 
                            className="flex items-center gap-3 cursor-pointer min-w-0 flex-1"
                            onClick={() => handleSelectCitizenProfile(cit)}
                          >
                            <div 
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0"
                              style={{ backgroundColor: cit.avatarColor || '#5D7052' }}
                            >
                              {cit.firstName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-[#2C2C24] hover:text-[#5D7052] truncate">
                                  {cit.prefix} {cit.firstName} {cit.lastName}
                                </span>
                                <span className="text-[11px] text-[#78786C] shrink-0">
                                  อายุ {cit.age} ปี
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#78786C] mt-0.5">
                                {cit.houseNo && <span>บ้านเลขที่ {cit.houseNo} {cit.moo}</span>}
                                {cit.phone && <span>• โทร {cit.phone}</span>}
                                {latest ? (
                                  <span className="text-[#5D7052] font-medium">
                                    • ตรวจล่าสุด {formatThaiDate(latest.date, false)}
                                  </span>
                                ) : (
                                  <span>• ยังไม่มีการตรวจ</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartCheckup(cit)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-[#5D7052] hover:bg-[#48573F] text-white rounded-full text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                            >
                              <Stethoscope className="w-3.5 h-3.5" />
                              <span>ตรวจสุขภาพ</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectCitizenProfile(cit)}
                              className="p-1.5 text-[#78786C] hover:text-[#2C2C24] hover:bg-[#F0EBE5] rounded-full transition-colors cursor-pointer"
                              title="ดูโปรไฟล์"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Reports Results */}
              {matchingReports.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between px-2 text-[11px] font-bold text-[#78786C] uppercase tracking-wider">
                    <span>📋 รายงาน ({matchingReports.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {matchingReports.map((rep) => {
                      const isSent = sharedReportsSent.some(s => s.id === rep.id);
                      return (
                        <div
                          key={rep.id}
                          onClick={() => handleOpenReport(isSent ? 'sent' : 'received')}
                          className="p-3 bg-white hover:bg-[#FAF8F5] border border-[#DED8CF]/80 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-[#C18C5D]/10 text-[#C18C5D] flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-xs sm:text-sm text-[#2C2C24] truncate">
                                {rep.title}
                              </p>
                              <p className="text-[11px] text-[#78786C] truncate">
                                {isSent ? `ส่งถึง: ${rep.receiverName || rep.receiverPhone}` : `ผู้ส่ง: ${rep.senderName || rep.senderPhone}`} • {formatThaiDate(rep.createdAt || '')}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FAF8F5] border border-[#DED8CF] text-[#78786C]">
                              {isSent ? 'ส่งแล้ว' : 'ได้รับ'}
                            </span>
                            <ArrowRight className="w-4 h-4 text-[#78786C]" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-4 pt-3 border-t border-[#DED8CF] flex items-center justify-between text-[11px] text-[#78786C]">
          <span>กด <kbd className="px-1.5 py-0.5 bg-[#F0EBE5] rounded text-[#2C2C24] font-mono">ESC</kbd> เพื่อปิดหน้าต่าง</span>
          <span>ค้นหาจากข้อมูลภายในระบบ</span>
        </div>
      </div>
    </div>
  );
};
