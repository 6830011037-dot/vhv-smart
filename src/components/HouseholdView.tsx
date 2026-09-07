import React, { useState, useMemo } from 'react';
import { 
  Home, 
  Search, 
  Users, 
  Phone, 
  Calendar, 
  TrendingUp,
  MapPin,
  X
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Citizen, HouseholdSummary } from '../types';
import { formatThaiDate } from '../utils/healthCalculations';

export const HouseholdView: React.FC = () => {
  const { 
    households, 
    citizens, 
    records, 
    setActiveTab, 
    setSelectedCitizenForProfile,
    setSelectedCitizenForCheckup 
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'visited' | 'unvisited'>('all');

  const filteredHouseholds = useMemo(() => {
    return households.filter(h => {
      const q = searchQuery.trim().toLowerCase();
      const matchSearch = 
        !q ||
        h.houseNo.toLowerCase().includes(q) ||
        h.moo.toLowerCase().includes(q) ||
        h.members.some(m => 
          m.firstName.toLowerCase().includes(q) || 
          m.lastName.toLowerCase().includes(q) ||
          m.phone.includes(q)
        );

      if (!matchSearch) return false;

      if (filterMode === 'visited') {
        return !!h.latestCheckupDate;
      }
      if (filterMode === 'unvisited') {
        return !h.latestCheckupDate;
      }

      return true;
    });
  }, [households, searchQuery, filterMode]);

  return (
    <div className="space-y-6 pb-16">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading font-bold text-2xl sm:text-3xl text-[#2C2C24]">
            ระบบมุมมองหลังคาเรือน
          </h2>
          <p className="text-xs sm:text-sm text-[#78786C] mt-1">
            จัดกลุ่มสมาชิกครอบครัวตามบ้านเลขที่ เพื่อความสะดวกในการวางแผนลงพื้นที่เยี่ยมบ้าน ({households.length} หลังคาเรือน)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#FEFEFA] border border-[#DED8CF] px-4 py-2 rounded-2xl shadow-xs text-xs">
            <span className="text-[#78786C]">จำนวนลูกบ้านทั้งหมด: </span>
            <span className="font-bold text-[#5D7052]">{citizens.length} คน</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-[#FEFEFA] border border-[#DED8CF] rounded-3xl p-4 sm:p-5 shadow-soft flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#78786C] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาบ้านเลขที่ หรือชื่อสมาชิกในบ้าน..."
            className="w-full pl-9 pr-4 py-2 bg-white/70 border border-[#DED8CF] rounded-full text-xs sm:text-sm text-[#2C2C24] placeholder:text-[#78786C] focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#78786C] hover:text-[#2C2C24]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-[#F0EBE5]/70 p-1 rounded-full border border-[#DED8CF]/60 self-start sm:self-auto">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              filterMode === 'all' ? 'bg-[#5D7052] text-white shadow-xs' : 'text-[#4A4A40]'
            }`}
          >
            ทั้งหมด ({households.length})
          </button>
          <button
            onClick={() => setFilterMode('visited')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              filterMode === 'visited' ? 'bg-[#5D7052] text-white shadow-xs' : 'text-[#4A4A40]'
            }`}
          >
            มีประวัติตรวจแล้ว
          </button>
          <button
            onClick={() => setFilterMode('unvisited')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              filterMode === 'unvisited' ? 'bg-[#5D7052] text-white shadow-xs' : 'text-[#4A4A40]'
            }`}
          >
            ยังไม่มีประวัติตรวจ
          </button>
        </div>
      </div>

      {/* Households Grid */}
      {filteredHouseholds.length === 0 ? (
        <div className="text-center py-16 bg-[#FEFEFA] border border-dashed border-[#DED8CF] rounded-3xl p-8 shadow-soft">
          <Home className="w-12 h-12 text-[#78786C] mx-auto mb-3 opacity-60" />
          <h4 className="font-heading font-bold text-lg text-[#2C2C24]">
            ไม่พบข้อมูลบ้านเลขที่ที่ค้นหา
          </h4>
          <p className="text-xs text-[#78786C] mt-1">
            ลองปรับเปลี่ยนคำค้นหา หรือเพิ่มรายชื่อประชาชนพร้อมระบุบ้านเลขที่
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredHouseholds.map((hh) => {
            return (
              <div
                key={`${hh.houseNo}-${hh.moo}`}
                className="bg-[#FEFEFA] border border-[#DED8CF] rounded-3xl p-5 sm:p-6 shadow-soft hover:shadow-card hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Household Title */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm bg-[#5D7052]/10 text-[#5D7052]">
                        <Home className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-heading font-bold text-lg text-[#2C2C24] leading-tight">
                          บ้านเลขที่ {hh.houseNo}
                        </h3>
                        <p className="text-xs text-[#78786C] flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          <span>{hh.moo} {hh.villageName}</span>
                        </p>
                      </div>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F0EBE5] text-[#2C2C24] border border-[#DED8CF]">
                      {hh.memberCount} สมาชิก
                    </span>
                  </div>

                  {/* Family Members in this house */}
                  <div className="space-y-2 mb-4">
                    <span className="text-[11px] font-semibold text-[#78786C] block">
                      รายชื่อสมาชิกในบ้าน:
                    </span>
                    <div className="space-y-1.5">
                      {hh.members.map((member) => {
                        return (
                          <div
                            key={member.id}
                            className="p-2.5 bg-white rounded-xl border border-[#DED8CF]/70 flex items-center justify-between gap-2 hover:border-[#5D7052] transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-semibold text-[#2C2C24] truncate">
                                {member.prefix} {member.firstName} {member.lastName}
                              </span>
                              <span className="text-[11px] text-[#78786C] shrink-0">
                                ({member.age} ปี)
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => setSelectedCitizenForProfile(member)}
                                className="p-1 text-[#5D7052] hover:bg-[#5D7052]/10 rounded-full"
                                title="ดูประวัติสุขภาพ"
                              >
                                <TrendingUp className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Footer of household card */}
                <div className="pt-3 border-t border-[#DED8CF]/60 flex items-center justify-between text-xs text-[#78786C]">
                  <span>
                    ตรวจล่าสุด: {hh.latestCheckupDate ? formatThaiDate(hh.latestCheckupDate, false) : 'ยังไม่มี'}
                  </span>
                  
                  {hh.members[0]?.phone && (
                    <a
                      href={`tel:${hh.members[0].phone}`}
                      className="p-1.5 bg-[#F0EBE5] hover:bg-[#E6DCCD] text-[#4A4A40] rounded-full transition-colors"
                      title={`โทรติดต่อ: ${hh.members[0].phone}`}
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

