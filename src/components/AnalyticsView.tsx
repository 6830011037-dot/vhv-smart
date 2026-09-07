import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart3, 
  Users, 
  TrendingUp, 
  Activity, 
  Calendar, 
  Filter, 
  Search, 
  RotateCcw, 
  PieChart as PieChartIcon, 
  ChevronRight, 
  FileText, 
  Heart, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  Send, 
  Inbox, 
  User, 
  Eye, 
  X,
  Sparkles,
  ArrowUpRight,
  Phone,
  Home
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { useApp } from '../context/AppContext';
import { Citizen, HealthRecord } from '../types';
import { formatThaiDate } from '../utils/healthCalculations';

export const AnalyticsView: React.FC = () => {
  const { 
    citizens, 
    records, 
    sharedReportsReceived, 
    sharedReportsSent,
    vhvProfile,
    setSelectedCitizenForProfile,
    setActiveTab: setGlobalTab,
    analyticsViewMode,
    setAnalyticsViewMode
  } = useApp();

  // Primary View Switcher: ① Overview vs ② Individual
  const [localViewMode, setLocalViewMode] = useState<'overview' | 'individual'>('overview');
  const viewMode = analyticsViewMode || localViewMode;
  const setViewMode = (mode: 'overview' | 'individual') => {
    if (setAnalyticsViewMode) {
      setAnalyticsViewMode(mode);
    }
    setLocalViewMode(mode);
  };

  // ==========================================
  // ① OVERVIEW STATE & FILTERS
  // ==========================================
  // Helper for timezone-safe local date calculation
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseLocalDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    return new Date(dateStr);
  };

  const formatLocalDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const [datePreset, setDatePreset] = useState<'today' | '7days' | '30days' | 'custom'>('30days');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [customEndDate, setCustomEndDate] = useState<string>(getTodayString());
  const [appliedCustomStart, setAppliedCustomStart] = useState<string>(customStartDate);
  const [appliedCustomEnd, setAppliedCustomEnd] = useState<string>(customEndDate);

  // Overview Trend Metric Selector
  const [overviewTrendMetric, setOverviewTrendMetric] = useState<'records' | 'citizens' | 'reports_total' | 'reports_received' | 'reports_sent'>('records');

  // Compute effective start and end dates
  const { effectiveStartDate, effectiveEndDate } = useMemo(() => {
    const todayStr = getTodayString();
    if (datePreset === 'today') {
      return { effectiveStartDate: todayStr, effectiveEndDate: todayStr };
    }
    if (datePreset === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      return { effectiveStartDate: formatLocalDate(d), effectiveEndDate: todayStr };
    }
    if (datePreset === '30days') {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      return { effectiveStartDate: formatLocalDate(d), effectiveEndDate: todayStr };
    }
    return { effectiveStartDate: appliedCustomStart, effectiveEndDate: appliedCustomEnd };
  }, [datePreset, appliedCustomStart, appliedCustomEnd]);

  // Filtered dataset for Overview
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (effectiveStartDate && r.date < effectiveStartDate) return false;
      if (effectiveEndDate && r.date > effectiveEndDate) return false;
      return true;
    });
  }, [records, effectiveStartDate, effectiveEndDate]);

  const filteredCitizens = useMemo(() => {
    // Citizens registered or active in period
    return citizens.filter(c => {
      if (!c.createdAt) return true;
      const cDate = c.createdAt.split('T')[0];
      if (effectiveStartDate && cDate < effectiveStartDate) return false;
      if (effectiveEndDate && cDate > effectiveEndDate) return false;
      return true;
    });
  }, [citizens, effectiveStartDate, effectiveEndDate]);

  const filteredSentReports = useMemo(() => {
    return sharedReportsSent.filter(r => {
      const rDate = (r.createdAt || '').split('T')[0];
      if (effectiveStartDate && rDate < effectiveStartDate) return false;
      if (effectiveEndDate && rDate > effectiveEndDate) return false;
      return true;
    });
  }, [sharedReportsSent, effectiveStartDate, effectiveEndDate]);

  const filteredReceivedReports = useMemo(() => {
    return sharedReportsReceived.filter(r => {
      const rDate = (r.createdAt || '').split('T')[0];
      if (effectiveStartDate && rDate < effectiveStartDate) return false;
      if (effectiveEndDate && rDate > effectiveEndDate) return false;
      return true;
    });
  }, [sharedReportsReceived, effectiveStartDate, effectiveEndDate]);

  // 4 Summary Metrics (Pure actual numbers)
  const metricCards = useMemo(() => {
    const totalReports = filteredSentReports.length + filteredReceivedReports.length;
    const acceptedReports = filteredReceivedReports.filter(r => r.status === 'accepted').length +
      filteredSentReports.filter(r => r.status === 'accepted').length;

    return {
      citizensCount: datePreset === 'today' || datePreset === '7days' || datePreset === '30days' ? citizens.length : filteredCitizens.length || citizens.length,
      recordsCount: filteredRecords.length,
      totalReportsCount: totalReports,
      acceptedReportsCount: acceptedReports
    };
  }, [filteredRecords, filteredCitizens, filteredSentReports, filteredReceivedReports, citizens, datePreset]);

  // Perspective 1 — Trend Data by Date
  const trendData = useMemo(() => {
    const dateMap = new Map<string, {
      date: string;
      displayDate: string;
      records: number;
      citizens: number;
      reports_total: number;
      reports_received: number;
      reports_sent: number;
    }>();

    // Initialize date series up to 90 days
    const start = parseLocalDate(effectiveStartDate);
    const end = parseLocalDate(effectiveEndDate);
    const diffDays = Math.min(90, Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1));

    for (let i = 0; i < diffDays; i++) {
      const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const iso = formatLocalDate(cur);
      dateMap.set(iso, {
        date: iso,
        displayDate: formatThaiDate(iso, false),
        records: 0,
        citizens: 0,
        reports_total: 0,
        reports_received: 0,
        reports_sent: 0
      });
    }

    // Populate actual records
    records.forEach(r => {
      if (dateMap.has(r.date)) {
        const item = dateMap.get(r.date)!;
        item.records++;
      }
    });

    // Populate actual citizens
    citizens.forEach(c => {
      const cDate = (c.createdAt || '').split('T')[0];
      if (dateMap.has(cDate)) {
        const item = dateMap.get(cDate)!;
        item.citizens++;
      }
    });

    // Populate reports
    sharedReportsSent.forEach(r => {
      const rDate = (r.createdAt || '').split('T')[0];
      if (dateMap.has(rDate)) {
        const item = dateMap.get(rDate)!;
        item.reports_sent++;
        item.reports_total++;
      }
    });

    sharedReportsReceived.forEach(r => {
      const rDate = (r.createdAt || '').split('T')[0];
      if (dateMap.has(rDate)) {
        const item = dateMap.get(rDate)!;
        item.reports_received++;
        item.reports_total++;
      }
    });

    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [records, citizens, sharedReportsSent, sharedReportsReceived, effectiveStartDate, effectiveEndDate]);

  // Actual Historical Comparison for Trends
  const trendComparisonStats = useMemo(() => {
    const todayStr = getTodayString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const thisMonthPrefix = todayStr.substring(0, 7);

    const todayCount = records.filter(r => r.date === todayStr).length;
    const yesterdayCount = records.filter(r => r.date === yesterdayStr).length;
    const past7DaysCount = records.filter(r => r.date >= sevenDaysAgoStr).length;
    const thisMonthCount = records.filter(r => r.date.startsWith(thisMonthPrefix)).length;

    return {
      today: todayCount,
      yesterday: yesterdayCount,
      past7Days: past7DaysCount,
      thisMonth: thisMonthCount
    };
  }, [records]);

  // Perspective 2 — Health Record Distribution (Actual Types of Captured Data)
  const distributionData = useMemo(() => {
    let bpCount = 0;
    let weightCount = 0;
    let sugarCount = 0;
    let pulseCount = 0;
    let tempCount = 0;
    let waistCount = 0;

    filteredRecords.forEach(r => {
      if ((r.systolic && r.systolic > 0) || (r.diastolic && r.diastolic > 0)) bpCount++;
      if (r.weight && r.weight > 0) weightCount++;
      if (r.bloodSugar && r.bloodSugar > 0) sugarCount++;
      if (r.pulse && r.pulse > 0) pulseCount++;
      if (r.temperature && r.temperature > 0) tempCount++;
      if (r.waist && r.waist > 0) waistCount++;
    });

    const totalCaptures = bpCount + weightCount + sugarCount + pulseCount + tempCount + waistCount;

    return [
      { name: 'ความดันโลหิต', count: bpCount, color: '#5D7052', pct: totalCaptures > 0 ? Math.round((bpCount / totalCaptures) * 100) : 0 },
      { name: 'น้ำหนัก / BMI', count: weightCount, color: '#D97706', pct: totalCaptures > 0 ? Math.round((weightCount / totalCaptures) * 100) : 0 },
      { name: 'น้ำตาลในเลือด DTX', count: sugarCount, color: '#DC2626', pct: totalCaptures > 0 ? Math.round((sugarCount / totalCaptures) * 100) : 0 },
      { name: 'ชีพจร / อัตราเต้นหัวใจ', count: pulseCount, color: '#0284C7', pct: totalCaptures > 0 ? Math.round((pulseCount / totalCaptures) * 100) : 0 },
      { name: 'อุณหภูมิร่างกาย', count: tempCount, color: '#EA580C', pct: totalCaptures > 0 ? Math.round((tempCount / totalCaptures) * 100) : 0 },
      { name: 'รอบเอว', count: waistCount, color: '#7C3AED', pct: totalCaptures > 0 ? Math.round((waistCount / totalCaptures) * 100) : 0 },
    ].filter(item => item.count > 0);
  }, [filteredRecords]);

  // Perspective 3 — Activity Overview (Report Exchange Activity)
  const activityData = useMemo(() => {
    let sent = 0;
    let received = 0;
    let accepted = 0;
    let rejected = 0;
    let cancelled = 0;

    filteredSentReports.forEach(r => {
      sent++;
      if (r.status === 'accepted') accepted++;
      if (r.status === 'rejected') rejected++;
      if (r.status === 'cancelled') cancelled++;
    });

    filteredReceivedReports.forEach(r => {
      received++;
      if (r.status === 'accepted') accepted++;
      if (r.status === 'rejected') rejected++;
    });

    return [
      { activity: 'ส่งรายงาน', count: sent, color: '#5D7052' },
      { activity: 'รับรายงาน', count: received, color: '#0284C7' },
      { activity: 'ตอบรับรายงาน', count: accepted, color: '#16A34A' },
      { activity: 'ปฏิเสธรายงาน', count: rejected, color: '#DC2626' },
      { activity: 'ยกเลิกรายงาน', count: cancelled, color: '#64748B' },
    ];
  }, [filteredSentReports, filteredReceivedReports]);


  // ==========================================
  // ② INDIVIDUAL STATE & FILTERS
  // ==========================================
  const [selectedCitizenId, setSelectedCitizenId] = useState<string>(() => citizens[0]?.id || '');
  const [citizenSearchQuery, setCitizenSearchQuery] = useState<string>('');
  const [individualMetric, setIndividualMetric] = useState<'bp' | 'weight' | 'sugar' | 'pulse' | 'temp'>('bp');
  const [selectedTimelineRecord, setSelectedTimelineRecord] = useState<HealthRecord | null>(null);

  // Reset selected timeline record when switching citizens
  useEffect(() => {
    setSelectedTimelineRecord(null);
  }, [selectedCitizenId]);

  // Selected Citizen Object
  const selectedCitizen = useMemo(() => {
    return citizens.find(c => c.id === selectedCitizenId) || citizens[0] || null;
  }, [citizens, selectedCitizenId]);

  // Search Results for Citizen Picker
  const citizenSearchResults = useMemo(() => {
    const q = citizenSearchQuery.trim().toLowerCase();
    if (!q) return citizens.slice(0, 8);
    return citizens.filter(c => {
      const fullName = `${c.prefix || ''}${c.firstName} ${c.lastName}`.toLowerCase();
      const idCard = c.idCard || '';
      const phone = c.phone || '';
      return fullName.includes(q) || idCard.includes(q) || phone.includes(q);
    }).slice(0, 10);
  }, [citizens, citizenSearchQuery]);

  // Selected Citizen Records
  const citizenRecords = useMemo(() => {
    if (!selectedCitizen) return [];
    return records
      .filter(r => r.citizenId === selectedCitizen.id)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [records, selectedCitizen]);

  // Associated Shared Reports for Selected Citizen
  const citizenSharedReportsCount = useMemo(() => {
    if (!selectedCitizen) return 0;
    const sentCount = sharedReportsSent.filter(r => 
      r.citizensData?.some(c => c.id === selectedCitizen.id) || 
      r.citizenData?.id === selectedCitizen.id
    ).length;
    const recCount = sharedReportsReceived.filter(r => 
      r.citizensData?.some(c => c.id === selectedCitizen.id) || 
      r.citizenData?.id === selectedCitizen.id
    ).length;
    return sentCount + recCount;
  }, [selectedCitizen, sharedReportsSent, sharedReportsReceived]);

  // Individual Perspective 1 — Health Trend Data
  const individualTrendData = useMemo(() => {
    return citizenRecords.map((r, idx) => ({
      index: idx + 1,
      date: r.date,
      displayDate: formatThaiDate(r.date, false),
      time: r.time || '',
      systolic: r.systolic || null,
      diastolic: r.diastolic || null,
      weight: r.weight || null,
      bmi: r.bmi || null,
      bloodSugar: r.bloodSugar || null,
      bloodSugarFasting: r.bloodSugarFasting,
      pulse: r.pulse || null,
      temperature: r.temperature || null,
    }));
  }, [citizenRecords]);

  // Individual Perspective 2 — Health Record Distribution
  const individualDistributionData = useMemo(() => {
    let bp = 0;
    let weight = 0;
    let sugar = 0;
    let pulse = 0;
    let temp = 0;

    citizenRecords.forEach(r => {
      if ((r.systolic && r.systolic > 0) || (r.diastolic && r.diastolic > 0)) bp++;
      if (r.weight && r.weight > 0) weight++;
      if (r.bloodSugar && r.bloodSugar > 0) sugar++;
      if (r.pulse && r.pulse > 0) pulse++;
      if (r.temperature && r.temperature > 0) temp++;
    });

    const total = bp + weight + sugar + pulse + temp;

    return [
      { name: 'ความดันโลหิต', count: bp, color: '#5D7052', pct: total > 0 ? Math.round((bp / total) * 100) : 0 },
      { name: 'น้ำหนัก / BMI', count: weight, color: '#D97706', pct: total > 0 ? Math.round((weight / total) * 100) : 0 },
      { name: 'น้ำตาลในเลือด DTX', count: sugar, color: '#DC2626', pct: total > 0 ? Math.round((sugar / total) * 100) : 0 },
      { name: 'ชีพจร / หัวใจ', count: pulse, color: '#0284C7', pct: total > 0 ? Math.round((pulse / total) * 100) : 0 },
      { name: 'อุณหภูมิร่างกาย', count: temp, color: '#EA580C', pct: total > 0 ? Math.round((temp / total) * 100) : 0 },
    ].filter(item => item.count > 0);
  }, [citizenRecords]);

  // Individual Perspective 3 — Grouped Chronological Timeline
  const groupedTimeline = useMemo(() => {
    const map = new Map<string, HealthRecord[]>();
    // Sort descending for timeline (newest first)
    const sorted = [...citizenRecords].sort((a, b) => {
      const dDiff = b.date.localeCompare(a.date);
      if (dDiff !== 0) return dDiff;
      return (b.time || '').localeCompare(a.time || '');
    });

    sorted.forEach(rec => {
      const existing = map.get(rec.date) || [];
      existing.push(rec);
      map.set(rec.date, existing);
    });

    return Array.from(map.entries()).map(([date, recs]) => ({
      date,
      thaiDate: formatThaiDate(date, true),
      records: recs
    }));
  }, [citizenRecords]);

  const handleApplyCustomDate = () => {
    setAppliedCustomStart(customStartDate);
    setAppliedCustomEnd(customEndDate);
  };

  const handleResetFilter = () => {
    setDatePreset('30days');
    const today = getTodayString();
    const d = new Date();
    d.setDate(d.getDate() - 30);
    setCustomStartDate(d.toISOString().split('T')[0]);
    setCustomEndDate(today);
    setAppliedCustomStart(d.toISOString().split('T')[0]);
    setAppliedCustomEnd(today);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Header & Primary View Switcher */}
      <div className="bg-[#FDFCF8] border border-[#DED8CF] rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#5D7052]/10 text-[#5D7052] flex items-center justify-center font-bold">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold font-heading text-[#2C2C24]">
                สถิติข้อมูลสุขภาพ
              </h1>
              <p className="text-xs sm:text-sm text-[#78786C]">
                แสดงผลข้อมูลและแนวโน้มที่เกิดขึ้นจริงในชุมชน
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher: ① Overview vs ② Individual */}
        <div className="inline-flex p-1 bg-[#F0EBE5] rounded-xl border border-[#DED8CF] self-start md:self-auto">
          <button
            onClick={() => setViewMode('overview')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
              viewMode === 'overview'
                ? 'bg-[#5D7052] text-white shadow-sm'
                : 'text-[#5C5C50] hover:text-[#2C2C24]'
            }`}
          >
            <PieChartIcon className="w-4 h-4" />
            <span>① ภาพรวมสถิติ</span>
          </button>

          <button
            onClick={() => setViewMode('individual')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
              viewMode === 'individual'
                ? 'bg-[#5D7052] text-white shadow-sm'
                : 'text-[#5C5C50] hover:text-[#2C2C24]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>② สถิติรายคน</span>
          </button>
        </div>
      </div>

      {/* ==========================================
          ① ภาพรวมสถิติ (OVERVIEW VIEW)
          ========================================== */}
      {viewMode === 'overview' && (
        <div className="space-y-6">

          {/* Filter Bar */}
          <div className="bg-[#FDFCF8] border border-[#DED8CF] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#5D7052]" />
                <span className="text-sm font-bold text-[#2C2C24]">ตัวกรองช่วงเวลา</span>
                <span className="text-xs text-[#78786C]">
                  ({formatThaiDate(effectiveStartDate, false)} - {formatThaiDate(effectiveEndDate, true)})
                </span>
              </div>

              <button
                onClick={handleResetFilter}
                className="text-xs text-[#78786C] hover:text-[#2C2C24] flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#DED8CF] hover:bg-[#F0EBE5] transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>รีเซ็ต</span>
              </button>
            </div>

            {/* Presets & Custom Selector */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setDatePreset('today')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  datePreset === 'today'
                    ? 'bg-[#5D7052] text-white border-[#5D7052]'
                    : 'bg-white text-[#5C5C50] border-[#DED8CF] hover:bg-[#F4EFEA]'
                }`}
              >
                วันนี้
              </button>

              <button
                onClick={() => setDatePreset('7days')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  datePreset === '7days'
                    ? 'bg-[#5D7052] text-white border-[#5D7052]'
                    : 'bg-white text-[#5C5C50] border-[#DED8CF] hover:bg-[#F4EFEA]'
                }`}
              >
                7 วัน
              </button>

              <button
                onClick={() => setDatePreset('30days')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  datePreset === '30days'
                    ? 'bg-[#5D7052] text-white border-[#5D7052]'
                    : 'bg-white text-[#5C5C50] border-[#DED8CF] hover:bg-[#F4EFEA]'
                }`}
              >
                30 วัน
              </button>

              <button
                onClick={() => setDatePreset('custom')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  datePreset === 'custom'
                    ? 'bg-[#5D7052] text-white border-[#5D7052]'
                    : 'bg-white text-[#5C5C50] border-[#DED8CF] hover:bg-[#F4EFEA]'
                }`}
              >
                กำหนดเอง
              </button>

              {datePreset === 'custom' && (
                <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0 sm:ml-2">
                  <div className="flex items-center gap-1.5 text-xs text-[#5C5C50]">
                    <span>เริ่มต้น:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={e => setCustomStartDate(e.target.value)}
                      className="px-2 py-1 bg-white border border-[#DED8CF] rounded-md text-xs focus:outline-none focus:border-[#5D7052]"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-[#5C5C50]">
                    <span>สิ้นสุด:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={e => setCustomEndDate(e.target.value)}
                      className="px-2 py-1 bg-white border border-[#DED8CF] rounded-md text-xs focus:outline-none focus:border-[#5D7052]"
                    />
                  </div>

                  <button
                    onClick={handleApplyCustomDate}
                    className="px-3 py-1 bg-[#5D7052] text-white text-xs font-semibold rounded-md hover:bg-[#48573F] transition-all"
                  >
                    ดูสถิติ
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 4 Summary Metric Cards (Actual Counts Only) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-[#FDFCF8] border border-[#DED8CF] rounded-2xl p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between text-[#78786C] text-xs font-medium mb-2">
                <span>ประชาชน</span>
                <Users className="w-4 h-4 text-[#5D7052]" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-bold font-heading text-[#2C2C24]">
                  {metricCards.citizensCount.toLocaleString()}
                </span>
                <span className="text-xs text-[#78786C]">คน</span>
              </div>
            </div>

            <div className="bg-[#FDFCF8] border border-[#DED8CF] rounded-2xl p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between text-[#78786C] text-xs font-medium mb-2">
                <span>บันทึกสุขภาพ</span>
                <Activity className="w-4 h-4 text-[#0284C7]" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-bold font-heading text-[#2C2C24]">
                  {metricCards.recordsCount.toLocaleString()}
                </span>
                <span className="text-xs text-[#78786C]">รายการ</span>
              </div>
            </div>

            <div className="bg-[#FDFCF8] border border-[#DED8CF] rounded-2xl p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between text-[#78786C] text-xs font-medium mb-2">
                <span>รายงานทั้งหมด</span>
                <FileText className="w-4 h-4 text-[#D97706]" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-bold font-heading text-[#2C2C24]">
                  {metricCards.totalReportsCount.toLocaleString()}
                </span>
                <span className="text-xs text-[#78786C]">ฉบับ</span>
              </div>
            </div>

            <div className="bg-[#FDFCF8] border border-[#DED8CF] rounded-2xl p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between text-[#78786C] text-xs font-medium mb-2">
                <span>รายงานที่รับแล้ว</span>
                <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-bold font-heading text-[#2C2C24]">
                  {metricCards.acceptedReportsCount.toLocaleString()}
                </span>
                <span className="text-xs text-[#78786C]">ฉบับ</span>
              </div>
            </div>
          </div>

          {/* Perspective 1 — Trend Dashboard */}
          <div className="bg-[#FDFCF8] border border-[#DED8CF] rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold font-heading text-[#2C2C24] flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#5D7052]" />
                  <span>กราฟจำนวนข้อมูลตามวัน (Trend Dashboard)</span>
                </h2>
                <p className="text-xs text-[#78786C]">
                  แสดงแนวโน้มปริมาณข้อมูลที่เกิดขึ้นจริงในแต่ละวัน
                </p>
              </div>

              {/* Trend Metric Picker */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setOverviewTrendMetric('records')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                    overviewTrendMetric === 'records'
                      ? 'bg-[#5D7052] text-white border-[#5D7052]'
                      : 'bg-white text-[#5C5C50] border-[#DED8CF] hover:bg-[#F4EFEA]'
                  }`}
                >
                  บันทึกสุขภาพ
                </button>
                <button
                  onClick={() => setOverviewTrendMetric('citizens')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                    overviewTrendMetric === 'citizens'
                      ? 'bg-[#5D7052] text-white border-[#5D7052]'
                      : 'bg-white text-[#5C5C50] border-[#DED8CF] hover:bg-[#F4EFEA]'
                  }`}
                >
                  ประชาชน
                </button>
                <button
                  onClick={() => setOverviewTrendMetric('reports_total')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                    overviewTrendMetric === 'reports_total'
                      ? 'bg-[#5D7052] text-white border-[#5D7052]'
                      : 'bg-white text-[#5C5C50] border-[#DED8CF] hover:bg-[#F4EFEA]'
                  }`}
                >
                  รายงานทั้งหมด
                </button>
                <button
                  onClick={() => setOverviewTrendMetric('reports_received')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                    overviewTrendMetric === 'reports_received'
                      ? 'bg-[#5D7052] text-white border-[#5D7052]'
                      : 'bg-white text-[#5C5C50] border-[#DED8CF] hover:bg-[#F4EFEA]'
                  }`}
                >
                  รายงานที่รับ
                </button>
                <button
                  onClick={() => setOverviewTrendMetric('reports_sent')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                    overviewTrendMetric === 'reports_sent'
                      ? 'bg-[#5D7052] text-white border-[#5D7052]'
                      : 'bg-white text-[#5C5C50] border-[#DED8CF] hover:bg-[#F4EFEA]'
                  }`}
                >
                  รายงานที่ส่ง
                </button>
              </div>
            </div>

            {/* Recharts Trend Chart */}
            <div className="h-64 sm:h-72 w-full pt-4">
              {trendData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-[#78786C]">
                  ไม่มีข้อมูลในช่วงเวลานี้
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#5D7052" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#5D7052" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E6E0D8" vertical={false} />
                    <XAxis 
                      dataKey="displayDate" 
                      tick={{ fontSize: 11, fill: '#78786C' }} 
                      tickLine={false} 
                      axisLine={{ stroke: '#DED8CF' }}
                    />
                    <YAxis 
                      allowDecimals={false} 
                      tick={{ fontSize: 11, fill: '#78786C' }} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <Tooltip 
                      formatter={(val: any) => [`${val} รายการ`, 'จำนวน']}
                      labelFormatter={(label) => `วันที่: ${label}`}
                      contentStyle={{ 
                        backgroundColor: '#FDFCF8', 
                        borderColor: '#DED8CF', 
                        borderRadius: '12px',
                        fontSize: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey={overviewTrendMetric} 
                      name={
                        overviewTrendMetric === 'records' ? 'บันทึกสุขภาพ' :
                        overviewTrendMetric === 'citizens' ? 'ประชาชน' :
                        overviewTrendMetric === 'reports_total' ? 'รายงานทั้งหมด' :
                        overviewTrendMetric === 'reports_received' ? 'รายงานที่รับ' : 'รายงานที่ส่ง'
                      }
                      stroke="#5D7052" 
                      strokeWidth={2.5}
                      fillOpacity={1} 
                      fill="url(#trendGradient)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Bottom Trend Comparison Strip */}
            <div className="border-t border-[#E6E0D8] pt-4 mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FAF8F5] p-3 rounded-xl">
              <div>
                <span className="text-[11px] text-[#78786C] block">วันนี้</span>
                <span className="text-base font-bold text-[#2C2C24]">
                  {trendComparisonStats.today.toLocaleString()} <span className="text-xs font-normal text-[#78786C]">รายการ</span>
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[#78786C] block">เมื่อวาน</span>
                <span className="text-base font-bold text-[#2C2C24]">
                  {trendComparisonStats.yesterday.toLocaleString()} <span className="text-xs font-normal text-[#78786C]">รายการ</span>
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[#78786C] block">7 วันที่ผ่านมา</span>
                <span className="text-base font-bold text-[#2C2C24]">
                  {trendComparisonStats.past7Days.toLocaleString()} <span className="text-xs font-normal text-[#78786C]">รายการ</span>
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[#78786C] block">เดือนนี้</span>
                <span className="text-base font-bold text-[#2C2C24]">
                  {trendComparisonStats.thisMonth.toLocaleString()} <span className="text-xs font-normal text-[#78786C]">รายการ</span>
                </span>
              </div>
            </div>
          </div>

          {/* Perspective 2 & 3: Distribution & Activity Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Perspective 2 — Distribution Dashboard (Donut) */}
            <div className="bg-[#FDFCF8] border border-[#DED8CF] rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold font-heading text-[#2C2C24] flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-[#5D7052]" />
                  <span>สัดส่วนประเภทข้อมูลสุขภาพที่บันทึกจริง</span>
                </h2>
                <p className="text-xs text-[#78786C]">
                  จำแนกตามประเภทค่าวัดที่ถูกตรวจบันทึกเข้าสู่ระบบ
                </p>
              </div>

              {distributionData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-[#78786C]">
                  ยังไม่มีบันทึกข้อมูลสุขภาพในช่วงเวลานี้
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                  <div className="w-48 h-48 sm:w-56 sm:h-56 relative flex items-center justify-center shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={distributionData}
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="count"
                        >
                          {distributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(val: any) => [`${val} รายการ`, 'จำนวน']}
                          contentStyle={{ 
                            backgroundColor: '#FDFCF8', 
                            borderColor: '#DED8CF', 
                            borderRadius: '10px',
                            fontSize: '11px' 
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xl font-bold font-heading text-[#2C2C24]">
                        {filteredRecords.length}
                      </span>
                      <span className="text-[10px] text-[#78786C]">Records</span>
                    </div>
                  </div>

                  <div className="flex-1 w-full space-y-2">
                    {distributionData.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-[#FAF8F5] transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-[#2C2C24] font-medium">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2 font-semibold">
                          <span className="text-[#2C2C24]">{item.count.toLocaleString()}</span>
                          <span className="text-[10px] text-[#78786C] w-8 text-right">({item.pct}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Perspective 3 — Activity Overview (Exchange Activity) */}
            <div className="bg-[#FDFCF8] border border-[#DED8CF] rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold font-heading text-[#2C2C24] flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#5D7052]" />
                  <span>กิจกรรมการแลกเปลี่ยนข้อมูล (Activity Overview)</span>
                </h2>
                <p className="text-xs text-[#78786C]">
                  ภาพรวมการรับ-ส่งและสถานะรายงานในช่วงเวลาที่เลือก
                </p>
              </div>

              <div className="h-64 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    layout="vertical" 
                    data={activityData} 
                    margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E6E0D8" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#78786C' }} />
                    <YAxis dataKey="activity" type="category" tick={{ fontSize: 11, fill: '#2C2C24' }} width={85} />
                    <Tooltip 
                      formatter={(val: any) => [`${val} ฉบับ`, 'จำนวน']}
                      contentStyle={{ 
                        backgroundColor: '#FDFCF8', 
                        borderColor: '#DED8CF', 
                        borderRadius: '10px',
                        fontSize: '11px' 
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {activityData.map((entry, index) => (
                        <Cell key={`bar-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center pt-2 border-t border-[#E6E0D8]">
                {activityData.map((act, idx) => (
                  <div key={idx} className="bg-[#FAF8F5] p-2 rounded-lg">
                    <span className="text-[10px] text-[#78786C] block truncate">{act.activity}</span>
                    <span className="text-sm font-bold text-[#2C2C24]">{act.count}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ==========================================
          ② สถิติรายคน (INDIVIDUAL VIEW)
          ========================================== */}
      {viewMode === 'individual' && (
        <div className="space-y-6">

          {/* Citizen Search & Selector */}
          <div className="bg-[#FDFCF8] border border-[#DED8CF] rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
            <label className="text-xs sm:text-sm font-bold text-[#2C2C24] flex items-center gap-2">
              <Search className="w-4 h-4 text-[#5D7052]" />
              <span>ค้นหาประชาชนเพื่อดูสถิติสุขภาพรายบุคคล</span>
            </label>

            <div className="relative">
              <input
                type="text"
                value={citizenSearchQuery}
                onChange={e => setCitizenSearchQuery(e.target.value)}
                placeholder="🔍 ค้นหาชื่อ, นามสกุล, เลขบัตรประชาชน 13 หลัก, หรือเบอร์โทร..."
                className="w-full px-4 py-2.5 bg-white border border-[#DED8CF] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#5D7052] transition-colors"
              />
              {citizenSearchQuery && (
                <button
                  onClick={() => setCitizenSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#78786C] hover:text-[#2C2C24]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick Suggestions / Selected Pills */}
            <div className="flex flex-wrap gap-2 pt-1 max-h-36 overflow-y-auto">
              {citizenSearchResults.map(c => {
                const isSelected = c.id === selectedCitizenId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCitizenId(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#5D7052] text-white border-[#5D7052] shadow-sm font-semibold'
                        : 'bg-white text-[#4A4A40] border-[#DED8CF] hover:bg-[#F0EBE5]'
                    }`}
                  >
                    <span>{c.prefix || ''}{c.firstName} {c.lastName}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-[#78786C]'}`}>
                      (ม.{c.moo || '-'})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Profile Summary Card */}
          {selectedCitizen ? (
            <div className="bg-[#FDFCF8] border border-[#DED8CF] rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E6E0D8] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#5D7052] text-white flex items-center justify-center text-lg font-bold shadow-soft shrink-0">
                    {selectedCitizen.firstName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg sm:text-xl font-bold font-heading text-[#2C2C24]">
                        {selectedCitizen.prefix || ''}{selectedCitizen.firstName} {selectedCitizen.lastName}
                      </h2>
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#F0EBE5] text-[#5C5C50] rounded-md border border-[#DED8CF]">
                        {selectedCitizen.gender}
                      </span>
                    </div>
                    <p className="text-xs text-[#78786C] flex items-center gap-2 mt-0.5">
                      <span>อายุ {selectedCitizen.age} ปี</span>
                      <span>•</span>
                      <span>บ้านเลขที่ {selectedCitizen.houseNo} {selectedCitizen.moo} {selectedCitizen.villageName}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedCitizenForProfile(selectedCitizen)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#DED8CF] hover:bg-[#F0EBE5] text-[#2C2C24] transition-colors flex items-center gap-1.5"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>ดูประวัติเต็ม</span>
                  </button>
                </div>
              </div>

              {/* Stats Counters for this Citizen */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#FAF8F5] p-3 sm:p-4 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#5D7052]/10 text-[#5D7052] flex items-center justify-center font-bold">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] text-[#78786C] block">บันทึกสุขภาพทั้งหมด</span>
                    <span className="text-base font-bold text-[#2C2C24]">
                      {citizenRecords.length} <span className="text-xs font-normal text-[#78786C]">รายการ</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#0284C7]/10 text-[#0284C7] flex items-center justify-center font-bold">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] text-[#78786C] block">รายงานที่เกี่ยวข้อง</span>
                    <span className="text-base font-bold text-[#2C2C24]">
                      {citizenSharedReportsCount} <span className="text-xs font-normal text-[#78786C]">ฉบับ</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#16A34A]/10 text-[#16A34A] flex items-center justify-center font-bold">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] text-[#78786C] block">บันทึกล่าสุด</span>
                    <span className="text-base font-bold text-[#2C2C24]">
                      {citizenRecords.length > 0 ? formatThaiDate(citizenRecords[citizenRecords.length - 1].date) : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#FDFCF8] border border-[#DED8CF] rounded-2xl p-8 text-center text-[#78786C] text-xs">
              ไม่พบข้อมูลประชาชนที่เลือก
            </div>
          )}

          {/* Individual Health Trend & Distribution Grid */}
          {selectedCitizen && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Individual Section 1 — Health Trend (2 Cols) */}
              <div className="lg:col-span-2 bg-[#FDFCF8] border border-[#DED8CF] rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold font-heading text-[#2C2C24] flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-[#5D7052]" />
                      <span>แนวโน้มสุขภาพตามเวลา (Health Trend)</span>
                    </h3>
                    <p className="text-xs text-[#78786C]">
                      ติดตามการเปลี่ยนแปลงของค่าวัดสุขภาพในแต่ละครั้งที่ตรวจ
                    </p>
                  </div>

                  {/* Metric Switcher */}
                  <select
                    value={individualMetric}
                    onChange={e => setIndividualMetric(e.target.value as any)}
                    className="px-3 py-1.5 bg-white border border-[#DED8CF] rounded-lg text-xs font-semibold text-[#2C2C24] focus:outline-none focus:border-[#5D7052]"
                  >
                    <option value="bp">ความดันโลหิต (SYS / DIA)</option>
                    <option value="weight">น้ำหนัก & BMI</option>
                    <option value="sugar">น้ำตาลในเลือด (DTX)</option>
                    <option value="pulse">ชีพจร / การเต้นหัวใจ</option>
                    <option value="temp">อุณหภูมิร่างกาย</option>
                  </select>
                </div>

                {individualTrendData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-xs text-[#78786C]">
                    ยังไม่มีบันทึกข้อมูลสุขภาพของประชาชนรายนี้
                  </div>
                ) : (
                  <div className="h-64 sm:h-72 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={individualTrendData} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E6E0D8" vertical={false} />
                        <XAxis dataKey="displayDate" tick={{ fontSize: 11, fill: '#78786C' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#78786C' }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#FDFCF8', 
                            borderColor: '#DED8CF', 
                            borderRadius: '10px',
                            fontSize: '12px' 
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

                        {individualMetric === 'bp' && (
                          <>
                            <Line type="monotone" dataKey="systolic" name="ความดันค่าบน (SYS mmHg)" stroke="#DC2626" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="diastolic" name="ความดันค่าล่าง (DIA mmHg)" stroke="#0284C7" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                          </>
                        )}

                        {individualMetric === 'weight' && (
                          <>
                            <Line type="monotone" dataKey="weight" name="น้ำหนัก (กก.)" stroke="#D97706" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="bmi" name="BMI" stroke="#5D7052" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
                          </>
                        )}

                        {individualMetric === 'sugar' && (
                          <Line type="monotone" dataKey="bloodSugar" name="น้ำตาลในเลือด (mg/dL)" stroke="#DC2626" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        )}

                        {individualMetric === 'pulse' && (
                          <Line type="monotone" dataKey="pulse" name="ชีพจร (ครั้ง/นาที)" stroke="#0284C7" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        )}

                        {individualMetric === 'temp' && (
                          <Line type="monotone" dataKey="temperature" name="อุณหภูมิ (°C)" stroke="#EA580C" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Individual Section 2 — Distribution Donut (1 Col) */}
              <div className="bg-[#FDFCF8] border border-[#DED8CF] rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
                <div>
                  <h3 className="text-base font-bold font-heading text-[#2C2C24] flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5 text-[#5D7052]" />
                    <span>สัดส่วนข้อมูลที่บันทึก</span>
                  </h3>
                  <p className="text-xs text-[#78786C]">
                    การกระจายตัวของค่าวัดที่เคยตรวจ
                  </p>
                </div>

                {individualDistributionData.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-xs text-[#78786C]">
                    ไม่มีข้อมูล
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="h-44 relative flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={individualDistributionData}
                            innerRadius={45}
                            outerRadius={65}
                            paddingAngle={4}
                            dataKey="count"
                          >
                            {individualDistributionData.map((entry, index) => (
                              <Cell key={`ind-cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(val: any) => [`${val} ครั้ง`, 'จำนวนบันทึก']}
                            contentStyle={{ 
                              backgroundColor: '#FDFCF8', 
                              borderColor: '#DED8CF', 
                              borderRadius: '10px',
                              fontSize: '11px' 
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-lg font-bold font-heading text-[#2C2C24]">
                          {citizenRecords.length}
                        </span>
                        <span className="text-[10px] text-[#78786C]">ครั้ง</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {individualDistributionData.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs p-1 rounded hover:bg-[#FAF8F5]">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-[#2C2C24] font-medium">{item.name}</span>
                          </div>
                          <span className="font-semibold text-[#2C2C24]">{item.count} ครั้ง</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Individual Section 3 — Interactive Timeline */}
          {selectedCitizen && (
            <div className="bg-[#FDFCF8] border border-[#DED8CF] rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-bold font-heading text-[#2C2C24] flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#5D7052]" />
                  <span>ประวัติข้อมูลสุขภาพตามลำดับเวลา (Timeline)</span>
                </h3>
                <p className="text-xs text-[#78786C]">
                  คลิกที่รายการเพื่อดูรายละเอียดและผลการตรวจครบถ้วน
                </p>
              </div>

              {groupedTimeline.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#78786C]">
                  ยังไม่มีประวัติการบันทึกข้อมูลสุขภาพ
                </div>
              ) : (
                <div className="space-y-6 pt-2">
                  {groupedTimeline.map((group, gIdx) => (
                    <div key={gIdx} className="relative pl-6 border-l-2 border-[#5D7052]/30 space-y-3">
                      {/* Date Marker Pin */}
                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[#5D7052] border-2 border-white flex items-center justify-center text-white" />

                      <div className="text-xs font-bold text-[#5D7052] font-heading bg-[#F0EBE5] inline-block px-2.5 py-0.5 rounded-md">
                        {group.thaiDate}
                      </div>

                      <div className="space-y-2">
                        {group.records.map((rec) => (
                          <div
                            key={rec.id}
                            onClick={() => setSelectedTimelineRecord(rec)}
                            className="bg-white border border-[#DED8CF] rounded-xl p-3.5 hover:border-[#5D7052] hover:shadow-soft transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[#2C2C24]">
                                  {rec.time || 'ตรวจสุขภาพ'}
                                </span>
                                <span className="text-[10px] text-[#78786C]">
                                  ผู้ตรวจ: {rec.examinerName}
                                </span>
                              </div>

                              {/* Snapshot Metric Badges */}
                              <div className="flex flex-wrap gap-2 pt-1">
                                {(rec.systolic || rec.diastolic) && (
                                  <span className="px-2 py-0.5 text-xs bg-[#5D7052]/10 text-[#5D7052] font-semibold rounded-md">
                                    BP: {rec.systolic || '-'}/{rec.diastolic || '-'} mmHg
                                  </span>
                                )}
                                {rec.weight && (
                                  <span className="px-2 py-0.5 text-xs bg-[#D97706]/10 text-[#D97706] font-semibold rounded-md">
                                    น้ำหนัก: {rec.weight} kg {rec.bmi ? `(BMI ${rec.bmi})` : ''}
                                  </span>
                                )}
                                {rec.bloodSugar && (
                                  <span className="px-2 py-0.5 text-xs bg-[#DC2626]/10 text-[#DC2626] font-semibold rounded-md">
                                    น้ำตาล: {rec.bloodSugar} mg/dL {rec.bloodSugarFasting ? '(งดอาหาร)' : ''}
                                  </span>
                                )}
                                {rec.pulse && (
                                  <span className="px-2 py-0.5 text-xs bg-[#0284C7]/10 text-[#0284C7] font-semibold rounded-md">
                                    ชีพจร: {rec.pulse} bpm
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 text-xs text-[#5D7052] font-semibold group-hover:translate-x-0.5 transition-transform self-end sm:self-auto">
                              <span>ดูรายละเอียด</span>
                              <ChevronRight className="w-4 h-4" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* Record Detail Modal */}
      {selectedTimelineRecord && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FDFCF8] border border-[#DED8CF] rounded-2xl p-5 sm:p-6 max-w-lg w-full shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E6E0D8] pb-3">
              <div>
                <h3 className="text-base font-bold font-heading text-[#2C2C24]">
                  รายละเอียดบันทึกสุขภาพ
                </h3>
                <p className="text-xs text-[#78786C]">
                  {formatThaiDate(selectedTimelineRecord.date, true)} {selectedTimelineRecord.time ? `• เวลา ${selectedTimelineRecord.time}` : ''}
                </p>
              </div>
              <button
                onClick={() => setSelectedTimelineRecord(null)}
                className="w-8 h-8 rounded-full border border-[#DED8CF] flex items-center justify-center text-[#78786C] hover:text-[#2C2C24]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-[#FAF8F5] p-3 rounded-xl">
                <span className="text-[#78786C] block">ความดันโลหิต</span>
                <span className="text-sm font-bold text-[#2C2C24]">
                  {selectedTimelineRecord.systolic || '-'}/{selectedTimelineRecord.diastolic || '-'} mmHg
                </span>
              </div>

              <div className="bg-[#FAF8F5] p-3 rounded-xl">
                <span className="text-[#78786C] block">ชีพจร</span>
                <span className="text-sm font-bold text-[#2C2C24]">
                  {selectedTimelineRecord.pulse ? `${selectedTimelineRecord.pulse} ครั้ง/นาที` : '-'}
                </span>
              </div>

              <div className="bg-[#FAF8F5] p-3 rounded-xl">
                <span className="text-[#78786C] block">น้ำหนัก / ส่วนสูง</span>
                <span className="text-sm font-bold text-[#2C2C24]">
                  {selectedTimelineRecord.weight ? `${selectedTimelineRecord.weight} กก.` : '-'} / {selectedTimelineRecord.height ? `${selectedTimelineRecord.height} ซม.` : '-'}
                </span>
              </div>

              <div className="bg-[#FAF8F5] p-3 rounded-xl">
                <span className="text-[#78786C] block">ดัชนีมวลกาย (BMI)</span>
                <span className="text-sm font-bold text-[#2C2C24]">
                  {selectedTimelineRecord.bmi || '-'}
                </span>
              </div>

              <div className="bg-[#FAF8F5] p-3 rounded-xl">
                <span className="text-[#78786C] block">น้ำตาลในเลือด (DTX)</span>
                <span className="text-sm font-bold text-[#2C2C24]">
                  {selectedTimelineRecord.bloodSugar ? `${selectedTimelineRecord.bloodSugar} mg/dL` : '-'}
                </span>
              </div>

              <div className="bg-[#FAF8F5] p-3 rounded-xl">
                <span className="text-[#78786C] block">อุณหภูมิร่างกาย</span>
                <span className="text-sm font-bold text-[#2C2C24]">
                  {selectedTimelineRecord.temperature ? `${selectedTimelineRecord.temperature} °C` : '-'}
                </span>
              </div>
            </div>

            {selectedTimelineRecord.notes && (
              <div className="bg-[#FAF8F5] p-3 rounded-xl text-xs space-y-1">
                <span className="text-[#78786C] font-semibold block">บันทึกเพิ่มเติม:</span>
                <p className="text-[#2C2C24]">{selectedTimelineRecord.notes}</p>
              </div>
            )}

            <div className="text-xs text-[#78786C] pt-2 border-t border-[#E6E0D8] flex items-center justify-between">
              <span>ผู้บันทึกตรวจ: {selectedTimelineRecord.examinerName}</span>
              <button
                onClick={() => setSelectedTimelineRecord(null)}
                className="px-4 py-1.5 bg-[#5D7052] text-white rounded-lg text-xs font-semibold hover:bg-[#48573F]"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
