import React, { useState, useEffect, useMemo } from 'react';
import { 
  Inbox, 
  Send, 
  Download, 
  FileSpreadsheet, 
  User, 
  Phone, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  RefreshCw, 
  Trash2, 
  ArrowDownToLine, 
  Share2, 
  Building2, 
  Eye, 
  X, 
  Users, 
  Stethoscope, 
  Check, 
  XCircle,
  UserCheck,
  ShieldCheck,
  Calendar,
  Layers,
  Heart,
  Filter,
  ArrowRight,
  FileText,
  Copy,
  AlertTriangle,
  RotateCcw,
  Ban
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SharedReport, HealthRecord, Citizen } from '../types';
import { lookupReceiverProfile, supabase } from '../lib/supabase';
import { formatThaiDate } from '../utils/healthCalculations';

export const InboxView: React.FC = () => {
  const { 
    user, 
    vhvProfile, 
    citizens, 
    records, 
    sharedReportsReceived, 
    sharedReportsSent, 
    sendSharedReport,
    sendReportToPhone, 
    acceptSharedReport,
    rejectSharedReport,
    downloadSharedReport, 
    deleteSharedReport, 
    fetchSharedReports,
    unreadReceivedCount,
    inboxActiveTab,
    setInboxActiveTab
  } = useApp();

  // Top Tabs: 🗂️ จัดการรายงาน | 📤 ส่งรายงาน | 📥 รับรายงาน
  const [localActiveTab, setLocalActiveTab] = useState<'manage' | 'send' | 'receive'>('manage');
  const activeTab = inboxActiveTab || localActiveTab;
  const setActiveTab = (tab: 'manage' | 'send' | 'receive') => {
    if (setInboxActiveTab) {
      setInboxActiveTab(tab);
    }
    setLocalActiveTab(tab);
  };
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Global Alert/Feedback
  const [actionAlert, setActionAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Clear alert after 5s
  useEffect(() => {
    if (actionAlert) {
      const timer = setTimeout(() => setActionAlert(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [actionAlert]);

  // Initial fetch on mount
  useEffect(() => {
    let active = true;
    fetchSharedReports().catch(err => {
      if (active) console.error('fetchSharedReports error:', err);
    });
    return () => {
      active = false;
    };
  }, [fetchSharedReports]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchSharedReports();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // ==========================================
  // 1. 🗂️ จัดการรายงาน (REPORT MANAGEMENT)
  // ==========================================
  const getTodayString = () => new Date().toISOString().split('T')[0];
  const [manageSearchQuery, setManageSearchQuery] = useState('');
  const [manageStatusFilter, setManageStatusFilter] = useState<string>('all');
  const [manageDirectionFilter, setManageDirectionFilter] = useState<'all' | 'sent' | 'received'>('all');
  const [manageDatePreset, setManageDatePreset] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all');
  const [manageStartDate, setManageStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [manageEndDate, setManageEndDate] = useState(getTodayString());

  // Combined reports list for management
  const allManagedReports = useMemo(() => {
    const combined: Array<SharedReport & { direction: 'sent' | 'received' }> = [];
    sharedReportsSent.forEach(r => combined.push({ ...r, direction: 'sent' }));
    sharedReportsReceived.forEach(r => combined.push({ ...r, direction: 'received' }));

    // Sort newest first
    return combined.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [sharedReportsSent, sharedReportsReceived]);

  // Filtered reports for Management table
  const filteredManagedReports = useMemo(() => {
    const query = manageSearchQuery.trim().toLowerCase();
    const todayStr = getTodayString();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    return allManagedReports.filter(r => {
      // Direction
      if (manageDirectionFilter === 'sent' && r.direction !== 'sent') return false;
      if (manageDirectionFilter === 'received' && r.direction !== 'received') return false;

      // Status
      if (manageStatusFilter !== 'all' && r.status !== manageStatusFilter) return false;

      // Date preset
      const rDate = (r.createdAt || '').split('T')[0];
      if (manageDatePreset === 'today' && rDate !== todayStr) return false;
      if (manageDatePreset === '7days' && rDate < sevenDaysAgoStr) return false;
      if (manageDatePreset === '30days' && rDate < thirtyDaysAgoStr) return false;
      if (manageDatePreset === 'custom') {
        if (manageStartDate && rDate < manageStartDate) return false;
        if (manageEndDate && rDate > manageEndDate) return false;
      }

      // Search Query
      if (query) {
        const title = (r.title || '').toLowerCase();
        const note = (r.note || r.message || '').toLowerCase();
        const sender = (r.senderName || '').toLowerCase();
        const senderPhone = (r.senderPhone || '').toLowerCase();
        const receiver = (r.receiverName || '').toLowerCase();
        const receiverPhone = (r.receiverPhone || '').toLowerCase();
        return title.includes(query) || note.includes(query) || sender.includes(query) ||
          senderPhone.includes(query) || receiver.includes(query) || receiverPhone.includes(query);
      }

      return true;
    });
  }, [allManagedReports, manageDirectionFilter, manageStatusFilter, manageDatePreset, manageStartDate, manageEndDate, manageSearchQuery]);

  // Snapshot Detail Modal State
  const [detailModalReport, setDetailModalReport] = useState<SharedReport | null>(null);
  const [detailModalTab, setDetailModalTab] = useState<'citizens' | 'records'>('citizens');

  // Cancel Report Action
  const handleCancelReport = async (reportId: string) => {
    if (!confirm('คุณต้องการยกเลิกรายงานฉบับนี้ใช่หรือไม่?')) return;
    try {
      if (supabase) {
        await supabase.from('shared_reports').update({ status: 'cancelled' }).eq('id', reportId);
      }
      await fetchSharedReports();
      setActionAlert({ type: 'success', message: 'ยกเลิกรายงานเรียบร้อยแล้ว' });
      setDetailModalReport(null);
    } catch (err: any) {
      setActionAlert({ type: 'error', message: 'เกิดข้อผิดพลาดในการยกเลิกรายงาน' });
    }
  };

  // ==========================================
  // 2. 📤 ส่งรายงาน (SEND REPORT WIZARD)
  // ==========================================
  const [sendDatePreset, setSendDatePreset] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('30days');
  const [sendStartDate, setSendStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [sendEndDate, setSendEndDate] = useState(getTodayString());

  const [receiverInput, setReceiverInput] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupUser, setLookupUser] = useState<{ userId: string; name: string; phone: string; villageName?: string; healthCenterName?: string } | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [includeCitizens, setIncludeCitizens] = useState(true);
  const [includeRecords, setIncludeRecords] = useState(true);
  const [selectedCitizenFilter, setSelectedCitizenFilter] = useState<string>('all');
  const [customReportTitle, setCustomReportTitle] = useState('');
  const [customReportNote, setCustomReportNote] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Debounced lookup for receiver phone or email
  useEffect(() => {
    let active = true;
    const query = receiverInput.trim();
    const cleanDigits = query.replace(/\D/g, '');

    if (cleanDigits.length >= 9 || (query.includes('@') && query.length >= 5)) {
      setLookupLoading(true);
      setLookupError(null);

      const timer = setTimeout(async () => {
        try {
          const res = await lookupReceiverProfile(query);
          if (!active) return;
          setLookupLoading(false);
          if (res.success && res.data) {
            if (res.data.userId === user?.id) {
              setLookupError('นี่คือบัญชีของคุณเอง ไม่สามารถส่งหาตัวเองได้');
              setLookupUser(null);
            } else {
              setLookupUser(res.data);
              setLookupError(null);
            }
          } else {
            setLookupUser(null);
            setLookupError(res.error || 'ไม่พบผู้ใช้ในระบบ');
          }
        } catch (err) {
          if (!active) return;
          setLookupLoading(false);
          setLookupUser(null);
          setLookupError('เกิดข้อผิดพลาดในการค้นหาผู้ใช้');
        }
      }, 400);

      return () => {
        active = false;
        clearTimeout(timer);
      };
    } else {
      setLookupUser(null);
      setLookupError(null);
      setLookupLoading(false);
    }
  }, [receiverInput, user?.id]);

  // Compute effective scope of records and citizens to send
  const sendScope = useMemo(() => {
    const todayStr = getTodayString();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    // Filter health records
    const targetRecords = records.filter(r => {
      if (selectedCitizenFilter !== 'all' && r.citizenId !== selectedCitizenFilter) return false;
      if (sendDatePreset === 'today' && r.date !== todayStr) return false;
      if (sendDatePreset === '7days' && r.date < sevenDaysAgoStr) return false;
      if (sendDatePreset === '30days' && r.date < thirtyDaysAgoStr) return false;
      if (sendDatePreset === 'custom') {
        if (sendStartDate && r.date < sendStartDate) return false;
        if (sendEndDate && r.date > sendEndDate) return false;
      }
      return true;
    });

    // Associated citizens
    let targetCitizens: Citizen[] = [];
    if (selectedCitizenFilter !== 'all') {
      const cit = citizens.find(c => c.id === selectedCitizenFilter);
      if (cit) targetCitizens = [cit];
    } else if (targetRecords.length > 0) {
      const citIds = new Set(targetRecords.map(r => r.citizenId));
      targetCitizens = citizens.filter(c => citIds.has(c.id));
    } else {
      targetCitizens = citizens;
    }

    const periodLabel = sendDatePreset === 'today' ? 'วันนี้' :
      sendDatePreset === '7days' ? '7 วันที่ผ่านมา' :
      sendDatePreset === '30days' ? '30 วันที่ผ่านมา' :
      sendDatePreset === 'custom' ? `${formatThaiDate(sendStartDate, false)} - ${formatThaiDate(sendEndDate, true)}` : 'ข้อมูลทั้งหมด';

    return {
      records: includeRecords ? targetRecords : [],
      citizens: includeCitizens ? targetCitizens : [],
      periodLabel
    };
  }, [records, citizens, selectedCitizenFilter, sendDatePreset, sendStartDate, sendEndDate, includeCitizens, includeRecords]);

  // Execute Send Report
  const handleExecuteSend = async () => {
    if (isSending) return;

    if (!receiverInput.trim() && !lookupUser) {
      setActionAlert({ type: 'error', message: 'กรุณาระบุข้อมูลผู้รับ (เบอร์โทร หรือ อีเมล)' });
      return;
    }

    if (sendScope.citizens.length === 0 && sendScope.records.length === 0) {
      setActionAlert({ type: 'error', message: 'ไม่มีข้อมูลประชาชนหรือบันทึกสุขภาพในช่วงเวลาที่เลือก' });
      return;
    }

    setIsSending(true);
    try {
      const cleanPhone = receiverInput.replace(/\D/g, '').trim();
      const defaultTitle = selectedCitizenFilter !== 'all' 
        ? `รายงานสุขภาพ: ${sendScope.citizens[0]?.prefix || ''}${sendScope.citizens[0]?.firstName || ''} ${sendScope.citizens[0]?.lastName || ''}`
        : `รายงานสุขภาพชุมชน (${sendScope.periodLabel})`;

      const res = await sendSharedReport({
        citizen: sendScope.citizens[0] || {
          id: `cit-${Date.now()}`,
          idCard: '',
          prefix: '',
          firstName: 'รายงานรวม',
          lastName: '',
          gender: 'อื่นๆ',
          age: 0,
          phone: '',
          houseNo: '',
          moo: '',
          villageName: vhvProfile.villageName || '',
          healthRight: 'บัตรทอง (UC/สปสช.)',
          chronicDiseases: [],
          createdAt: new Date().toISOString()
        },
        citizens: sendScope.citizens,
        records: sendScope.records,
        receiverId: lookupUser?.userId,
        receiverPhone: lookupUser?.phone || cleanPhone,
        receiverEmail: receiverInput.includes('@') ? receiverInput.trim() : undefined,
        receiverName: lookupUser?.name,
        title: customReportTitle.trim() || defaultTitle,
        note: customReportNote.trim() || undefined
      });

      setIsSending(false);
      if (res.success) {
        setActionAlert({ type: 'success', message: res.message });
        // Reset form
        setReceiverInput('');
        setLookupUser(null);
        setCustomReportTitle('');
        setCustomReportNote('');
        setActiveTab('manage'); // Switch to Manage view to see the sent report
      } else {
        setActionAlert({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setIsSending(false);
      setActionAlert({ type: 'error', message: `เกิดข้อผิดพลาด: ${err?.message || 'โปรดลองใหม่อีกครั้ง'}` });
    }
  };

  // ==========================================
  // 3. 📥 รับรายงาน (RECEIVED INBOX)
  // ==========================================
  const [receiveStatusTab, setReceiveStatusTab] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('pending');
  const [rejectModalReport, setRejectModalReport] = useState<SharedReport | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processingImportId, setProcessingImportId] = useState<string | null>(null);

  const filteredReceivedList = useMemo(() => {
    return sharedReportsReceived.filter(r => {
      if (receiveStatusTab === 'pending') return r.status === 'pending' || r.status === 'unread' || r.status === 'read';
      if (receiveStatusTab === 'accepted') return r.status === 'accepted';
      if (receiveStatusTab === 'rejected') return r.status === 'rejected';
      return true;
    }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [sharedReportsReceived, receiveStatusTab]);

  const handleAcceptReport = async (report: SharedReport) => {
    if (processingImportId) return;
    setProcessingImportId(report.id);
    try {
      const res = await acceptSharedReport(report);
      setProcessingImportId(null);
      if (res.success) {
        setActionAlert({ 
          type: 'success', 
          message: `นำเข้าข้อมูลสำเร็จ! เพิ่มประชาชน ${res.importedCitizens} คน, บันทึกสุขภาพ ${res.importedRecords} รายการ` 
        });
      } else {
        setActionAlert({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setProcessingImportId(null);
      setActionAlert({ type: 'error', message: 'เกิดข้อผิดพลาดในการตอบรับรายงาน' });
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalReport) return;
    try {
      const res = await rejectSharedReport(rejectModalReport.id, rejectReason);
      setRejectModalReport(null);
      setRejectReason('');
      if (res.success) {
        setActionAlert({ type: 'success', message: 'ปฏิเสธรายงานเรียบร้อยแล้ว' });
      } else {
        setActionAlert({ type: 'error', message: res.message });
      }
    } catch (err) {
      setRejectModalReport(null);
      setActionAlert({ type: 'error', message: 'เกิดข้อผิดพลาดในการปฏิเสธรายงาน' });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">

      {/* Global Alert Notification */}
      {actionAlert && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm animate-in fade-in ${
          actionAlert.type === 'success'
            ? 'bg-[#E2ECE0] border-[#5D7052]/30 text-[#2C2C24]'
            : 'bg-[#FCE8E6] border-[#DC2626]/30 text-[#2C2C24]'
        }`}>
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
            {actionAlert.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-[#5D7052] shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-[#DC2626] shrink-0" />
            )}
            <span>{actionAlert.message}</span>
          </div>
          <button onClick={() => setActionAlert(null)} className="text-[#78786C] hover:text-[#2C2C24]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Primary Subtabs Switcher */}
      <div className="bg-[#FDFCF8] border border-[#DED8CF] rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#5D7052]/10 text-[#5D7052] flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-[#2C2C24]">
              จัดการรายงานสุขภาพ
            </h1>
            <p className="text-xs sm:text-sm text-[#78786C]">
              ศูนย์กลางการตรวจสอบ ส่งต่อ และตอบรับรายงานสุขภาพในชุมชน
            </p>
          </div>
        </div>

        {/* 3 Main Tabs */}
        <div className="inline-flex p-1 bg-[#F0EBE5] rounded-xl border border-[#DED8CF] self-start md:self-auto">
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'manage'
                ? 'bg-[#5D7052] text-white shadow-sm'
                : 'text-[#5C5C50] hover:text-[#2C2C24]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>🗂️ จัดการรายงาน</span>
          </button>

          <button
            onClick={() => setActiveTab('send')}
            className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'send'
                ? 'bg-[#5D7052] text-white shadow-sm'
                : 'text-[#5C5C50] hover:text-[#2C2C24]'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>📤 ส่งรายงาน</span>
          </button>

          <button
            onClick={() => setActiveTab('receive')}
            className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 relative ${
              activeTab === 'receive'
                ? 'bg-[#5D7052] text-white shadow-sm'
                : 'text-[#5C5C50] hover:text-[#2C2C24]'
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>📥 รับรายงาน</span>
            {unreadReceivedCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold bg-[#DC2626] text-white rounded-full leading-tight">
                {unreadReceivedCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ==========================================
          TAB 1: 🗂️ จัดการรายงาน (REPORT MANAGEMENT)
          ========================================== */}
      {activeTab === 'manage' && (
        <div className="space-y-6">

          {/* Filters Bar */}
          <div className="bg-[#FDFCF8] border border-[#DED8CF] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-[#78786C] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={manageSearchQuery}
                  onChange={e => setManageSearchQuery(e.target.value)}
                  placeholder="🔍 ค้นหาชื่อรายงาน, ผู้รับ, ผู้ส่ง, หรือข้อความ..."
                  className="w-full pl-9 pr-4 py-2 bg-white border border-[#DED8CF] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#5D7052]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={manageDirectionFilter}
                  onChange={e => setManageDirectionFilter(e.target.value as any)}
                  className="px-3 py-2 bg-white border border-[#DED8CF] rounded-xl text-xs font-semibold text-[#2C2C24] focus:outline-none"
                >
                  <option value="all">ทิศทาง: ทั้งหมด</option>
                  <option value="sent">เฉพาะรายงานที่ส่ง</option>
                  <option value="received">เฉพาะรายงานที่ได้รับ</option>
                </select>

                <select
                  value={manageStatusFilter}
                  onChange={e => setManageStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-[#DED8CF] rounded-xl text-xs font-semibold text-[#2C2C24] focus:outline-none"
                >
                  <option value="all">สถานะ: ทั้งหมด</option>
                  <option value="pending">รอดำเนินการ</option>
                  <option value="accepted">ตอบรับแล้ว</option>
                  <option value="rejected">ปฏิเสธ</option>
                  <option value="cancelled">ยกเลิก</option>
                </select>

                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="p-2 bg-white border border-[#DED8CF] rounded-xl text-[#5C5C50] hover:text-[#2C2C24] hover:bg-[#F0EBE5]"
                  title="รีเฟรชข้อมูล"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Date Range Selector */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#E6E0D8]">
              <span className="text-xs font-semibold text-[#78786C]">ช่วงเวลา:</span>
              {(['all', 'today', '7days', '30days', 'custom'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setManageDatePreset(p)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                    manageDatePreset === p
                      ? 'bg-[#5D7052] text-white border-[#5D7052]'
                      : 'bg-white text-[#5C5C50] border-[#DED8CF] hover:bg-[#F4EFEA]'
                  }`}
                >
                  {p === 'all' ? 'ทั้งหมด' : p === 'today' ? 'วันนี้' : p === '7days' ? '7 วัน' : p === '30days' ? '30 วัน' : 'กำหนดเอง'}
                </button>
              ))}

              {manageDatePreset === 'custom' && (
                <div className="flex items-center gap-2 mt-1 sm:mt-0 sm:ml-2">
                  <input
                    type="date"
                    value={manageStartDate}
                    onChange={e => setManageStartDate(e.target.value)}
                    className="px-2 py-1 bg-white border border-[#DED8CF] rounded-md text-xs"
                  />
                  <span className="text-xs text-[#78786C]">ถึง</span>
                  <input
                    type="date"
                    value={manageEndDate}
                    onChange={e => setManageEndDate(e.target.value)}
                    className="px-2 py-1 bg-white border border-[#DED8CF] rounded-md text-xs"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Reports Table */}
          <div className="bg-[#FDFCF8] border border-[#DED8CF] rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F0EBE5] text-[#4A4A40] border-b border-[#DED8CF] uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">วันที่</th>
                    <th className="py-3 px-4">ชื่อรายงาน</th>
                    <th className="py-3 px-4">ผู้รับ / ผู้ส่ง</th>
                    <th className="py-3 px-4 text-center">ประชาชน</th>
                    <th className="py-3 px-4 text-center">Records</th>
                    <th className="py-3 px-4">สถานะ</th>
                    <th className="py-3 px-4 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E0D8]">
                  {filteredManagedReports.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-[#78786C]">
                        ไม่พบรายงานตามเงื่อนไขที่เลือก
                      </td>
                    </tr>
                  ) : (
                    filteredManagedReports.map((report) => {
                      const isSent = report.direction === 'sent';
                      const partyName = isSent 
                        ? (report.receiverName || report.receiverPhone || 'ผู้รับ') 
                        : (report.senderName || report.senderPhone || 'ผู้ส่ง');

                      return (
                        <tr key={report.id} className="hover:bg-[#FAF8F5] transition-colors">
                          <td className="py-3.5 px-4 font-medium text-[#2C2C24] whitespace-nowrap">
                            {formatThaiDate(report.createdAt, true)}
                          </td>

                          <td className="py-3.5 px-4 max-w-[200px]">
                            <div className="font-bold text-[#2C2C24] truncate">
                              {report.title}
                            </div>
                            <div className="text-[10px] text-[#78786C] truncate">
                              {report.periodLabel || 'ไม่มีระบุช่วง'}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                                isSent ? 'bg-[#5D7052]/10 text-[#5D7052]' : 'bg-[#0284C7]/10 text-[#0284C7]'
                              }`}>
                                {isSent ? 'ส่งถึง' : 'รับจาก'}
                              </span>
                              <span className="font-semibold text-[#2C2C24]">{partyName}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-center font-semibold text-[#2C2C24]">
                            {report.citizensCount || report.citizensData?.length || 1} คน
                          </td>

                          <td className="py-3.5 px-4 text-center font-semibold text-[#2C2C24]">
                            {report.recordsCount || report.recordsData?.length || 0} รายการ
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {report.status === 'accepted' ? (
                              <span className="px-2.5 py-1 text-[10px] font-semibold bg-[#DCFCE7] text-[#166534] rounded-full inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>ตอบรับแล้ว</span>
                              </span>
                            ) : report.status === 'rejected' ? (
                              <span className="px-2.5 py-1 text-[10px] font-semibold bg-[#FEE2E2] text-[#991B1B] rounded-full inline-flex items-center gap-1">
                                <XCircle className="w-3 h-3" />
                                <span>ปฏิเสธ</span>
                              </span>
                            ) : report.status === 'cancelled' ? (
                              <span className="px-2.5 py-1 text-[10px] font-semibold bg-[#F1F5F9] text-[#475569] rounded-full inline-flex items-center gap-1">
                                <Ban className="w-3 h-3" />
                                <span>ยกเลิก</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 text-[10px] font-semibold bg-[#FEF3C7] text-[#92400E] rounded-full inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>รอดำเนินการ</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1">
                            <button
                              onClick={() => {
                                setDetailModalReport(report);
                                setDetailModalTab('citizens');
                              }}
                              className="px-2.5 py-1 bg-white border border-[#DED8CF] hover:bg-[#F0EBE5] text-[#2C2C24] rounded-lg text-xs font-medium inline-flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              <span>ดู Snapshot</span>
                            </button>

                            <button
                              onClick={() => downloadSharedReport(report)}
                              className="p-1 text-[#78786C] hover:text-[#2C2C24] hover:bg-[#F0EBE5] rounded-lg inline-flex"
                              title="ดาวน์โหลด Excel"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>

                            {isSent && report.status === 'pending' && (
                              <button
                                onClick={() => handleCancelReport(report.id)}
                                className="p-1 text-[#DC2626] hover:bg-[#FEE2E2] rounded-lg inline-flex"
                                title="ยกเลิกรายงาน"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={async () => {
                                if (confirm('คุณต้องการลบรายการนี้ใช่หรือไม่?')) {
                                  await deleteSharedReport(report.id);
                                }
                              }}
                              className="p-1 text-[#78786C] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded-lg inline-flex"
                              title="ลบรายงาน"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 2: 📤 ส่งรายงาน (CREATE & SEND REPORT)
          ========================================== */}
      {activeTab === 'send' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left / Top Form: 7 Cols */}
          <div className="lg:col-span-7 space-y-5 bg-[#FDFCF8] border border-[#DED8CF] rounded-2xl p-5 sm:p-6 shadow-sm">
            <h2 className="text-base sm:text-lg font-bold font-heading text-[#2C2C24] flex items-center gap-2">
              <Send className="w-5 h-5 text-[#5D7052]" />
              <span>สร้างและส่งรายงานสุขภาพ</span>
            </h2>

            {/* 1. Date Range */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#2C2C24] block">
                1. เลือกช่วงวันที่ของข้อมูลสุขภาพ
              </label>

              <div className="flex flex-wrap gap-2">
                {(['today', '7days', '30days', 'all', 'custom'] as const).map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSendDatePreset(preset)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      sendDatePreset === preset
                        ? 'bg-[#5D7052] text-white border-[#5D7052]'
                        : 'bg-white text-[#5C5C50] border-[#DED8CF] hover:bg-[#F4EFEA]'
                    }`}
                  >
                    {preset === 'today' ? 'วันนี้' : preset === '7days' ? '7 วันที่ผ่านมา' : preset === '30days' ? '30 วันที่ผ่านมา' : preset === 'all' ? 'ข้อมูลทั้งหมด' : 'กำหนดเอง'}
                  </button>
                ))}
              </div>

              {sendDatePreset === 'custom' && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] text-[#78786C] block">เริ่มต้น</span>
                    <input
                      type="date"
                      value={sendStartDate}
                      onChange={e => setSendStartDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-[#DED8CF] rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#78786C] block">สิ้นสุด</span>
                    <input
                      type="date"
                      value={sendEndDate}
                      onChange={e => setSendEndDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-[#DED8CF] rounded-lg text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 2. Recipient Lookup */}
            <div className="space-y-2 pt-2 border-t border-[#E6E0D8]">
              <label className="text-xs font-bold text-[#2C2C24] block">
                2. ระบุผู้รับรายงาน (เบอร์โทรศัพท์ หรือ อีเมล)
              </label>

              <div className="relative">
                <input
                  type="text"
                  value={receiverInput}
                  onChange={e => setReceiverInput(e.target.value)}
                  placeholder="พิมพ์เบอร์โทรศัพท์ 10 หลัก หรือ อีเมลเจ้าหน้าที่..."
                  className="w-full px-4 py-2.5 bg-white border border-[#DED8CF] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#5D7052]"
                />
                {lookupLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#5D7052]" />
                  </div>
                )}
              </div>

              {/* Lookup Result Card */}
              {lookupUser && (
                <div className="p-3 bg-[#E2ECE0] border border-[#5D7052]/30 rounded-xl flex items-center justify-between animate-in fade-in">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#5D7052] text-white flex items-center justify-center font-bold text-xs">
                      {lookupUser.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#2C2C24]">{lookupUser.name}</span>
                        <span className="px-1.5 py-0.2 text-[9px] font-semibold bg-[#5D7052] text-white rounded">Verified</span>
                      </div>
                      <span className="text-[10px] text-[#78786C]">
                        {lookupUser.healthCenterName || lookupUser.villageName || 'อสม. ในระบบ'} • {lookupUser.phone}
                      </span>
                    </div>
                  </div>
                  <UserCheck className="w-5 h-5 text-[#5D7052]" />
                </div>
              )}

              {lookupError && (
                <p className="text-xs text-[#DC2626] font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{lookupError}</span>
                </p>
              )}
            </div>

            {/* 3. Data Scope & Details */}
            <div className="space-y-3 pt-2 border-t border-[#E6E0D8]">
              <label className="text-xs font-bold text-[#2C2C24] block">
                3. ขอบเขตและประเภทข้อมูล
              </label>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#2C2C24]">
                  <input
                    type="checkbox"
                    checked={includeCitizens}
                    onChange={e => setIncludeCitizens(e.target.checked)}
                    className="rounded border-[#DED8CF] text-[#5D7052] focus:ring-[#5D7052]"
                  />
                  <span>ข้อมูลประวัติประชาชน</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#2C2C24]">
                  <input
                    type="checkbox"
                    checked={includeRecords}
                    onChange={e => setIncludeRecords(e.target.checked)}
                    className="rounded border-[#DED8CF] text-[#5D7052] focus:ring-[#5D7052]"
                  />
                  <span>บันทึกตรวจสุขภาพและสัญญาณชีพ</span>
                </label>
              </div>

              {/* Specific Citizen filter (Optional) */}
              <div>
                <span className="text-[11px] text-[#78786C] block mb-1">เลือกเฉพาะประชาชนรายบุคคล (ถ้าต้องการ):</span>
                <select
                  value={selectedCitizenFilter}
                  onChange={e => setSelectedCitizenFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#DED8CF] rounded-xl text-xs text-[#2C2C24] focus:outline-none"
                >
                  <option value="all">ประชาชนทุกคนในช่วงเวลานี้ ({citizens.length} คน)</option>
                  {citizens.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.prefix || ''}{c.firstName} {c.lastName} (ม.{c.moo})
                    </option>
                  ))}
                </select>
              </div>

              {/* Title & Note */}
              <div className="space-y-2 pt-1">
                <div>
                  <span className="text-[11px] text-[#78786C] block mb-1">ชื่อรายงาน (ถ้าไม่ระบุ ระบบจะตั้งให้อัตโนมัติ):</span>
                  <input
                    type="text"
                    value={customReportTitle}
                    onChange={e => setCustomReportTitle(e.target.value)}
                    placeholder="เช่น รายงานคัดกรองความดัน ประจำเดือนสิงหาคม"
                    className="w-full px-3 py-2 bg-white border border-[#DED8CF] rounded-xl text-xs text-[#2C2C24] focus:outline-none"
                  />
                </div>

                <div>
                  <span className="text-[11px] text-[#78786C] block mb-1">หมายเหตุ / ข้อความถึงผู้รับ:</span>
                  <textarea
                    rows={2}
                    value={customReportNote}
                    onChange={e => setCustomReportNote(e.target.value)}
                    placeholder="ระบุข้อความหรือข้อสังเกตเพิ่มเติม..."
                    className="w-full px-3 py-2 bg-white border border-[#DED8CF] rounded-xl text-xs text-[#2C2C24] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right / Bottom Live Snapshot Preview: 5 Cols */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-[#FAF8F5] border border-[#DED8CF] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[#E6E0D8] pb-3">
                <h3 className="text-sm font-bold font-heading text-[#2C2C24] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#5D7052]" />
                  <span>ตัวอย่างรายงานก่อนส่ง (Live Preview)</span>
                </h3>
                <span className="text-[10px] bg-[#E2ECE0] text-[#5D7052] font-bold px-2 py-0.5 rounded-full">
                  Snapshot Safety
                </span>
              </div>

              {/* Snapshot Counts */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-xl border border-[#DED8CF]">
                  <span className="text-[10px] text-[#78786C] block">ประชาชน</span>
                  <span className="text-xl font-bold font-heading text-[#2C2C24]">
                    {sendScope.citizens.length} <span className="text-xs font-normal text-[#78786C]">คน</span>
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-[#DED8CF]">
                  <span className="text-[10px] text-[#78786C] block">บันทึกสุขภาพ</span>
                  <span className="text-xl font-bold font-heading text-[#2C2C24]">
                    {sendScope.records.length} <span className="text-xs font-normal text-[#78786C]">รายการ</span>
                  </span>
                </div>
              </div>

              {/* Details Summary */}
              <div className="text-xs space-y-2 bg-white p-3 rounded-xl border border-[#DED8CF]">
                <div className="flex justify-between">
                  <span className="text-[#78786C]">ช่วงวันที่:</span>
                  <span className="font-semibold text-[#2C2C24]">{sendScope.periodLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#78786C]">ผู้ส่ง:</span>
                  <span className="font-semibold text-[#2C2C24]">{vhvProfile.name} ({vhvProfile.villageName || 'อสม.'})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#78786C]">ผู้รับ:</span>
                  <span className="font-semibold text-[#2C2C24]">
                    {lookupUser?.name || receiverInput.trim() || 'ยังไม่ได้ระบุ'}
                  </span>
                </div>
              </div>

              {/* Sample Data Preview Table */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-[#78786C]">ตัวอย่างข้อมูลใน Snapshot:</span>
                <div className="max-h-40 overflow-y-auto border border-[#E6E0D8] rounded-xl bg-white divide-y divide-[#E6E0D8]">
                  {sendScope.records.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#78786C]">
                      ไม่มีบันทึกข้อมูลสุขภาพตามเงื่อนไขที่เลือก
                    </div>
                  ) : (
                    sendScope.records.slice(0, 4).map(rec => (
                      <div key={rec.id} className="p-2 text-xs flex justify-between items-center">
                        <div>
                          <span className="font-bold text-[#2C2C24] block">{rec.citizenName}</span>
                          <span className="text-[10px] text-[#78786C]">{formatThaiDate(rec.date)}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-[#5D7052] block">
                            {rec.systolic || '-'}/{rec.diastolic || '-'} mmHg
                          </span>
                          <span className="text-[10px] text-[#78786C]">{rec.weight ? `${rec.weight} kg` : ''}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setReceiverInput('');
                    setLookupUser(null);
                    setCustomReportTitle('');
                    setCustomReportNote('');
                  }}
                  className="flex-1 py-2.5 bg-white border border-[#DED8CF] hover:bg-[#F0EBE5] text-[#5C5C50] rounded-xl text-xs font-semibold transition-all"
                >
                  ล้างข้อมูล
                </button>

                <button
                  type="button"
                  onClick={handleExecuteSend}
                  disabled={isSending || (!lookupUser && !receiverInput.trim()) || (sendScope.citizens.length === 0 && sendScope.records.length === 0)}
                  className="flex-[2] py-2.5 bg-[#5D7052] hover:bg-[#48573F] disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-soft flex items-center justify-center gap-2"
                >
                  {isSending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>กำลังส่ง...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>ยืนยันส่งรายงาน</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ==========================================
          TAB 3: 📥 รับรายงาน (RECEIVED INBOX)
          ========================================== */}
      {activeTab === 'receive' && (
        <div className="space-y-6">

          {/* Sub-status filter pills */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FDFCF8] border border-[#DED8CF] rounded-2xl p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setReceiveStatusTab('pending')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  receiveStatusTab === 'pending'
                    ? 'bg-[#5D7052] text-white'
                    : 'bg-white text-[#5C5C50] border border-[#DED8CF] hover:bg-[#F4EFEA]'
                }`}
              >
                <span>รอดำเนินการ</span>
                {unreadReceivedCount > 0 && (
                  <span className="px-1.5 py-0.2 text-[9px] bg-[#DC2626] text-white rounded-full font-bold">
                    {unreadReceivedCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setReceiveStatusTab('accepted')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  receiveStatusTab === 'accepted'
                    ? 'bg-[#5D7052] text-white'
                    : 'bg-white text-[#5C5C50] border border-[#DED8CF] hover:bg-[#F4EFEA]'
                }`}
              >
                รับแล้ว
              </button>

              <button
                onClick={() => setReceiveStatusTab('rejected')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  receiveStatusTab === 'rejected'
                    ? 'bg-[#5D7052] text-white'
                    : 'bg-white text-[#5C5C50] border border-[#DED8CF] hover:bg-[#F4EFEA]'
                }`}
              >
                ปฏิเสธ
              </button>

              <button
                onClick={() => setReceiveStatusTab('all')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  receiveStatusTab === 'all'
                    ? 'bg-[#5D7052] text-white'
                    : 'bg-white text-[#5C5C50] border border-[#DED8CF] hover:bg-[#F4EFEA]'
                }`}
              >
                ทั้งหมด ({sharedReportsReceived.length})
              </button>
            </div>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 bg-white border border-[#DED8CF] rounded-xl text-[#5C5C50] hover:text-[#2C2C24]"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredReceivedList.length === 0 ? (
              <div className="col-span-full py-16 bg-[#FDFCF8] border border-[#DED8CF] rounded-2xl text-center text-[#78786C] text-xs">
                ไม่มีรายงานในกล่องข้อความ
              </div>
            ) : (
              filteredReceivedList.map(report => {
                const isPending = report.status === 'pending' || report.status === 'unread' || report.status === 'read';
                const isAccepted = report.status === 'accepted';
                const isRejected = report.status === 'rejected';

                return (
                  <div 
                    key={report.id}
                    className="bg-[#FDFCF8] border border-[#DED8CF] rounded-2xl p-5 shadow-sm space-y-4 hover:border-[#5D7052]/60 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Sender Info & Status Badge */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-[#5D7052] text-white flex items-center justify-center font-bold text-sm">
                            {report.senderName ? report.senderName.charAt(0) : 'อ'}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-[#2C2C24]">
                              {report.senderName || 'อสม. ชุมชน'}
                            </h3>
                            <span className="text-[10px] text-[#78786C] block">
                              {report.senderHealthCenter || report.senderVillage || 'รพ.สต.'} • {report.senderPhone || '-'}
                            </span>
                          </div>
                        </div>

                        {isAccepted ? (
                          <span className="px-2.5 py-1 text-[10px] font-semibold bg-[#DCFCE7] text-[#166534] rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>รับแล้ว</span>
                          </span>
                        ) : isRejected ? (
                          <span className="px-2.5 py-1 text-[10px] font-semibold bg-[#FEE2E2] text-[#991B1B] rounded-full flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            <span>ปฏิเสธ</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-[10px] font-semibold bg-[#FEF3C7] text-[#92400E] rounded-full flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>รอดำเนินการ</span>
                          </span>
                        )}
                      </div>

                      {/* Report Title & Period */}
                      <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#E6E0D8] space-y-1">
                        <span className="text-xs font-bold text-[#2C2C24] block">{report.title}</span>
                        <span className="text-[11px] text-[#78786C] block">
                          ช่วงข้อมูล: {report.periodLabel || 'ประวัติข้อมูล'}
                        </span>
                        {report.note && (
                          <p className="text-[11px] text-[#4A4A40] italic pt-1 border-t border-[#E6E0D8]">
                            "{report.note}"
                          </p>
                        )}
                      </div>

                      {/* Summary Metrics */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-white p-2 rounded-lg border border-[#DED8CF] text-center">
                          <span className="text-[10px] text-[#78786C] block">ประชาชน</span>
                          <span className="font-bold text-[#2C2C24]">
                            {report.citizensCount || report.citizensData?.length || 1} คน
                          </span>
                        </div>

                        <div className="bg-white p-2 rounded-lg border border-[#DED8CF] text-center">
                          <span className="text-[10px] text-[#78786C] block">บันทึกสุขภาพ</span>
                          <span className="font-bold text-[#2C2C24]">
                            {report.recordsCount || report.recordsData?.length || 0} รายการ
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-[#E6E0D8] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setDetailModalReport(report);
                            setDetailModalTab('citizens');
                          }}
                          className="px-3 py-1.5 bg-white border border-[#DED8CF] hover:bg-[#F0EBE5] text-[#2C2C24] rounded-lg text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>ดูรายงาน</span>
                        </button>

                        <button
                          onClick={() => downloadSharedReport(report)}
                          className="p-1.5 text-[#78786C] hover:text-[#2C2C24] hover:bg-[#F0EBE5] rounded-lg"
                          title="ดาวน์โหลด Excel"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>

                      {isPending && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setRejectModalReport(report)}
                            className="px-3 py-1.5 bg-[#FEE2E2] hover:bg-[#FECACA] text-[#991B1B] rounded-lg text-xs font-semibold inline-flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>ปฏิเสธ</span>
                          </button>

                          <button
                            onClick={() => handleAcceptReport(report)}
                            disabled={processingImportId === report.id}
                            className="px-3.5 py-1.5 bg-[#5D7052] hover:bg-[#48573F] text-white rounded-lg text-xs font-semibold shadow-soft inline-flex items-center gap-1"
                          >
                            {processingImportId === report.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            <span>รับข้อมูล</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          SNAPSHOT DETAILS MODAL (VIEW HISTORICAL SNAPSHOT)
          ========================================== */}
      {detailModalReport && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FDFCF8] border border-[#DED8CF] rounded-2xl max-w-2xl w-full shadow-xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-[#E6E0D8] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold font-heading text-[#2C2C24]">
                    {detailModalReport.title}
                  </h3>
                  <span className="text-[10px] bg-[#E2ECE0] text-[#5D7052] font-bold px-2 py-0.5 rounded-full">
                    Snapshot ณ {formatThaiDate(detailModalReport.createdAt, true)}
                  </span>
                </div>
                <p className="text-xs text-[#78786C]">
                  จาก {detailModalReport.senderName} ถึง {detailModalReport.receiverName || detailModalReport.receiverPhone}
                </p>
              </div>

              <button
                onClick={() => setDetailModalReport(null)}
                className="w-8 h-8 rounded-full border border-[#DED8CF] flex items-center justify-center text-[#78786C] hover:text-[#2C2C24]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Subtabs (Citizens vs Records) */}
            <div className="px-5 pt-3 border-b border-[#E6E0D8] flex items-center gap-3">
              <button
                onClick={() => setDetailModalTab('citizens')}
                className={`pb-2 text-xs font-semibold border-b-2 transition-all ${
                  detailModalTab === 'citizens'
                    ? 'border-[#5D7052] text-[#5D7052]'
                    : 'border-transparent text-[#78786C] hover:text-[#2C2C24]'
                }`}
              >
                รายชื่อประชาชน ({detailModalReport.citizensData?.length || (detailModalReport.citizenData ? 1 : 0)})
              </button>

              <button
                onClick={() => setDetailModalTab('records')}
                className={`pb-2 text-xs font-semibold border-b-2 transition-all ${
                  detailModalTab === 'records'
                    ? 'border-[#5D7052] text-[#5D7052]'
                    : 'border-transparent text-[#78786C] hover:text-[#2C2C24]'
                }`}
              >
                บันทึกสุขภาพ ({detailModalReport.recordsData?.length || detailModalReport.healthRecords?.length || 0})
              </button>
            </div>

            {/* Modal Content Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {detailModalTab === 'citizens' && (
                <div className="space-y-2">
                  {((detailModalReport.citizensData && detailModalReport.citizensData.length > 0)
                    ? detailModalReport.citizensData
                    : (detailModalReport.citizenData ? [detailModalReport.citizenData] : [])
                  ).map((cit, idx) => (
                    <div key={idx} className="p-3 bg-[#FAF8F5] border border-[#E6E0D8] rounded-xl text-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-[#2C2C24]">
                          {cit.prefix || ''}{cit.firstName} {cit.lastName}
                        </span>
                        <span className="text-[#78786C]">อายุ {cit.age} ปี ({cit.gender})</span>
                      </div>
                      <p className="text-[#78786C]">
                        บ้านเลขที่ {cit.houseNo} {cit.moo} {cit.villageName} • สิทธิ: {cit.healthRight || '-'}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {detailModalTab === 'records' && (
                <div className="space-y-2">
                  {(detailModalReport.recordsData || detailModalReport.healthRecords || []).map((rec, idx) => (
                    <div key={idx} className="p-3 bg-[#FAF8F5] border border-[#E6E0D8] rounded-xl text-xs flex justify-between items-center">
                      <div>
                        <span className="font-bold text-[#2C2C24] block">{rec.citizenName}</span>
                        <span className="text-[10px] text-[#78786C]">{formatThaiDate(rec.date)} {rec.time ? `• ${rec.time}` : ''}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-[#5D7052] block">
                          BP: {rec.systolic || '-'}/{rec.diastolic || '-'} mmHg
                        </span>
                        <span className="text-[10px] text-[#78786C]">
                          {rec.bloodSugar ? `น้ำตาล: ${rec.bloodSugar} ` : ''}
                          {rec.weight ? `น้ำหนัก: ${rec.weight} kg` : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#E6E0D8] bg-[#FAF8F5] rounded-b-2xl flex items-center justify-between">
              <button
                onClick={() => downloadSharedReport(detailModalReport)}
                className="px-3.5 py-1.5 bg-white border border-[#DED8CF] hover:bg-[#F0EBE5] text-[#2C2C24] rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ดาวน์โหลด Excel</span>
              </button>

              <button
                onClick={() => setDetailModalReport(null)}
                className="px-4 py-1.5 bg-[#5D7052] text-white rounded-lg text-xs font-semibold hover:bg-[#48573F]"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectModalReport && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FDFCF8] border border-[#DED8CF] rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold font-heading text-[#2C2C24] flex items-center gap-2">
              <XCircle className="w-5 h-5 text-[#DC2626]" />
              <span>ปฏิเสธการรับรายงาน</span>
            </h3>

            <p className="text-xs text-[#78786C]">
              คุณกำลังจะปฏิเสธรายงาน "{rejectModalReport.title}" จาก {rejectModalReport.senderName}
            </p>

            <div>
              <span className="text-xs font-medium text-[#2C2C24] block mb-1">เหตุผลในการปฏิเสธ (ถ้ามี):</span>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="เช่น ข้อมูลไม่ตรงกับพื้นที่รับผิดชอบ..."
                className="w-full px-3 py-2 bg-white border border-[#DED8CF] rounded-xl text-xs focus:outline-none focus:border-[#5D7052]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setRejectModalReport(null);
                  setRejectReason('');
                }}
                className="px-4 py-1.5 bg-white border border-[#DED8CF] text-[#5C5C50] rounded-lg text-xs font-semibold hover:bg-[#F0EBE5]"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-1.5 bg-[#DC2626] text-white rounded-lg text-xs font-semibold hover:bg-[#B91C1C]"
              >
                ยืนยันปฏิเสธ
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
