import { supabase, isSupabaseConfigured } from './supabase';
import { PatientAccessStatus, GeneratedPatientAccess } from '../types';

/**
 * Get active Supabase session access token
 */
async function getAuthToken(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch (e) {
    return null;
  }
}

/**
 * Check if the browser is currently online
 */
export function isNetworkOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Query current access permission status for a citizen
 */
export async function getPatientAccessStatus(citizenId: string): Promise<{
  success: boolean;
  hasAccess: boolean;
  access?: PatientAccessStatus;
  error?: string;
}> {
  if (!isNetworkOnline()) {
    return {
      success: false,
      hasAccess: false,
      error: 'ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อตรวจสอบสิทธิ์เข้าดูผลตรวจ'
    };
  }

  try {
    const token = await getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`/api/patient-access/status/${encodeURIComponent(citizenId)}`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return {
        success: false,
        hasAccess: false,
        error: errData.error || 'ไม่สามารถตรวจสอบสถานะสิทธิ์ได้'
      };
    }

    const data = await response.json();
    return {
      success: true,
      hasAccess: Boolean(data.hasAccess),
      access: data.access
    };
  } catch (err: any) {
    console.error('[getPatientAccessStatus] Exception:', err);
    return {
      success: false,
      hasAccess: false,
      error: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์'
    };
  }
}

/**
 * Generate new QR Code Token + PIN for a citizen
 */
export async function generatePatientAccess(
  citizenId: string, 
  expirationDays: number = 7
): Promise<{
  success: boolean;
  access?: GeneratedPatientAccess;
  error?: string;
}> {
  if (!isNetworkOnline()) {
    return {
      success: false,
      error: 'ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อสร้างสิทธิ์เข้าดูผลตรวจ'
    };
  }

  try {
    const token = await getAuthToken();
    if (!token) {
      return {
        success: false,
        error: 'กรุณาเข้าสู่ระบบ อสม. เพื่อสร้างสิทธิ์เข้าดูผลตรวจ'
      };
    }

    const response = await fetch('/api/patient-access/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        citizenId,
        expirationDays
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'ไม่สามารถสร้างสิทธิ์เข้าดูผลตรวจได้'
      };
    }

    return {
      success: true,
      access: data.access
    };
  } catch (err: any) {
    console.error('[generatePatientAccess] Exception:', err);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์'
    };
  }
}

/**
 * Revoke existing patient access permission
 */
export async function revokePatientAccess(params: {
  citizenId?: string;
  accessId?: string;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  if (!isNetworkOnline()) {
    return {
      success: false,
      error: 'ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อยกเลิกสิทธิ์เข้าดูผลตรวจ'
    };
  }

  try {
    const token = await getAuthToken();
    if (!token) {
      return {
        success: false,
        error: 'กรุณาเข้าสู่ระบบ อสม. เพื่อทำรายการ'
      };
    }

    const response = await fetch('/api/patient-access/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(params)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'ไม่สามารถยกเลิกสิทธิ์ได้'
      };
    }

    return {
      success: true,
      message: data.message || 'ยกเลิกสิทธิ์เข้าดูผลตรวจเรียบร้อยแล้ว'
    };
  } catch (err: any) {
    console.error('[revokePatientAccess] Exception:', err);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์'
    };
  }
}
