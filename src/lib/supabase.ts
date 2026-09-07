import { createClient } from '@supabase/supabase-js';
import { Citizen, HealthRecord, VhvProfile, SharedReport } from '../types';

const getEnvVar = (key: string, defaultVal: string): string => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch (e) {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key] as string;
    }
  } catch (e) {}
  return defaultVal;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL', 'https://ctllgomqzeweeyrvxboc.supabase.co');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY', 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr');

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://your-project.supabase.co' &&
  !supabaseUrl.includes('placeholder')
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});

// Helper to convert phone number into safe internal email for Supabase Auth
export const phoneToAuthEmail = (phone: string): string => {
  const cleanPhone = phone.replace(/\D/g, '');
  return `${cleanPhone}@vhv-health.local`;
};

// Check if an error is an authentication / JWT expiration error
export const isAuthError = (err: any): boolean => {
  if (!err) return false;
  const message = String(err.message || err.details || err.hint || err || '').toLowerCase();
  const code = String(err.code || err.status || '').toUpperCase();
  const status = Number(err.status || err.statusCode || 0);

  return (
    status === 401 ||
    code === 'PGRST301' || // JWT expired
    code === 'PGRST302' || // JWT invalid
    code === 'PGRST303' || // JWT expired
    message.includes('jwt expired') ||
    message.includes('token is expired') ||
    message.includes('jwt') ||
    message.includes('token') ||
    message.includes('unauthorized') ||
    message.includes('not logged in') ||
    message.includes('session expired') ||
    message.includes('auth.uid()')
  );
};

// Proactively ensure and refresh the Supabase session if JWT is expired or near expiry
let activeRefreshPromise: Promise<boolean> | null = null;

export const ensureValidSession = async (force: boolean = false): Promise<boolean> => {
  if (!isSupabaseConfigured) return false;

  if (activeRefreshPromise && !force) {
    return await activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    try {
      if (force) {
        console.log('[Supabase Auth] Force refresh requested, refreshing session...');
        const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
        if (refreshErr || !refreshed?.session) {
          console.warn('[Supabase Auth] Force refresh failed:', refreshErr?.message);
          return false;
        }
        console.log('[Supabase Auth] Force refresh succeeded');
        return true;
      }

      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();

      if (sessionErr || !sessionData?.session) {
        // Attempt explicit refresh via stored refresh token
        const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
        if (refreshErr || !refreshed?.session) {
          return false;
        }
        console.log('[Supabase Auth] Session recovered & refreshed successfully');
        return true;
      }

      const session = sessionData.session;
      const expiresAt = session.expires_at; // timestamp in seconds
      const nowSec = Math.floor(Date.now() / 1000);

      // If token is expired or expires in less than 120 seconds, refresh proactively
      if (!expiresAt || (expiresAt - nowSec) < 120) {
        console.log('[Supabase Auth] Token near expiry or expired, refreshing...');
        const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
        if (refreshErr || !refreshed?.session) {
          console.warn('[Supabase Auth] Proactive refresh warning:', refreshErr?.message);
          return false;
        }
        console.log('[Supabase Auth] Token refreshed proactively');
        return true;
      }

      return true;
    } catch (err) {
      console.warn('[Supabase Auth] Session verification exception:', err);
      return false;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return await activeRefreshPromise;
};

// Wrapper that executes any Supabase query with automatic 1-time retry on JWT/Auth expiry
export const executeWithAuthRetry = async <T = any>(
  queryFn: () => PromiseLike<{ data?: T | null; error?: any }> | Promise<{ data?: T | null; error?: any }>
): Promise<{ data?: T | null; error?: any }> => {
  let result = await queryFn();
  if (result.error && isAuthError(result.error)) {
    console.warn('[Supabase] Query failed with auth/JWT expiry. Refreshing session & retrying once...', result.error.code || result.error.message);
    const refreshed = await ensureValidSession(true);
    if (refreshed) {
      result = await queryFn();
      if (!result.error) {
        console.log('[Supabase] Query retry succeeded after session refresh');
      }
    }
  }
  return result;
};

// ==========================================================
// Strict Schema Mappers (Matching exact verified live DB columns)
// ==========================================================

export const testSupabaseConnection = async (): Promise<{ success: boolean; error?: string; latencyMs?: number }> => {
  const start = Date.now();
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    const latencyMs = Date.now() - start;

    if (error) {
      console.error('[Supabase] Connection test failed:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return { success: false, error: `[${error.code}] ${error.message}`, latencyMs };
    }

    console.log('[Supabase] Connection OK. Latency:', latencyMs, 'ms. Sample data:', data);
    return { success: true, latencyMs };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    console.error('[Supabase] Connection test exception:', err);
    return { success: false, error: err?.message || 'Network error', latencyMs };
  }
};

export const mapCitizenToSupabase = (c: Citizen, userId: string) => {
  let validBirthDate: string | null = null;
  
  if (c.birthDate && typeof c.birthDate === 'string' && c.birthDate.trim()) {
    const trimmed = c.birthDate.trim();
    // Validate ISO YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      validBirthDate = trimmed;
    }
  }

  // Only if birthDate is genuinely unavailable, derive an approximate fallback from age using current Gregorian year
  if (!validBirthDate && c.age && Number(c.age) > 0) {
    const currentGregorianYear = new Date().getFullYear();
    const approxGregorianBirthYear = currentGregorianYear - Number(c.age);
    validBirthDate = `${approxGregorianBirthYear}-01-01`;
  }

  // Encode patient status and medical equipment into note if present
  let notePayload: string | null = c.notes || null;
  const hasAssessmentMeta = Boolean(
    c.patientStatus || 
    (c.medicalEquipment && c.medicalEquipment.length > 0) || 
    c.medicalEquipmentOther ||
    c.recommendedTerm
  );

  if (hasAssessmentMeta) {
    notePayload = JSON.stringify({
      notes: c.notes || '',
      patientStatus: c.patientStatus || null,
      recommendedTerm: c.recommendedTerm || null,
      medicalEquipment: c.medicalEquipment || [],
      medicalEquipmentOther: c.medicalEquipmentOther || null
    });
  }

  return {
    id: c.id,
    user_id: userId,
    prefix: c.prefix || 'นาย',
    first_name: c.firstName || '',
    last_name: c.lastName || '',
    citizen_id: c.idCard || '',
    gender: c.gender || 'อื่นๆ',
    age: Number(c.age) || 0,
    birth_date: validBirthDate,
    phone: c.phone || '',
    house_no: c.houseNo || '',
    moo: c.moo || '',
    village_name: c.villageName || '',
    congenital_disease: Array.isArray(c.chronicDiseases) ? c.chronicDiseases.join(', ') : (c.chronicDiseases || null),
    allergies: c.allergies || null,
    avatar_color: c.avatarColor || '#5D7052',
    note: notePayload,
    created_at: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
};

export const mapSupabaseToCitizen = (row: any): Citizen => {
  let userNotes = row.note || undefined;
  let patientStatus: string | undefined = undefined;
  let recommendedTerm: string | undefined = undefined;
  let medicalEquipment: string[] | undefined = undefined;
  let medicalEquipmentOther: string | undefined = undefined;

  if (row.note && typeof row.note === 'string') {
    const trimmed = row.note.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          userNotes = parsed.notes || parsed.userNote || undefined;
          patientStatus = parsed.patientStatus || undefined;
          recommendedTerm = parsed.recommendedTerm || undefined;
          medicalEquipment = Array.isArray(parsed.medicalEquipment) ? parsed.medicalEquipment : undefined;
          medicalEquipmentOther = parsed.medicalEquipmentOther || undefined;
        }
      } catch {
        // Fall back to plain text note
      }
    }
  }

  return {
    id: row.id,
    userId: row.user_id,
    prefix: row.prefix || 'นาย',
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    idCard: row.citizen_id || '',
    gender: row.gender || 'อื่นๆ',
    age: Number(row.age) || 0,
    birthDate: row.birth_date || undefined,
    phone: row.phone || '',
    houseNo: row.house_no || '',
    moo: row.moo || '',
    villageName: row.village_name || '',
    healthRight: 'บัตรทอง (UC/สปสช.)',
    chronicDiseases: row.congenital_disease ? row.congenital_disease.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
    allergies: row.allergies || undefined,
    emergencyContact: undefined,
    emergencyPhone: undefined,
    avatarColor: row.avatar_color || '#5D7052',
    notes: userNotes,
    patientStatus,
    recommendedTerm,
    medicalEquipment,
    medicalEquipmentOther,
    createdAt: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  };
};

export const mapHealthRecordToSupabase = (r: HealthRecord, userId: string) => {
  const assessmentSummary = (r.systolic && r.diastolic) 
    ? (`ความดัน: ${r.systolic}/${r.diastolic} mmHg` + (r.bloodSugar ? `, น้ำตาล: ${r.bloodSugar} mg/dL` : ''))
    : (r.bloodSugar ? `น้ำตาล: ${r.bloodSugar} mg/dL` : null);

  return {
    id: r.id,
    citizen_id: r.citizenId,
    user_id: userId,
    date: r.date || new Date().toISOString().split('T')[0],
    sys: r.systolic !== undefined && r.systolic !== null && !isNaN(Number(r.systolic)) && Number(r.systolic) > 0 ? Number(r.systolic) : null,
    dia: r.diastolic !== undefined && r.diastolic !== null && !isNaN(Number(r.diastolic)) && Number(r.diastolic) > 0 ? Number(r.diastolic) : null,
    pulse: r.pulse !== undefined && r.pulse !== null && !isNaN(Number(r.pulse)) ? Number(r.pulse) : null,
    weight: r.weight !== undefined && r.weight !== null && !isNaN(Number(r.weight)) ? Number(r.weight) : null,
    height: r.height !== undefined && r.height !== null && !isNaN(Number(r.height)) ? Number(r.height) : null,
    bmi: r.bmi !== undefined && r.bmi !== null && !isNaN(Number(r.bmi)) ? Number(r.bmi) : null,
    waist: r.waist !== undefined && r.waist !== null && !isNaN(Number(r.waist)) ? Number(r.waist) : null,
    fbs: r.bloodSugar !== undefined && r.bloodSugar !== null && !isNaN(Number(r.bloodSugar)) ? Number(r.bloodSugar) : null,
    is_fasting: typeof r.bloodSugarFasting === 'boolean' ? r.bloodSugarFasting : null,
    temperature: r.temperature !== undefined && r.temperature !== null && !isNaN(Number(r.temperature)) ? Number(r.temperature) : null,
    assessment: assessmentSummary,
    notes: r.notes || null,
    examiner_name: r.examinerName || 'อสม.',
    created_at: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
};

export const mapSupabaseToHealthRecord = (row: any, citizens?: Citizen[]): HealthRecord => {
  const cit = citizens?.find(c => c.id === row.citizen_id);
  const fullName = cit ? `${cit.prefix || ''}${cit.firstName} ${cit.lastName}`.trim() : (row.citizen_name || 'ผู้รับบริการ');
  return {
    id: row.id,
    citizenId: row.citizen_id,
    userId: row.user_id,
    citizenName: fullName,
    citizenAge: cit?.age ?? Number(row.citizen_age) ?? 0,
    gender: cit?.gender || row.gender || '',
    houseNo: cit?.houseNo || row.house_no || '',
    moo: cit?.moo || row.moo || '',
    date: row.date || '',
    time: row.time || undefined,
    systolic: Number(row.sys) || Number(row.systolic) || 0,
    diastolic: Number(row.dia) || Number(row.diastolic) || 0,
    pulse: row.pulse !== null && row.pulse !== undefined && !isNaN(Number(row.pulse)) ? Number(row.pulse) : undefined,
    weight: row.weight !== null && row.weight !== undefined && !isNaN(Number(row.weight)) ? Number(row.weight) : undefined,
    height: row.height !== null && row.height !== undefined && !isNaN(Number(row.height)) ? Number(row.height) : undefined,
    bmi: row.bmi !== null && row.bmi !== undefined && !isNaN(Number(row.bmi)) ? Number(row.bmi) : undefined,
    waist: row.waist !== null && row.waist !== undefined && !isNaN(Number(row.waist)) ? Number(row.waist) : undefined,
    waistUnit: 'cm',
    bloodSugar: row.fbs !== null && row.fbs !== undefined && !isNaN(Number(row.fbs)) ? Number(row.fbs) : (row.blood_sugar !== null && row.blood_sugar !== undefined && !isNaN(Number(row.blood_sugar)) ? Number(row.blood_sugar) : undefined),
    bloodSugarFasting: typeof row.is_fasting === 'boolean' ? row.is_fasting : (typeof row.blood_sugar_fasting === 'boolean' ? row.blood_sugar_fasting : undefined),
    temperature: row.temperature !== null && row.temperature !== undefined && !isNaN(Number(row.temperature)) ? Number(row.temperature) : undefined,
    notes: row.notes || undefined,
    examinerName: row.examiner_name || '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
};

export const mapProfileToSupabase = (p: VhvProfile, userId: string) => ({
  id: userId,
  name: p.name.trim(),
  phone: p.phone.replace(/\D/g, ''),
  birth_date: p.birthDate.trim(),
  vhv_id: p.vhvId?.trim() || null,
  village_name: p.villageName?.trim() || null,
  moo: p.moo?.trim() || null,
  subdistrict: p.subdistrict?.trim() || null,
  district: p.district?.trim() || null,
  province: p.province?.trim() || null,
  health_center_name: p.healthCenterName?.trim() || null,
  hospital_report_email: p.hospitalReportEmail?.trim() || null,
  email: p.email?.trim() || null,
  font_size: p.fontSize || 'md',
  updated_at: new Date().toISOString()
});

export const mapSupabaseToProfile = (row: any): VhvProfile => ({
  name: row.name || '',
  phone: row.phone || '',
  birthDate: row.birth_date || '',
  vhvId: row.vhv_id || undefined,
  villageName: row.village_name || undefined,
  moo: row.moo || undefined,
  subdistrict: row.subdistrict || undefined,
  district: row.district || undefined,
  province: row.province || undefined,
  healthCenterName: row.health_center_name || undefined,
  hospitalReportEmail: row.hospital_report_email || undefined,
  email: row.email || undefined,
  fontSize: row.font_size === 'sm' || row.font_size === 'lg' ? row.font_size : 'md'
});

export const mapSharedReportToSupabase = (
  report: SharedReport, 
  senderId: string, 
  receiverId: string
) => {
  const citData = report.citizenData 
    ? report.citizenData 
    : (report.citizensData && report.citizensData.length > 0 ? report.citizensData[0] : null);
  
  const recData = report.healthRecords 
    ? report.healthRecords 
    : (report.recordsData || []);

  return {
    id: report.id,
    sender_id: senderId,
    receiver_id: receiverId,
    sender_name: report.senderName || 'อสม.',
    sender_phone: report.senderPhone || '',
    receiver_phone: report.receiverPhone || '',
    title: report.title || 'รายงานตรวจสุขภาพ',
    message: report.message || report.note || null,
    citizen_data: citData || {},
    health_records: recData,
    status: report.status === 'accepted' ? 'accepted' : report.status === 'rejected' ? 'rejected' : 'pending',
    accepted_at: report.acceptedAt || null,
    rejected_at: report.rejectedAt || null,
    created_at: report.createdAt || new Date().toISOString(),
    updated_at: report.updatedAt || new Date().toISOString()
  };
};

export const mapSupabaseToSharedReport = (row: any): SharedReport => {
  const citRaw = row.citizen_data || row.citizens_data;
  const citizensData: Citizen[] = citRaw 
    ? (Array.isArray(citRaw) ? citRaw : [citRaw]) 
    : [];
  const singleCitizen: Citizen | undefined = citizensData[0];
  const recordsData: HealthRecord[] = Array.isArray(row.health_records) 
    ? row.health_records 
    : (Array.isArray(row.records_data) ? row.records_data : []);

  const normalizedStatus = (
    row.status === 'accepted' ? 'accepted' :
    row.status === 'rejected' ? 'rejected' :
    row.status === 'cancelled' ? 'cancelled' :
    row.status === 'imported' ? 'accepted' :
    'pending'
  );

  return {
    id: row.id,
    senderId: row.sender_id,
    senderName: row.sender_name || 'อสม.',
    senderPhone: row.sender_phone || '',
    senderVillage: row.sender_village || undefined,
    senderHealthCenter: row.sender_health_center || undefined,
    receiverId: row.receiver_id,
    receiverPhone: row.receiver_phone || '',
    title: row.title || 'รายงานผลตรวจสุขภาพ',
    periodLabel: row.period_label || 'ส่งต่อข้อมูล',
    recordsCount: recordsData.length,
    citizensCount: citizensData.length,
    fileName: row.file_name || `รายงาน_${row.sender_name || 'อสม'}.xlsx`,
    excelBase64: row.excel_base64 || undefined,
    recordsData: recordsData,
    citizensData: citizensData,
    citizenData: singleCitizen,
    healthRecords: recordsData,
    note: row.message || row.note || undefined,
    message: row.message || row.note || undefined,
    status: normalizedStatus,
    acceptedAt: row.accepted_at || undefined,
    rejectedAt: row.rejected_at || undefined,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined
  };
};

// ==========================================================
// Deterministic ID Reconciliation Helpers (Step 4 - Phase 2)
// Ensures 100% ID alignment between offline acceptance and server RPC
// ==========================================================

export const getDeterministicImportedCitizenId = (reportId: string, sourceCitizenId: string): string => {
  const shortPrefix = reportId.replace(/-/g, '').substring(0, 12);
  const cleanSource = (sourceCitizenId || 'cit_1').trim();
  return `cit-imp-${shortPrefix}-${cleanSource}`;
};

export const getDeterministicImportedRecordId = (reportId: string, sourceRecordId: string): string => {
  const shortPrefix = reportId.replace(/-/g, '').substring(0, 12);
  const cleanSource = (sourceRecordId || 'rec_1').trim();
  return `rec-imp-${shortPrefix}-${cleanSource}`;
};

// ==========================================================
// Receiver Lookup & Shared Reports API
// ==========================================================

export interface ReceiverProfileSummary {
  userId: string;
  name: string;
  phone: string;
  villageName?: string;
  healthCenterName?: string;
}

export const lookupReceiverProfile = async (
  query: string
): Promise<{ success: boolean; data?: ReceiverProfileSummary; error?: string }> => {
  if (!query || !query.trim()) {
    return { success: false, error: 'กรุณากรอกเบอร์โทรหรืออีเมลของผู้รับ' };
  }

  const cleanQuery = query.trim();
  const isEmail = cleanQuery.includes('@');
  const normalizedPhone = cleanQuery.replace(/[^0-9]/g, '');

  try {
    await ensureValidSession();

    if (isEmail) {
      // 1. Email Lookup via RPC
      let { data, error } = await supabase.rpc('lookup_receiver_by_email', {
        p_email: cleanQuery.toLowerCase()
      });

      if (error && isAuthError(error)) {
        const refreshed = await ensureValidSession();
        if (refreshed) {
          const retry = await supabase.rpc('lookup_receiver_by_email', {
            p_email: cleanQuery.toLowerCase()
          });
          data = retry.data;
          error = retry.error;
        }
      }

      if (error && (error.code === 'PGRST202' || error.message?.includes('p_email'))) {
        const retry = await supabase.rpc('lookup_receiver_by_email', {
          target_email: cleanQuery.toLowerCase()
        });
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error('[Supabase lookup_receiver_by_email error]', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        return { success: false, error: `เกิดข้อผิดพลาดในการค้นหา: ${error.message}` };
      }

      const rows = Array.isArray(data) ? data : (data ? [data] : []);
      if (rows.length === 0) {
        return { success: false, error: 'ไม่พบบัญชีผู้รับในระบบ กรุณาตรวจสอบอีเมลอีกครั้ง' };
      }

      const item = rows[0];
      const recId = item.id || item.user_id;
      if (!recId) {
        return { success: false, error: 'ไม่พบบัญชีผู้รับในระบบ' };
      }

      return {
        success: true,
        data: {
          userId: recId,
          name: item.name || 'อสม. ผู้รับ',
          phone: item.phone || '',
          villageName: item.village_name || undefined,
          healthCenterName: item.health_center_name || undefined
        }
      };
    } else {
      // 2. Phone Lookup via RPC (Primary)
      if (normalizedPhone.length < 9) {
        return { success: false, error: 'กรุณาระบุเบอร์โทรศัพท์ให้ครบ 9-10 หลัก' };
      }

      let { data, error } = await supabase.rpc('lookup_receiver_by_phone', {
        p_phone: normalizedPhone
      });

      if (error && isAuthError(error)) {
        const refreshed = await ensureValidSession();
        if (refreshed) {
          const retry = await supabase.rpc('lookup_receiver_by_phone', {
            p_phone: normalizedPhone
          });
          data = retry.data;
          error = retry.error;
        }
      }

      if (error && (error.code === 'PGRST202' || error.message?.includes('p_phone'))) {
        const retry = await supabase.rpc('lookup_receiver_by_phone', {
          target_phone: normalizedPhone
        });
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error('[Supabase lookup_receiver_by_phone error]', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        return { success: false, error: `เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล: ${error.message}` };
      }

      const rows = Array.isArray(data) ? data : (data ? [data] : []);
      if (rows.length === 0) {
        return { success: false, error: 'ไม่พบบัญชีผู้รับในระบบ กรุณาตรวจสอบเบอร์โทรศัพท์' };
      }

      const item = rows[0];
      // Database RPC returns column 'id', read item.id
      const recId = item.id || item.user_id;
      if (!recId) {
        return { success: false, error: 'ไม่พบบัญชีผู้รับในระบบ' };
      }

      return {
        success: true,
        data: {
          userId: recId,
          name: item.name || 'อสม. ผู้รับ',
          phone: item.phone || normalizedPhone,
          villageName: item.village_name || undefined,
          healthCenterName: item.health_center_name || undefined
        }
      };
    }
  } catch (err: any) {
    console.error('[Supabase] Lookup receiver exception:', err);
    return { success: false, error: err?.message || 'เกิดข้อผิดพลาดในการค้นหาผู้รับ' };
  }
};

// SQL Schema for user's Supabase SQL Editor
export const SUPABASE_SQL_SCHEMA = `-- ==========================================================
-- 1. สร้างตารางข้อมูลโปรไฟล์ อสม. (public.profiles)
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  birth_date TEXT NOT NULL,
  vhv_id TEXT,
  village_name TEXT,
  moo TEXT,
  subdistrict TEXT,
  district TEXT,
  province TEXT,
  health_center_name TEXT,
  hospital_report_email TEXT,
  email TEXT,
  font_size TEXT DEFAULT 'md',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================
-- 2. สร้างตารางทะเบียนประชาชน (public.citizens)
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.citizens (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  citizen_id TEXT,
  gender TEXT NOT NULL,
  age INTEGER,
  birth_date DATE,
  phone TEXT,
  house_no TEXT,
  moo TEXT,
  village_name TEXT,
  congenital_disease TEXT,
  allergies TEXT,
  avatar_color TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================
-- 3. สร้างตารางผลการตรวจสุขภาพ (public.health_records)
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.health_records (
  id TEXT PRIMARY KEY,
  citizen_id TEXT NOT NULL REFERENCES public.citizens(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  sys NUMERIC,
  dia NUMERIC,
  pulse NUMERIC,
  weight NUMERIC,
  height NUMERIC,
  bmi NUMERIC,
  waist NUMERIC,
  fbs NUMERIC,
  is_fasting BOOLEAN,
  temperature NUMERIC,
  assessment TEXT,
  notes TEXT,
  examiner_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================
-- 4. สร้างตารางการแชร์รายงานผลตรวจ (public.shared_reports)
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.shared_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_phone TEXT NOT NULL,
  sender_village TEXT,
  sender_health_center TEXT,
  receiver_phone TEXT NOT NULL,
  title TEXT NOT NULL,
  period_label TEXT NOT NULL,
  records_count INTEGER NOT NULL DEFAULT 0,
  citizens_count INTEGER NOT NULL DEFAULT 0,
  file_name TEXT NOT NULL,
  excel_base64 TEXT,
  citizen_data JSONB DEFAULT '[]'::jsonb,
  health_records JSONB DEFAULT '[]'::jsonb,
  note TEXT,
  status TEXT DEFAULT 'pending',
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================
-- 5. ตั้งค่าฟังก์ชัน Auto Trigger สร้าง Profile อัตโนมัติเมื่อสมัครสมาชิก
-- ==========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    name, 
    phone, 
    birth_date, 
    vhv_id, 
    village_name, 
    moo, 
    subdistrict, 
    district, 
    province, 
    health_center_name,
    created_at, 
    updated_at
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', 'อสม.'),
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    COALESCE(new.raw_user_meta_data->>'birth_date', ''),
    new.raw_user_meta_data->>'vhv_id',
    new.raw_user_meta_data->>'village_name',
    new.raw_user_meta_data->>'moo',
    new.raw_user_meta_data->>'subdistrict',
    new.raw_user_meta_data->>'district',
    new.raw_user_meta_data->>'province',
    new.raw_user_meta_data->>'health_center_name',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    birth_date = EXCLUDED.birth_date,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ผูก Trigger กับตาราง auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================================
-- 6. เปิดใช้งาน Row Level Security (RLS)
-- ==========================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citizens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_reports ENABLE ROW LEVEL SECURITY;

-- ลบ Policies เก่าถ้ามีอยู่
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

DROP POLICY IF EXISTS "Users can view own citizens" ON public.citizens;
DROP POLICY IF EXISTS "Users can insert own citizens" ON public.citizens;
DROP POLICY IF EXISTS "Users can update own citizens" ON public.citizens;
DROP POLICY IF EXISTS "Users can delete own citizens" ON public.citizens;

DROP POLICY IF EXISTS "Users can view own health records" ON public.health_records;
DROP POLICY IF EXISTS "Users can insert own health records" ON public.health_records;
DROP POLICY IF EXISTS "Users can delete own health records" ON public.health_records;

DROP POLICY IF EXISTS "Users can view shared reports" ON public.shared_reports;
DROP POLICY IF EXISTS "Users can insert shared reports" ON public.shared_reports;
DROP POLICY IF EXISTS "Users can update shared reports" ON public.shared_reports;
DROP POLICY IF EXISTS "Users can delete shared reports" ON public.shared_reports;

-- ==========================================================
-- 7. กำหนดสิทธิ์ RLS Policies (Clean UUID comparisons)
-- ==========================================================
-- Profiles
CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
  ON public.profiles FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own profile" 
  ON public.profiles FOR DELETE 
  TO authenticated
  USING (auth.uid() = id);

-- Citizens
CREATE POLICY "Users can view own citizens" 
  ON public.citizens FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own citizens" 
  ON public.citizens FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own citizens" 
  ON public.citizens FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own citizens" 
  ON public.citizens FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- Health Records
CREATE POLICY "Users can view own health records" 
  ON public.health_records FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health records" 
  ON public.health_records FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own health records" 
  ON public.health_records FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own health records" 
  ON public.health_records FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- Shared Reports (เข้าถึงได้ทั้งผู้ส่ง และผู้รับที่มีเบอร์ตรงกัน)
CREATE POLICY "Users can view shared reports" 
  ON public.shared_reports FOR SELECT 
  TO authenticated
  USING (
    auth.uid() = sender_id OR 
    receiver_phone IN (SELECT phone FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert shared reports" 
  ON public.shared_reports FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update shared reports" 
  ON public.shared_reports FOR UPDATE 
  TO authenticated
  USING (
    auth.uid() = sender_id OR 
    receiver_phone IN (SELECT phone FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = sender_id OR 
    receiver_phone IN (SELECT phone FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete shared reports" 
  ON public.shared_reports FOR DELETE 
  TO authenticated
  USING (auth.uid() = sender_id);
`;
