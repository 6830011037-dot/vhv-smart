import crypto from 'crypto';
import { Request, Response } from 'express';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

const TRIVIAL_PINS = new Set([
  '000000', '111111', '222222', '333333', '444444',
  '555555', '666666', '777777', '888888', '999999',
  '123456', '234567', '345678', '456789', '567890',
  '654321', '765432', '876543', '987654', '098765'
]);

export interface PatientAccessRecord {
  id: string;
  citizen_id: string;
  user_id: string;
  token_hash: string;
  pin_hash: string;
  pin_salt: string;
  status: 'active' | 'expired' | 'revoked';
  expires_at: string;
  revoked_at: string | null;
  failed_attempts: number;
  locked_until: string | null;
  last_accessed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function generateSecurePin(): string {
  let pin = '000000';
  for (let attempts = 0; attempts < 100; attempts++) {
    pin = crypto.randomInt(100000, 1000000).toString();
    if (!TRIVIAL_PINS.has(pin)) return pin;
  }
  return pin;
}

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

export function hashPin(pin: string, salt: string): string {
  return crypto.scryptSync(pin.trim(), salt, 32).toString('hex');
}

export function verifyPin(pin: string, salt: string, expectedHash: string): boolean {
  try {
    const derived = Buffer.from(crypto.scryptSync(pin.trim(), salt, 32));
    const expected = Buffer.from(expectedHash, 'hex');
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

async function getAuthenticatedUser(req: Request, supabaseServer: SupabaseClient) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7).trim();
  if (!token) return null;

  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return null;
  return { user, rawToken: token };
}

function createUserScopedClient(supabaseUrl: string, supabaseAnonKey: string, token: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
}

function getOrigin(req: Request): string {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const protocol = forwardedProto || req.protocol || 'https';
  const host = forwardedHost || req.get('host');
  if (!host) throw new Error('Unable to determine public application origin');
  return `${protocol}://${host}`;
}

function genericVerifyError(res: Response) {
  return res.status(403).json({ success: false, error: 'ข้อมูลสำหรับเข้าดูผลตรวจไม่ถูกต้อง' });
}

export function setupPatientAccessRoutes(
  app: any,
  supabaseServer: SupabaseClient,
  supabaseUrl: string,
  supabaseAnonKey: string
) {
  app.post('/api/patient-access/generate', async (req: Request, res: Response) => {
    try {
      const auth = await getAuthenticatedUser(req, supabaseServer);
      if (!auth) return res.status(401).json({ success: false, error: 'ไม่ได้รับอนุญาต: กรุณาเข้าสู่ระบบ อสม. ก่อนทำรายการ' });

      const { citizenId, expirationDays = 7 } = req.body ?? {};
      if (!citizenId || typeof citizenId !== 'string') {
        return res.status(400).json({ success: false, error: 'กรุณาระบุข้อมูลประชาชนที่ถูกต้อง' });
      }

      const days = [1, 7, 30].includes(Number(expirationDays)) ? Number(expirationDays) : 7;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + days * 86400000).toISOString();
      const rawToken = generateSecureToken();
      const rawPin = generateSecurePin();
      const tokenHash = hashToken(rawToken);
      const pinSalt = crypto.randomBytes(16).toString('hex');
      const pinHash = hashPin(rawPin, pinSalt);
      const accessId = crypto.randomUUID();
      const userClient = createUserScopedClient(supabaseUrl, supabaseAnonKey, auth.rawToken);

      const revokeResult = await userClient
        .from('patient_access')
        .update({ status: 'revoked', revoked_at: now.toISOString(), updated_at: now.toISOString() })
        .eq('citizen_id', citizenId)
        .eq('status', 'active');
      if (revokeResult.error) {
        console.error('[patient-access/generate] revoke existing failed:', revokeResult.error);
        return res.status(503).json({ success: false, error: 'ไม่สามารถสร้างสิทธิ์ใหม่ได้ กรุณาลองใหม่อีกครั้ง' });
      }

      const { error: insertError } = await userClient.from('patient_access').insert({
        id: accessId,
        citizen_id: citizenId,
        user_id: auth.user.id,
        token_hash: tokenHash,
        pin_hash: pinHash,
        pin_salt: pinSalt,
        status: 'active',
        expires_at: expiresAt,
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      });

      if (insertError) {
        console.error('[patient-access/generate] insert failed:', insertError);
        return res.status(503).json({ success: false, error: 'ไม่สามารถบันทึกสิทธิ์เข้าดูผลตรวจได้ กรุณาลองใหม่อีกครั้ง' });
      }

      let accessUrl: string;
      try {
        accessUrl = `${getOrigin(req)}/patient-view?token=${encodeURIComponent(rawToken)}`;
      } catch {
        return res.status(500).json({ success: false, error: 'ไม่สามารถสร้างลิงก์เข้าดูผลตรวจได้' });
      }

      return res.json({
        success: true,
        message: 'สร้างสิทธิ์เข้าดูผลตรวจเรียบร้อยแล้ว',
        access: {
          id: accessId,
          citizenId,
          status: 'active',
          expiresAt,
          createdAt: now.toISOString(),
          rawToken,
          pin: rawPin,
          accessUrl,
          savedToDatabase: true
        }
      });
    } catch (error: any) {
      console.error('[patient-access/generate] Error:', error);
      return res.status(500).json({ success: false, error: 'เกิดข้อผิดพลาดภายในระบบในการสร้างสิทธิ์' });
    }
  });

  app.get('/api/patient-access/status/:citizenId', async (req: Request, res: Response) => {
    try {
      const auth = await getAuthenticatedUser(req, supabaseServer);
      if (!auth) return res.status(401).json({ success: false, error: 'ไม่ได้รับอนุญาต: กรุณาเข้าสู่ระบบ อสม.' });

      const citizenId = req.params.citizenId;
      if (!citizenId) return res.status(400).json({ success: false, error: 'ข้อมูลไม่ถูกต้อง' });

      const userClient = createUserScopedClient(supabaseUrl, supabaseAnonKey, auth.rawToken);
      const { data, error } = await userClient
        .from('patient_access')
        .select('id, citizen_id, status, expires_at, created_at, revoked_at, failed_attempts, locked_until')
        .eq('citizen_id', citizenId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[patient-access/status] query failed:', error);
        return res.status(503).json({ success: false, error: 'ไม่สามารถตรวจสอบสิทธิ์ได้ในขณะนี้' });
      }

      if (!data) return res.json({ success: true, hasAccess: false, citizenId });

      const now = Date.now();
      const isExpired = new Date(data.expires_at).getTime() <= now;
      const isLocked = !!data.locked_until && new Date(data.locked_until).getTime() > now;
      const effectiveStatus = data.status === 'active' && isExpired ? 'expired' : data.status;

      return res.json({
        success: true,
        hasAccess: effectiveStatus === 'active',
        access: {
          id: data.id,
          citizenId: data.citizen_id,
          status: effectiveStatus,
          expiresAt: data.expires_at,
          createdAt: data.created_at,
          revokedAt: data.revoked_at,
          isExpired,
          isLocked
        }
      });
    } catch (error: any) {
      console.error('[patient-access/status] Error:', error);
      return res.status(500).json({ success: false, error: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์' });
    }
  });

  app.post('/api/patient-access/revoke', async (req: Request, res: Response) => {
    try {
      const auth = await getAuthenticatedUser(req, supabaseServer);
      if (!auth) return res.status(401).json({ success: false, error: 'ไม่ได้รับอนุญาต: กรุณาเข้าสู่ระบบ อสม.' });

      const { citizenId, accessId } = req.body ?? {};
      if (!citizenId && !accessId) return res.status(400).json({ success: false, error: 'กรุณาระบุข้อมูลสิทธิ์ที่ต้องการยกเลิก' });

      const now = new Date().toISOString();
      const userClient = createUserScopedClient(supabaseUrl, supabaseAnonKey, auth.rawToken);
      let query = userClient.from('patient_access').update({ status: 'revoked', revoked_at: now, updated_at: now });
      if (accessId) query = query.eq('id', accessId);
      else query = query.eq('citizen_id', citizenId).eq('status', 'active');

      const { error } = await query;
      if (error) {
        console.error('[patient-access/revoke] update failed:', error);
        return res.status(503).json({ success: false, error: 'ไม่สามารถยกเลิกสิทธิ์ได้ในขณะนี้' });
      }

      return res.json({ success: true, message: 'ยกเลิกสิทธิ์เข้าดูผลตรวจเรียบร้อยแล้ว' });
    } catch (error: any) {
      console.error('[patient-access/revoke] Error:', error);
      return res.status(500).json({ success: false, error: 'เกิดข้อผิดพลาดในการยกเลิกสิทธิ์' });
    }
  });

  app.post('/api/patient-access/verify', async (req: Request, res: Response) => {
    try {
      const { token, pin } = req.body ?? {};
      const genericInvalidError = 'ข้อมูลสำหรับเข้าดูผลตรวจไม่ถูกต้อง';
      if (!token || typeof token !== 'string' || !pin || typeof pin !== 'string') {
        return res.status(400).json({ success: false, error: genericInvalidError });
      }
      if (token.length > 512 || pin.length > 32) return genericVerifyError(res);

      const tokenHash = hashToken(token);
      const { data: record, error: lookupError } = await supabaseServer
        .from('patient_access')
        .select('*')
        .eq('token_hash', tokenHash)
        .maybeSingle();

      if (lookupError) {
        console.error('[patient-access/verify] database lookup failed:', lookupError);
        return res.status(503).json({ success: false, error: 'ไม่สามารถตรวจสอบสิทธิ์ได้ในขณะนี้' });
      }
      if (!record) {
        await new Promise(r => setTimeout(r, 200 + Math.random() * 200));
        return res.status(403).json({ success: false, error: genericInvalidError });
      }

      const now = new Date();
      if (record.locked_until && new Date(record.locked_until).getTime() > now.getTime()) {
        const remaining = Math.ceil((new Date(record.locked_until).getTime() - now.getTime()) / 60000);
        return res.status(429).json({ success: false, error: `ระงับการเข้าถึงชั่วคราวเนื่องจากกรอกรหัสไม่ถูกต้องหลายครั้ง กรุณารออีก ${remaining} นาที` });
      }
      if (record.status !== 'active' || new Date(record.expires_at).getTime() <= now.getTime()) {
        return res.status(403).json({ success: false, error: 'สิทธิ์นี้หมดอายุหรือถูกยกเลิกแล้ว กรุณาติดต่อ อสม. เพื่อขอรหัสใหม่' });
      }

      const isPinValid = verifyPin(pin.trim(), record.pin_salt, record.pin_hash);
      if (!isPinValid) {
        const newAttempts = Number(record.failed_attempts || 0) + 1;
        const lockUntil = newAttempts >= 5 ? new Date(now.getTime() + 15 * 60000).toISOString() : null;
        const { error: updateError } = await supabaseServer
          .from('patient_access')
          .update({ failed_attempts: newAttempts, locked_until: lockUntil, updated_at: now.toISOString() })
          .eq('id', record.id)
          .eq('status', 'active');

        if (updateError) {
          console.error('[patient-access/verify] failed-attempt update failed:', updateError);
          return res.status(503).json({ success: false, error: 'ไม่สามารถตรวจสอบสิทธิ์ได้ในขณะนี้' });
        }

        await new Promise(r => setTimeout(r, Math.min(newAttempts * 300, 2000)));
        if (lockUntil) return res.status(429).json({ success: false, error: 'ระงับการเข้าถึงชั่วคราวเนื่องจากกรอกรหัสไม่ถูกต้องหลายครั้ง กรุณารออีก 15 นาที' });
        return res.status(403).json({ success: false, error: genericInvalidError });
      }

      const { error: successUpdateError } = await supabaseServer
        .from('patient_access')
        .update({ failed_attempts: 0, locked_until: null, last_accessed_at: now.toISOString(), updated_at: now.toISOString() })
        .eq('id', record.id)
        .eq('status', 'active');
      if (successUpdateError) {
        console.error('[patient-access/verify] success update failed:', successUpdateError);
        return res.status(503).json({ success: false, error: 'ไม่สามารถยืนยันสิทธิ์ได้ในขณะนี้' });
      }

      return res.json({ success: true, message: 'ยืนยันสิทธิ์สำเร็จ', citizenId: record.citizen_id, accessId: record.id, expiresAt: record.expires_at });
    } catch (error: any) {
      console.error('[patient-access/verify] Error:', error);
      return res.status(500).json({ success: false, error: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์' });
    }
  });
}
