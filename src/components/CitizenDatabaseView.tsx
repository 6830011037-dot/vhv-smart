import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  UserPlus, 
  Phone, 
  Home, 
  Edit, 
  Trash2, 
  Stethoscope, 
  TrendingUp, 
  X, 
  Check, 
  AlertCircle,
  LayoutGrid,
  List,
  Shield,
  Calendar,
  Plus,
  Tag,
  Activity,
  QrCode
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from './ToastNotification';
import { Citizen, HealthRight, HealthRecord } from '../types';
import { formatThaiDate, formatThaiBirthDate, calculateAgeFromBirthDate } from '../utils/healthCalculations';
import { PatientAssessmentSection } from './PatientAssessmentSection';
import { getPatientStatusBadge } from '../utils/patientAssessment';

const DEFAULT_DISEASE_HISTORY = [
  'ความดันโลหิตสูง',
  'เบาหวาน',
  'ไขมันในเลือดสูง',
  'โรคไตเรื้อรัง',
  'โรคหัวใจ',
  'เกาต์',
  'หอบหืด',
  'ถุงลมโป่งพอง',
  'ไทรอยด์',
  'อัมพฤกษ์/อัมพาต',
  'มะเร็ง'
];

export const CitizenDatabaseView: React.FC = () => {
  const { 
    citizens, 
    addCitizen, 
    updateCitizen, 
    deleteCitizen, 
    records,
    setActiveTab, 
    setSelectedCitizenForProfile,
    setSelectedCitizenForCheckup 
  } = useApp();

  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'elderly' | 'chronic'>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedEquipmentFilter, setSelectedEquipmentFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  
  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCitizenId, setEditingCitizenId] = useState<string | null>(null);

  // Disease History Memory State
  const [diseaseHistory, setDiseaseHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('vhv_disease_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_DISEASE_HISTORY;
  });

  // Selected diseases chips in form
  const [selectedDiseases, setSelectedDiseases] = useState<string[]>([]);
  const [diseaseInputText, setDiseaseInputText] = useState('');

  // Form Fields State - empty by default for all inputs
  const [formData, setFormData] = useState({
    prefix: 'นาย' as Citizen['prefix'],
    firstName: '',
    lastName: '',
    idCard: '',
    gender: 'ชาย' as Citizen['gender'],
    birthDate: '',
    age: '' as number | '',
    phone: '',
    houseNo: '',
    moo: '',
    villageName: '',
    healthRight: 'บัตรทอง (UC/สปสช.)' as HealthRight,
    allergies: '',
    emergencyContact: '',
    emergencyPhone: '',
    notes: '',
    patientStatus: '',
    recommendedTerm: '',
    medicalEquipment: [] as string[],
    medicalEquipmentOther: '',
  });

  const [formError, setFormError] = useState<string | null>(null);

  const saveToDiseaseHistory = (newDiseases: string[]) => {
    const updated = Array.from(new Set([...diseaseHistory, ...newDiseases.filter(Boolean)]));
    setDiseaseHistory(updated);
    try {
      localStorage.setItem('vhv_disease_history', JSON.stringify(updated));
    } catch (e) {}
  };

  const handleAddDiseaseTag = (diseaseName: string) => {
    const trimmed = diseaseName.trim().replace(/,/g, '');
    if (!trimmed) return;
    if (!selectedDiseases.includes(trimmed)) {
      const nextList = [...selectedDiseases, trimmed];
      setSelectedDiseases(nextList);
      saveToDiseaseHistory([trimmed]);
    }
    setDiseaseInputText('');
  };

  const handleRemoveDiseaseTag = (diseaseToRemove: string) => {
    setSelectedDiseases(prev => prev.filter(d => d !== diseaseToRemove));
  };

  const handleDiseaseInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === ',') {
      e.preventDefault();
      if (diseaseInputText.trim()) {
        handleAddDiseaseTag(diseaseInputText);
      }
    }
  };

  // Filtered disease suggestions based on what user is typing
  const matchingDiseaseSuggestions = useMemo(() => {
    if (!diseaseInputText.trim()) return [];
    const query = diseaseInputText.trim().toLowerCase();
    return diseaseHistory.filter(
      d => d.toLowerCase().includes(query) && !selectedDiseases.includes(d)
    );
  }, [diseaseHistory, diseaseInputText, selectedDiseases]);

  // Map latest record for last checkup info
  const latestRecordsMap = useMemo(() => {
    const map = new Map<string, HealthRecord>();
    records.forEach(r => {
      const existing = map.get(r.citizenId);
      if (!existing || new Date(r.date).getTime() > new Date(existing.date).getTime()) {
        map.set(r.citizenId, r);
      }
    });
    return map;
  }, [records]);

  // Filtered & Searched Citizens
  const filteredCitizens = useMemo(() => {
    return citizens.filter(c => {
      const query = searchQuery.trim().toLowerCase();
      const matchQuery = 
        !query ||
        c.firstName.toLowerCase().includes(query) ||
        c.lastName.toLowerCase().includes(query) ||
        c.houseNo.toLowerCase().includes(query) ||
        c.idCard.includes(query) ||
        c.phone.includes(query);

      if (!matchQuery) return false;

      // Demographic / Chronic filter
      if (selectedFilter === 'elderly' && c.age < 60) {
        return false;
      }
      if (selectedFilter === 'chronic' && (!c.chronicDiseases || c.chronicDiseases.length === 0)) {
        return false;
      }

      // Patient Status Filter
      if (selectedStatusFilter !== 'all') {
        const status = c.patientStatus || '';
        const rec = c.recommendedTerm || '';

        if (selectedStatusFilter === 'ผู้ป่วยทั่วไป') {
          const isSelf = rec === 'ผู้ป่วยทั่วไป' || status.includes('ช่วยเหลือตนเองได้');
          if (!isSelf) return false;
        } else if (selectedStatusFilter === 'ผู้ป่วยติดบ้าน') {
          const isHomebound = rec === 'ผู้ป่วยติดบ้าน' || status.includes('ภาวะพึ่งพิง') || status.includes('ติดบ้าน');
          if (!isHomebound) return false;
        } else if (selectedStatusFilter === 'ผู้ป่วยติดเตียง') {
          const isBedridden = rec === 'ผู้ป่วยติดเตียง' || status.includes('นอนอยู่บนเตียง') || status.includes('ติดเตียง');
          if (!isBedridden) return false;
        } else if (selectedStatusFilter === 'ผู้ป่วยพิการ') {
          const isDisabled = rec.includes('พิการ') || status.includes('พิการ');
          if (!isDisabled) return false;
        } else if (selectedStatusFilter === 'ผู้ป่วยที่ยังมีอาการ') {
          const isSymptomatic = rec.includes('มีอาการ') || status.includes('ยังมีอาการเจ็บป่วย');
          if (!isSymptomatic) return false;
        } else {
          if (rec !== selectedStatusFilter && status !== selectedStatusFilter) return false;
        }
      }

      // Medical Equipment Filter
      if (selectedEquipmentFilter !== 'all') {
        if (selectedEquipmentFilter === 'has_equipment') {
          if (!c.medicalEquipment || c.medicalEquipment.length === 0) return false;
        } else {
          const matchEq = c.medicalEquipment?.some(eq =>
            eq.toLowerCase().includes(selectedEquipmentFilter.toLowerCase())
          );
          if (!matchEq) return false;
        }
      }

      return true;
    });
  }, [citizens, searchQuery, selectedFilter, selectedStatusFilter, selectedEquipmentFilter]);

  const openAddModal = () => {
    setEditingCitizenId(null);
    setFormData({
      prefix: 'นาย',
      firstName: '',
      lastName: '',
      idCard: '',
      gender: 'ชาย',
      birthDate: '',
      age: '',
      phone: '',
      houseNo: '',
      moo: '',
      villageName: '',
      healthRight: 'บัตรทอง (UC/สปสช.)',
      allergies: '',
      emergencyContact: '',
      emergencyPhone: '',
      notes: '',
      patientStatus: '',
      recommendedTerm: '',
      medicalEquipment: [],
      medicalEquipmentOther: '',
    });
    setSelectedDiseases([]);
    setDiseaseInputText('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (citizen: Citizen) => {
    setEditingCitizenId(citizen.id);
    const currentAge = citizen.birthDate 
      ? calculateAgeFromBirthDate(citizen.birthDate) 
      : citizen.age;
    setFormData({
      prefix: citizen.prefix,
      firstName: citizen.firstName,
      lastName: citizen.lastName,
      idCard: citizen.idCard,
      gender: citizen.gender,
      birthDate: citizen.birthDate || '',
      age: typeof currentAge === 'number' ? currentAge : citizen.age,
      phone: citizen.phone,
      houseNo: citizen.houseNo,
      moo: citizen.moo,
      villageName: citizen.villageName,
      healthRight: citizen.healthRight,
      allergies: citizen.allergies || '',
      emergencyContact: citizen.emergencyContact || '',
      emergencyPhone: citizen.emergencyPhone || '',
      notes: citizen.notes || '',
      patientStatus: citizen.patientStatus || '',
      recommendedTerm: citizen.recommendedTerm || '',
      medicalEquipment: citizen.medicalEquipment || [],
      medicalEquipmentOther: citizen.medicalEquipmentOther || '',
    });
    setSelectedDiseases(citizen.chronicDiseases || []);
    setDiseaseInputText('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleBirthDateChange = (dateVal: string) => {
    if (dateVal) {
      const calculatedAge = calculateAgeFromBirthDate(dateVal);
      setFormData(prev => ({
        ...prev,
        birthDate: dateVal,
        age: calculatedAge
      }));
    } else {
      setFormData(prev => ({ 
        ...prev, 
        birthDate: '', 
        age: ''
      }));
    }
  };

  const handleSaveCitizen = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.houseNo.trim()) {
      setFormError('กรุณากรอกชื่อ นามสกุล และบ้านเลขที่ให้ครบถ้วน');
      return;
    }

    // Combine selected diseases plus any pending typed disease
    let finalDiseases = [...selectedDiseases];
    if (diseaseInputText.trim()) {
      const extra = diseaseInputText.trim().replace(/,/g, '');
      if (extra && !finalDiseases.includes(extra)) {
        finalDiseases.push(extra);
      }
    }

    // Save newly introduced diseases to persistent history
    saveToDiseaseHistory(finalDiseases);

    const calculatedAge = typeof formData.age === 'number' && formData.age >= 0 
      ? formData.age 
      : formData.birthDate 
      ? calculateAgeFromBirthDate(formData.birthDate) 
      : 0;

    if (editingCitizenId) {
      updateCitizen(editingCitizenId, {
        prefix: formData.prefix,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        idCard: formData.idCard.trim() || '3-XXXX-XXXXX-XX-X',
        gender: formData.gender,
        birthDate: formData.birthDate || undefined,
        age: Number(calculatedAge),
        phone: formData.phone.trim(),
        houseNo: formData.houseNo.trim(),
        moo: formData.moo.trim() || 'หมู่ 1',
        villageName: formData.villageName.trim() || 'ชุมชน',
        healthRight: formData.healthRight,
        chronicDiseases: finalDiseases,
        allergies: formData.allergies.trim(),
        emergencyContact: formData.emergencyContact.trim(),
        emergencyPhone: formData.emergencyPhone.trim(),
        notes: formData.notes.trim(),
        patientStatus: formData.patientStatus || undefined,
        recommendedTerm: formData.recommendedTerm || undefined,
        medicalEquipment: formData.medicalEquipment,
        medicalEquipmentOther: formData.medicalEquipmentOther || undefined,
      });

      showToast(
        'บันทึกข้อมูลประชาชนสำเร็จเรียบร้อย',
        `อัปเดตข้อมูลของ ${formData.prefix} ${formData.firstName} ${formData.lastName} เรียบร้อยแล้ว`,
        'success'
      );
    } else {
      addCitizen({
        prefix: formData.prefix,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        idCard: formData.idCard.trim() || '3-XXXX-XXXXX-XX-X',
        gender: formData.gender,
        birthDate: formData.birthDate || undefined,
        age: Number(calculatedAge),
        phone: formData.phone.trim(),
        houseNo: formData.houseNo.trim(),
        moo: formData.moo.trim() || 'หมู่ 1',
        villageName: formData.villageName.trim() || 'ชุมชน',
        healthRight: formData.healthRight,
        chronicDiseases: finalDiseases,
        allergies: formData.allergies.trim(),
        emergencyContact: formData.emergencyContact.trim(),
        emergencyPhone: formData.emergencyPhone.trim(),
        notes: formData.notes.trim(),
        patientStatus: formData.patientStatus || undefined,
        recommendedTerm: formData.recommendedTerm || undefined,
        medicalEquipment: formData.medicalEquipment,
        medicalEquipmentOther: formData.medicalEquipmentOther || undefined,
      });

      showToast(
        'บันทึกข้อมูลประชาชนสำเร็จเรียบร้อย',
        `เพิ่ม ${formData.prefix} ${formData.firstName} ${formData.lastName} เข้าสู่ระบบเรียบร้อยแล้ว`,
        'success'
      );
    }

    // Reset and close
    setFormData({
      prefix: 'นาย',
      firstName: '',
      lastName: '',
      idCard: '',
      gender: 'ชาย',
      birthDate: '',
      age: '',
      phone: '',
      houseNo: '',
      moo: '',
      villageName: '',
      healthRight: 'บัตรทอง (UC/สปสช.)',
      allergies: '',
      emergencyContact: '',
      emergencyPhone: '',
      notes: '',
      patientStatus: '',
      recommendedTerm: '',
      medicalEquipment: [],
      medicalEquipmentOther: '',
    });
    setSelectedDiseases([]);
    setDiseaseInputText('');
    setIsModalOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`ยืนยันการลบข้อมูลของ "${name}" และประวัติการตรวจทั้งหมดใช่หรือไม่?`)) {
      deleteCitizen(id);
    }
  };

  // Status & equipment summary counts for filters
  const statusCounts = useMemo(() => {
    return {
      all: citizens.length,
      general: citizens.filter(c => c.recommendedTerm === 'ผู้ป่วยทั่วไป' || c.patientStatus?.includes('ช่วยเหลือตนเองได้')).length,
      homebound: citizens.filter(c => c.recommendedTerm === 'ผู้ป่วยติดบ้าน' || c.patientStatus?.includes('ภาวะพึ่งพิง') || c.patientStatus?.includes('ติดบ้าน')).length,
      bedridden: citizens.filter(c => c.recommendedTerm === 'ผู้ป่วยติดเตียง' || c.patientStatus?.includes('นอนอยู่บนเตียง') || c.patientStatus?.includes('ติดเตียง')).length,
      disabled: citizens.filter(c => c.recommendedTerm?.includes('พิการ') || c.patientStatus?.includes('พิการ')).length,
      symptomatic: citizens.filter(c => c.recommendedTerm?.includes('มีอาการ') || c.patientStatus?.includes('ยังมีอาการเจ็บป่วย')).length,
    };
  }, [citizens]);

  const equipmentCounts = useMemo(() => {
    const count = (kw: string) => citizens.filter(c => c.medicalEquipment?.some(eq => eq.toLowerCase().includes(kw.toLowerCase()))).length;
    return {
      any: citizens.filter(c => c.medicalEquipment && c.medicalEquipment.length > 0).length,
      oxygen: count('ออกซิเจน'),
      foley: count('สายสวนปัสสาวะ') || count('foley'),
      ng: count('NG tube') || count('ทางจมูก'),
      peg: count('PEG') || count('หน้าท้อง'),
      tracheostomy: count('Tracheostomy') || count('เจาะคอ'),
    };
  }, [citizens]);

  const isFilterActive = selectedFilter !== 'all' || selectedStatusFilter !== 'all' || selectedEquipmentFilter !== 'all' || Boolean(searchQuery.trim());

  const handleResetFilters = () => {
    setSelectedFilter('all');
    setSelectedStatusFilter('all');
    setSelectedEquipmentFilter('all');
    setSearchQuery('');
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading font-bold text-2xl sm:text-3xl text-[#2C2C24]">
            ทะเบียนประวัติประชาชนในชุมชน
          </h2>
          <p className="text-xs sm:text-sm text-[#78786C] mt-1">
            ทะเบียนประวัติประชาชน วันเดือนปีเกิด สิทธิการรักษา โรคประจำตัว สถานะการดูแล และอุปกรณ์การแพทย์ ({citizens.length} คน)
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 bg-[#5D7052] hover:bg-[#48573F] text-white px-5 py-2.5 rounded-full font-semibold text-xs sm:text-sm shadow-soft hover:shadow-moss-glow transition-all active:scale-95 self-start md:self-auto cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>เพิ่มรายชื่อประชาชนใหม่</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-[#FEFEFA] border border-[#DED8CF] rounded-3xl p-4 sm:p-5 shadow-soft space-y-3.5">
        
        {/* Row 1: Search & Main View Controls */}
        <div className="flex flex-col lg:flex-row gap-3 justify-between items-stretch lg:items-center">
          {/* Live Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#78786C] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อ, สกุล, บ้านเลขที่, เบอร์โทร..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#DED8CF] rounded-2xl text-xs sm:text-sm text-[#2C2C24] placeholder:text-[#78786C] focus:ring-2 focus:ring-[#5D7052]/30"
            />
          </div>

          {/* Demographic Filter Pills & View Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                selectedFilter === 'all'
                  ? 'bg-[#5D7052] text-white shadow-xs'
                  : 'bg-white text-[#4A4A40] border border-[#DED8CF] hover:bg-[#F0EBE5]'
              }`}
            >
              ทั้งหมด ({citizens.length})
            </button>
            <button
              onClick={() => setSelectedFilter('elderly')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                selectedFilter === 'elderly'
                  ? 'bg-[#5D7052] text-white shadow-xs'
                  : 'bg-white text-[#4A4A40] border border-[#DED8CF] hover:bg-[#F0EBE5]'
              }`}
            >
              ผู้สูงอายุ 60+ ({citizens.filter(c => c.age >= 60).length})
            </button>
            <button
              onClick={() => setSelectedFilter('chronic')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                selectedFilter === 'chronic'
                  ? 'bg-[#A85448] text-white shadow-xs'
                  : 'bg-white text-[#4A4A40] border border-[#DED8CF] hover:bg-[#F0EBE5]'
              }`}
            >
              มีโรคประจำตัว ({citizens.filter(c => c.chronicDiseases && c.chronicDiseases.length > 0).length})
            </button>

            {/* View Toggle */}
            <div className="hidden sm:flex items-center ml-1 pl-2 border-l border-[#DED8CF] gap-1">
              <button
                onClick={() => setViewMode('cards')}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  viewMode === 'cards' ? 'bg-[#5D7052] text-white' : 'text-[#78786C] hover:bg-[#F0EBE5]'
                }`}
                title="มุมมองการ์ด"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  viewMode === 'table' ? 'bg-[#5D7052] text-white' : 'text-[#78786C] hover:bg-[#F0EBE5]'
                }`}
                title="มุมมองตาราง"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Patient Status Filter Pills */}
        <div className="pt-2 border-t border-[#DED8CF]/60 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] font-semibold text-[#78786C] mr-1 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-[#5D7052]" />
            <span>สถานะผู้ป่วย:</span>
          </span>

          {[
            { id: 'all', label: 'ทั้งหมด', count: statusCounts.all },
            { id: 'ผู้ป่วยทั่วไป', label: 'ผู้ป่วยทั่วไป', count: statusCounts.general },
            { id: 'ผู้ป่วยติดบ้าน', label: 'ผู้ป่วยติดบ้าน', count: statusCounts.homebound },
            { id: 'ผู้ป่วยติดเตียง', label: 'ผู้ป่วยติดเตียง', count: statusCounts.bedridden },
            { id: 'ผู้ป่วยพิการ', label: 'ผู้ป่วยพิการ', count: statusCounts.disabled },
            { id: 'ผู้ป่วยที่ยังมีอาการ', label: 'ผู้ป่วยที่ยังมีอาการ', count: statusCounts.symptomatic },
          ].map((item) => {
            const isActive = selectedStatusFilter === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedStatusFilter(item.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#2C2C24] text-white shadow-xs'
                    : 'bg-white text-[#4A4A40] border border-[#DED8CF] hover:bg-[#F0EBE5]'
                }`}
              >
                {item.label} ({item.count})
              </button>
            );
          })}
        </div>

        {/* Row 3: Medical Equipment Filter Pills */}
        <div className="pt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] font-semibold text-[#78786C] mr-1 flex items-center gap-1">
            <Stethoscope className="w-3.5 h-3.5 text-[#C18C5D]" />
            <span>อุปกรณ์การแพทย์:</span>
          </span>

          {[
            { id: 'all', label: 'อุปกรณ์ทั้งหมด' },
            { id: 'has_equipment', label: `มีอุปกรณ์ (${equipmentCounts.any})` },
            { id: 'ออกซิเจน', label: `ใช้ออกซิเจน (${equipmentCounts.oxygen})` },
            { id: 'สายสวนปัสสาวะ', label: `ใช้สายสวนปัสสาวะ (${equipmentCounts.foley})` },
            { id: 'NG tube', label: `ใช้ NG tube (${equipmentCounts.ng})` },
            { id: 'PEG', label: `ใช้ PEG tube (${equipmentCounts.peg})` },
            { id: 'Tracheostomy', label: `ใช้ Tracheostomy (${equipmentCounts.tracheostomy})` },
          ].map((eqItem) => {
            const isActive = selectedEquipmentFilter === eqItem.id;
            return (
              <button
                key={eqItem.id}
                onClick={() => setSelectedEquipmentFilter(eqItem.id)}
                className={`px-3 py-0.5 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#C18C5D] text-white shadow-xs'
                    : 'bg-white text-[#78786C] border border-[#DED8CF] hover:bg-[#F0EBE5] hover:text-[#4A4A40]'
                }`}
              >
                {eqItem.label}
              </button>
            );
          })}

          {isFilterActive && (
            <button
              onClick={handleResetFilters}
              className="ml-auto text-[11px] text-[#A85448] hover:underline font-semibold flex items-center gap-1 cursor-pointer py-1 px-2"
            >
              <X className="w-3 h-3" />
              <span>ล้างตัวกรอง ({filteredCitizens.length}/{citizens.length} คน)</span>
            </button>
          )}
        </div>

      </div>

      {/* Citizen Directory Render */}
      {filteredCitizens.length === 0 ? (
        <div className="bg-[#FEFEFA] border border-[#DED8CF] rounded-3xl p-12 text-center shadow-soft">
          <Users className="w-12 h-12 text-[#78786C]/40 mx-auto mb-3" />
          <h3 className="font-heading font-bold text-lg text-[#2C2C24]">ไม่พบข้อมูลประชาชนที่ตรงกับเงื่อนไข</h3>
          <p className="text-xs text-[#78786C] mt-1 max-w-sm mx-auto">
            ลองปรับเปลี่ยนคำค้นหา หรือกดปุ่ม &quot;เพิ่มรายชื่อประชาชนใหม่&quot; เพื่อสร้างประวัติ
          </p>
          <button
            onClick={openAddModal}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#5D7052] text-white text-xs font-semibold hover:bg-[#48573F] transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>เพิ่มประชาชนรายแรก</span>
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        /* Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredCitizens.map((citizen) => {
            const fullName = `${citizen.prefix} ${citizen.firstName} ${citizen.lastName}`;
            const latestRecord = latestRecordsMap.get(citizen.id);

            return (
              <div 
                key={citizen.id}
                className="bg-[#FEFEFA] border border-[#DED8CF] rounded-3xl p-4 sm:p-5 shadow-soft hover:shadow-card transition-all flex flex-col justify-between gap-4"
              >
                <div>
                  {/* Card Header: Avatar & Names */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0"
                        style={{ backgroundColor: citizen.avatarColor || '#5D7052' }}
                      >
                        {citizen.firstName.charAt(0)}
                      </div>
                      <div>
                        <button
                          onClick={() => setSelectedCitizenForProfile(citizen)}
                          className="font-heading font-bold text-sm sm:text-base text-[#2C2C24] hover:text-[#5D7052] hover:underline text-left"
                        >
                          {fullName}
                        </button>
                        <div className="flex items-center gap-1.5 text-xs text-[#78786C]">
                          <span>เพศ: {citizen.gender}</span>
                          <span>•</span>
                          <span className="font-semibold text-[#2C2C24]">อายุ {citizen.age} ปี</span>
                        </div>
                      </div>
                    </div>

                    {/* Latest Record Info */}
                    {latestRecord ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#5D7052]/10 text-[#5D7052] border border-[#5D7052]/20">
                        {latestRecord.systolic}/{latestRecord.diastolic} mmHg
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F0EBE5] text-[#78786C]">
                        ยังไม่ตรวจ
                      </span>
                    )}
                  </div>

                  {/* Citizen Info Rows */}
                  <div className="mt-3.5 space-y-1.5 text-xs text-[#4A4A40]">
                    {citizen.birthDate && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#5D7052] shrink-0" />
                        <span>วันเกิด: <strong className="text-[#2C2C24]">{formatThaiBirthDate(citizen.birthDate)}</strong></span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Home className="w-3.5 h-3.5 text-[#5D7052] shrink-0" />
                      <span>บ้านเลขที่ <strong className="text-[#2C2C24]">{citizen.houseNo}</strong> {citizen.moo}</span>
                    </div>
                    {citizen.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-[#C18C5D] shrink-0" />
                        <span>{citizen.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-[#78786C] shrink-0" />
                      <span className="truncate">{citizen.healthRight}</span>
                    </div>

                    {/* Chronic diseases tag list */}
                    {citizen.chronicDiseases && citizen.chronicDiseases.length > 0 && (
                      <div className="pt-1.5 border-t border-[#DED8CF]/40 flex flex-wrap gap-1">
                        {citizen.chronicDiseases.map((disease, idx) => (
                          <span 
                            key={idx}
                            className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#A85448]/10 text-[#A85448] border border-[#A85448]/20"
                          >
                            {disease}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Patient Status & Medical Equipment Badges */}
                    {(() => {
                      const badgeInfo = getPatientStatusBadge(citizen.patientStatus, citizen.recommendedTerm);
                      const hasEquipment = Boolean(citizen.medicalEquipment && citizen.medicalEquipment.length > 0);
                      if (!badgeInfo.hasStatus && !hasEquipment) return null;

                      return (
                        <div className="pt-2 border-t border-[#DED8CF]/40 space-y-1.5">
                          {badgeInfo.hasStatus && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeInfo.badgeColor}`}>
                                {badgeInfo.term || badgeInfo.label}
                              </span>
                              {badgeInfo.term !== badgeInfo.label && (
                                <span className="text-[10px] text-[#78786C] truncate max-w-[170px]" title={badgeInfo.label}>
                                  ({badgeInfo.label})
                                </span>
                              )}
                            </div>
                          )}

                          {hasEquipment && (
                            <div className="flex items-center gap-1 flex-wrap">
                              {citizen.medicalEquipment!.slice(0, 3).map((eq, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#C18C5D]/15 text-[#C18C5D] border border-[#C18C5D]/25"
                                >
                                  {eq === 'อื่นๆ' && citizen.medicalEquipmentOther ? citizen.medicalEquipmentOther : eq}
                                </span>
                              ))}
                              {citizen.medicalEquipment!.length > 3 && (
                                <span className="text-[10px] text-[#78786C]">+{citizen.medicalEquipment!.length - 3}</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-2 border-t border-[#DED8CF]/60 flex items-center justify-between gap-1">
                  <button
                    onClick={() => setSelectedCitizenForProfile(citizen)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-[#F0EBE5] hover:bg-[#E6DCCD] text-[#2C2C24] rounded-full text-xs font-semibold transition-all cursor-pointer"
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-[#5D7052]" />
                    <span>ประวัติ & ค่าวัด</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedCitizenForCheckup(citizen);
                      setActiveTab('checkup');
                    }}
                    className="p-1.5 bg-[#5D7052] hover:bg-[#48573F] text-white rounded-full transition-all shadow-xs cursor-pointer"
                    title="บันทึกตรวจสุขภาพทันที"
                  >
                    <Stethoscope className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setSelectedCitizenForProfile(citizen)}
                    className="p-1.5 text-[#5D7052] hover:bg-[#5D7052]/10 rounded-full transition-all cursor-pointer"
                    title="สิทธิ์เข้าดูผลตรวจ (QR Code / PIN)"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => openEditModal(citizen)}
                    className="p-1.5 text-[#78786C] hover:text-[#2C2C24] hover:bg-[#F0EBE5] rounded-full transition-all cursor-pointer"
                    title="แก้ไขข้อมูล"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDelete(citizen.id, fullName)}
                    className="p-1.5 text-[#A85448]/70 hover:text-[#A85448] hover:bg-[#A85448]/10 rounded-full transition-all cursor-pointer"
                    title="ลบรายชื่อ"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-[#FEFEFA] border border-[#DED8CF] rounded-3xl overflow-hidden shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F0EBE5] text-[#2C2C24] font-semibold border-b border-[#DED8CF]">
                <tr>
                  <th className="py-3 px-4">ชื่อ - นามสกุล</th>
                  <th className="py-3 px-3">วันเกิด / อายุ</th>
                  <th className="py-3 px-3">บ้านเลขที่</th>
                  <th className="py-3 px-3">เบอร์โทร</th>
                  <th className="py-3 px-3">สิทธิการรักษา</th>
                  <th className="py-3 px-3">โรคประจำตัว</th>
                  <th className="py-3 px-3">สถานะ / อุปกรณ์</th>
                  <th className="py-3 px-3">ตรวจล่าสุด</th>
                  <th className="py-3 px-4 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DED8CF]/60 text-[#4A4A40]">
                {filteredCitizens.map((citizen) => {
                  const fullName = `${citizen.prefix} ${citizen.firstName} ${citizen.lastName}`;
                  const latestRecord = latestRecordsMap.get(citizen.id);

                  return (
                    <tr key={citizen.id} className="hover:bg-[#FDFCF8] transition-colors">
                      <td className="py-3 px-4 font-semibold text-[#2C2C24]">
                        <button
                          onClick={() => setSelectedCitizenForProfile(citizen)}
                          className="hover:text-[#5D7052] hover:underline text-left"
                        >
                          {fullName}
                        </button>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-[#2C2C24]">{citizen.age} ปี</div>
                        <div className="text-[11px] text-[#78786C]">{citizen.birthDate ? formatThaiBirthDate(citizen.birthDate) : '-'}</div>
                      </td>
                      <td className="py-3 px-3 font-medium text-[#2C2C24]">{citizen.houseNo}</td>
                      <td className="py-3 px-3">{citizen.phone || '-'}</td>
                      <td className="py-3 px-3 truncate max-w-[130px]">{citizen.healthRight}</td>
                      <td className="py-3 px-3">
                        {citizen.chronicDiseases && citizen.chronicDiseases.length > 0 ? (
                          <span className="text-[#A85448] font-medium">
                            {citizen.chronicDiseases.join(', ')}
                          </span>
                        ) : (
                          <span className="text-[#78786C]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {(() => {
                          const badgeInfo = getPatientStatusBadge(citizen.patientStatus, citizen.recommendedTerm);
                          const hasEquipment = Boolean(citizen.medicalEquipment && citizen.medicalEquipment.length > 0);
                          if (!badgeInfo.hasStatus && !hasEquipment) return <span className="text-[#78786C] text-[11px]">-</span>;

                          return (
                            <div className="space-y-1">
                              {badgeInfo.hasStatus && (
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeInfo.badgeColor}`}>
                                  {badgeInfo.term || badgeInfo.label}
                                </span>
                              )}
                              {hasEquipment && (
                                <div className="text-[10px] text-[#C18C5D] font-medium truncate max-w-[160px]" title={citizen.medicalEquipment?.join(', ')}>
                                  {citizen.medicalEquipment?.join(', ')}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-3">
                        {latestRecord ? (
                          <div>
                            <span className="font-bold text-[#2C2C24]">
                              {latestRecord.systolic}/{latestRecord.diastolic}
                            </span>
                            <span className="text-[10px] text-[#78786C] ml-1">
                              ({formatThaiDate(latestRecord.date, false)})
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-[#78786C]">ยังไม่ตรวจ</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedCitizenForCheckup(citizen);
                              setActiveTab('checkup');
                            }}
                            className="p-1 bg-[#5D7052] text-white rounded-full hover:bg-[#48573F] cursor-pointer"
                            title="บันทึกตรวจสุขภาพ"
                          >
                            <Stethoscope className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setSelectedCitizenForProfile(citizen)}
                            className="p-1 text-[#5D7052] hover:text-[#48573F] hover:bg-[#5D7052]/10 rounded-full cursor-pointer"
                            title="สิทธิ์เข้าดูผลตรวจ (QR Code / PIN)"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openEditModal(citizen)}
                            className="p-1 text-[#78786C] hover:text-[#2C2C24] hover:bg-[#F0EBE5] rounded-full cursor-pointer"
                            title="แก้ไข"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(citizen.id, fullName)}
                            className="p-1 text-[#A85448]/70 hover:text-[#A85448] hover:bg-[#A85448]/10 rounded-full cursor-pointer"
                            title="ลบ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Citizen Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2C2C24]/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#FDFCF8] border border-[#DED8CF] rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-float relative max-h-[90vh] overflow-y-auto">
            
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 p-2 text-[#78786C] hover:text-[#2C2C24] hover:bg-[#F0EBE5] rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-heading font-bold text-xl sm:text-2xl text-[#2C2C24] mb-1">
              {editingCitizenId ? 'แก้ไขข้อมูลประชาชน' : 'เพิ่มรายชื่อประชาชนใหม่'}
            </h3>
            <p className="text-xs text-[#78786C] mb-6">
              บันทึกข้อมูลส่วนบุคคล วันเดือนปีเกิด สิทธิการรักษา และโรคประจำตัว
            </p>

            {formError && (
              <div className="mb-4 p-3 bg-[#A85448]/10 border border-[#A85448]/30 rounded-2xl flex items-center gap-2 text-xs text-[#A85448]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCitizen} className="space-y-4 text-xs">
              
              {/* Name fields */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-1">
                  <label className="block font-medium text-[#4A4A40] mb-1">คำนำหน้า *</label>
                  <select
                    value={formData.prefix}
                    onChange={(e) => setFormData({ ...formData, prefix: e.target.value as Citizen['prefix'] })}
                    className="w-full px-3 py-2 bg-white border border-[#DED8CF] rounded-xl focus:ring-2 focus:ring-[#5D7052]/30"
                  >
                    <option value="นาย">นาย</option>
                    <option value="นาง">นาง</option>
                    <option value="นางสาว">นางสาว</option>
                    <option value="ด.ช.">ด.ช.</option>
                    <option value="ด.หญิง">ด.หญิง</option>
                    <option value="อื่นๆ">อื่นๆ</option>
                  </select>
                </div>
                <div className="sm:col-span-1">
                  <label className="block font-medium text-[#4A4A40] mb-1">ชื่อจริง *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="เช่น บุญมี"
                    className="w-full px-3 py-2 bg-white border border-[#DED8CF] rounded-xl focus:ring-2 focus:ring-[#5D7052]/30"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-[#4A4A40] mb-1">นามสกุล *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="เช่น มีสุข"
                    className="w-full px-3 py-2 bg-white border border-[#DED8CF] rounded-xl focus:ring-2 focus:ring-[#5D7052]/30"
                  />
                </div>
              </div>

              {/* ID Card, Gender */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#4A4A40] mb-1">เลขบัตรประชาชน (13 หลัก)</label>
                  <input
                    type="text"
                    value={formData.idCard}
                    onChange={(e) => setFormData({ ...formData, idCard: e.target.value })}
                    placeholder="3-7101-00234-51-1"
                    className="w-full px-3 py-2 bg-white border border-[#DED8CF] rounded-xl focus:ring-2 focus:ring-[#5D7052]/30"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#4A4A40] mb-1">เพศ</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as Citizen['gender'] })}
                    className="w-full px-3 py-2 bg-white border border-[#DED8CF] rounded-xl focus:ring-2 focus:ring-[#5D7052]/30"
                  >
                    <option value="ชาย">ชาย</option>
                    <option value="หญิง">หญิง</option>
                    <option value="อื่นๆ">อื่นๆ</option>
                  </select>
                </div>
              </div>

              {/* BirthDate & Age */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#F4F1EA]/60 p-3.5 rounded-2xl border border-[#DED8CF]/60">
                <div>
                  <label className="block font-medium text-[#2C2C24] mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#5D7052]" />
                    <span>วันเดือนปีเกิด</span>
                  </label>
                  <input
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => handleBirthDateChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#DED8CF] rounded-xl focus:ring-2 focus:ring-[#5D7052]/30 font-medium"
                  />
                  <span className="text-[10px] text-[#78786C] mt-0.5 block">
                    (เลือกระบบจะคำนวณอายุให้อัตโนมัติ)
                  </span>
                </div>
                <div>
                  <label className="block font-medium text-[#2C2C24] mb-1">อายุ (ปี) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="130"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value === '' ? '' : Number(e.target.value) })}
                    placeholder="กรอกอายุ เช่น 45"
                    className="w-full px-3 py-2 bg-white border border-[#DED8CF] rounded-xl focus:ring-2 focus:ring-[#5D7052]/30 font-bold text-sm"
                  />
                </div>
              </div>

              {/* House & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-[#4A4A40] mb-1">บ้านเลขที่ *</label>
                  <input
                    type="text"
                    required
                    value={formData.houseNo}
                    onChange={(e) => setFormData({ ...formData, houseNo: e.target.value })}
                    placeholder="เช่น 12/1 หรือ 45"
                    className="w-full px-3 py-2 bg-white border border-[#DED8CF] rounded-xl focus:ring-2 focus:ring-[#5D7052]/30"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#4A4A40] mb-1">หมู่ที่</label>
                  <input
                    type="text"
                    value={formData.moo}
                    onChange={(e) => setFormData({ ...formData, moo: e.target.value })}
                    placeholder="เช่น หมู่ 1"
                    className="w-full px-3 py-2 bg-white border border-[#DED8CF] rounded-xl focus:ring-2 focus:ring-[#5D7052]/30"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#4A4A40] mb-1">เบอร์โทรศัพท์</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="เช่น 089-112-3344"
                    className="w-full px-3 py-2 bg-white border border-[#DED8CF] rounded-xl focus:ring-2 focus:ring-[#5D7052]/30"
                  />
                </div>
              </div>

              {/* Health Right & Village */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#4A4A40] mb-1">สิทธิการรักษา</label>
                  <select
                    value={formData.healthRight}
                    onChange={(e) => setFormData({ ...formData, healthRight: e.target.value as HealthRight })}
                    className="w-full px-3 py-2 bg-white border border-[#DED8CF] rounded-xl focus:ring-2 focus:ring-[#5D7052]/30"
                  >
                    <option value="บัตรทอง (UC/สปสช.)">บัตรทอง (UC/สปสช.)</option>
                    <option value="ประกันสังคม">ประกันสังคม</option>
                    <option value="ข้าราชการ/รัฐวิสาหกิจ">ข้าราชการ/รัฐวิสาหกิจ</option>
                    <option value="จ่ายตรง">จ่ายตรง</option>
                    <option value="ชำระเงินเอง">ชำระเงินเอง</option>
                    <option value="ต่างด้าว/อื่นๆ">ต่างด้าว/อื่นๆ</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-[#4A4A40] mb-1">ชื่อหมู่บ้าน/ชุมชน</label>
                  <input
                    type="text"
                    value={formData.villageName}
                    onChange={(e) => setFormData({ ...formData, villageName: e.target.value })}
                    placeholder="เช่น บ้านดอนมะกอก"
                    className="w-full px-3 py-2 bg-white border border-[#DED8CF] rounded-xl focus:ring-2 focus:ring-[#5D7052]/30"
                  />
                </div>
              </div>

              {/* Intelligent Chronic Diseases System */}
              <div className="bg-[#FDFCF8] p-4 rounded-2xl border border-[#DED8CF] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-xs text-[#2C2C24] flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#5D7052]" />
                    <span>โรคประจำตัว (พิมพ์แล้วกดเว้นวรรค / Enter เพื่อเพิ่ม ไม่ต้องใส่จุลภาค)</span>
                  </label>
                  {selectedDiseases.length > 0 && (
                    <span className="text-[11px] font-semibold text-[#5D7052]">
                      เลือกไว้ {selectedDiseases.length} โรค
                    </span>
                  )}
                </div>

                {/* Selected Diseases Badges */}
                {selectedDiseases.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded-xl border border-[#DED8CF]/80">
                    {selectedDiseases.map((disease) => (
                      <span
                        key={disease}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#5D7052]/10 border border-[#5D7052]/30 text-[#5D7052] rounded-full text-xs font-semibold"
                      >
                        <span>{disease}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDiseaseTag(disease)}
                          className="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-[#5D7052]/20 text-[#5D7052] text-xs transition-colors cursor-pointer"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Input & Add Button */}
                <div className="relative">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={diseaseInputText}
                      onChange={(e) => setDiseaseInputText(e.target.value)}
                      onKeyDown={handleDiseaseInputKeyDown}
                      placeholder="พิมพ์ชื่อโรค เช่น เบาหวาน แล้วกด เว้นวรรค หรือ Enter..."
                      className="w-full px-3 py-2 bg-white border border-[#DED8CF] rounded-xl focus:ring-2 focus:ring-[#5D7052]/30 text-xs sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (diseaseInputText.trim()) {
                          handleAddDiseaseTag(diseaseInputText);
                        }
                      }}
                      className="px-3.5 py-2 bg-[#5D7052] hover:bg-[#48573F] text-white rounded-xl text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>เพิ่ม</span>
                    </button>
                  </div>

                  {/* Filtered Autocomplete Dropdown while typing */}
                  {matchingDiseaseSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#DED8CF] rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto p-1.5 space-y-1">
                      <div className="text-[10px] text-[#78786C] px-2 py-0.5 font-semibold">
                        ผลการค้นหาจากประวัติที่เคยบันทึกไว้ (คลิกเพื่อเลือก):
                      </div>
                      {matchingDiseaseSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => handleAddDiseaseTag(suggestion)}
                          className="w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-[#5D7052]/10 hover:text-[#5D7052] font-medium transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <span>{suggestion}</span>
                          <span className="text-[10px] text-[#78786C] bg-[#F0EBE5] px-1.5 py-0.5 rounded">
                            + เลือก
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick History / Frequent Disease Suggestions */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] text-[#78786C] font-medium">
                    แตะเพื่อเลือกจากประวัติโรคที่เคยบันทึกในระบบ:
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {diseaseHistory.map((disease) => {
                      const isAdded = selectedDiseases.includes(disease);
                      return (
                        <button
                          key={disease}
                          type="button"
                          onClick={() => isAdded ? handleRemoveDiseaseTag(disease) : handleAddDiseaseTag(disease)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
                            isAdded
                              ? 'bg-[#5D7052] text-white shadow-xs'
                              : 'bg-white border border-[#DED8CF] text-[#4A4A40] hover:bg-[#F0EBE5]'
                          }`}
                        >
                          <span>{disease}</span>
                          {isAdded ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <span className="text-[10px] opacity-60">+</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Allergies */}
              <div>
                <label className="block font-medium text-[#4A4A40] mb-1">ประวัติแพ้ยา/แพ้อาหาร</label>
                <input
                  type="text"
                  value={formData.allergies}
                  onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                  placeholder="เช่น แพ้ยาเพนนิซิลิน, แพ้อาหารทะเล"
                  className="w-full px-3 py-2 bg-white border border-[#DED8CF] rounded-xl focus:ring-2 focus:ring-[#5D7052]/30"
                />
              </div>

              {/* Patient Status Assessment & Medical Equipment (New Feature) */}
              <PatientAssessmentSection
                patientStatus={formData.patientStatus}
                recommendedTerm={formData.recommendedTerm}
                medicalEquipment={formData.medicalEquipment}
                medicalEquipmentOther={formData.medicalEquipmentOther}
                onChange={(updated) => {
                  setFormData((prev) => ({
                    ...prev,
                    patientStatus: updated.patientStatus,
                    recommendedTerm: updated.recommendedTerm,
                    medicalEquipment: updated.medicalEquipment,
                    medicalEquipmentOther: updated.medicalEquipmentOther,
                  }));
                }}
              />

              {/* Emergency Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#4A4A40] mb-1">ผู้ติดต่อฉุกเฉิน (ชื่อ-ความสัมพันธ์)</label>
                  <input
                    type="text"
                    value={formData.emergencyContact}
                    onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                    placeholder="เช่น นางสมใจ (บุตรสาว)"
                    className="w-full px-3 py-2 bg-white border border-[#DED8CF] rounded-xl focus:ring-2 focus:ring-[#5D7052]/30"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#4A4A40] mb-1">เบอร์โทรติดต่อฉุกเฉิน</label>
                  <input
                    type="tel"
                    value={formData.emergencyPhone}
                    onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                    placeholder="081-998-7766"
                    className="w-full px-3 py-2 bg-white border border-[#DED8CF] rounded-xl focus:ring-2 focus:ring-[#5D7052]/30"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-medium text-[#4A4A40] mb-1">หมายเหตุเพิ่มเติม</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="ข้อมูลหรือข้อสังเกตเพิ่มเติมของประชาชน"
                  className="w-full px-3 py-2 bg-white border border-[#DED8CF] rounded-xl focus:ring-2 focus:ring-[#5D7052]/30"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2 rounded-full border border-[#DED8CF] text-[#4A4A40] hover:bg-[#F0EBE5] font-semibold transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-full bg-[#5D7052] hover:bg-[#48573F] text-white font-semibold shadow-soft hover:shadow-moss-glow transition-all active:scale-95 cursor-pointer"
                >
                  {editingCitizenId ? 'บันทึกการแก้ไข' : 'เพิ่มประชาชน'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};

