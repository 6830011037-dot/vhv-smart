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

// In-memory fallback cache when Supabase patient_access table is pending migration
const memoryAccessStore: Map<string, PatientAccessRecord> = new Map();

/**
 * Generate a cryptographically secure 6-digit PIN with anti-trivial pattern check
 */
export function generateSecurePin(): string {
  let pin = '';
  let attempts = 0;
  while (attempts < 100) {
    // Generate integer between 100000 and 999999
    const num = crypto.randomInt(100000, 1000000);
    pin = num.toString();
    if (!TRIVIAL_PINS.has(pin)) {
      return pin;
    }
    attempts++;
  }
  return pin;
}

/**
 * Generate an opaque, high-entropy random URL-safe access token (256-bit entropy)
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Hash access token with SHA-256
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Hash PIN using Scrypt with a random salt for brute-force resistance
 */
export function hashPin(pin: string, salt: string): string {
  return crypto.scryptSync(pin.trim(), salt, 32).toString('hex');
}

/**
 * Timing-safe PIN verification
 */
export function verifyPin(pin: string, salt: string, expectedHash: string): boolean {
  try {
    const derived = crypto.scryptSync(pin.trim(), salt, 32).toString('hex');
    const derivedBuf = Buffer.from(derived, 'hex');
    const expectedBuf = Buffer.from(expectedHash, 'hex');
    if (derivedBuf.length !== expectedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(derivedBuf, expectedBuf);
  } catch (err) {
    return false;
  }
}

/**
 * Authenticate VHV via Bearer token
 */
async function getAuthenticatedUser(req: Request, supabaseServer: SupabaseClient) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  if (!token) return null;

  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) {
    return null;
  }
  return { user, rawToken: token };
}

/**
 * Create user-scoped Supabase client that respects RLS policies
 */
function createUserScopedClient(supabaseUrl: string, supabaseAnonKey: string, token: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
}

/**
 * Mount patient access routes onto the Express app
 */
export function setupPatientAccessRoutes(
  app: any, 
  supabaseServer: SupabaseClient, 
  supabaseUrl: string, 
  supabaseAnonKey: string
) {

  // 1. GENERATE: Create new QR Code token + PIN for a citizen
  app.post('/api/patient-access/generate', async (req: Request, res: Response) => {
    try {
      const auth = await getAuthenticatedUser(req, supabaseServer);
      if (!auth) {
        return res.status(401).json({
          success: false,
          error: 'ไม่ได้รับอนุญาต: กรุณาเข้าสู่ระบบ อสม. ก่อนทำรายการ'
        });
      }

      const { citizenId, expirationDays = 7 } = req.body;
      if (!citizenId || typeof citizenId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'กรุณาระบุข้อมูลประชาชนที่ถูกต้อง'
        });
      }

      // Allowed expiration periods: 1 day, 7 days, 30 days
      const days = [1, 7, 30].includes(Number(expirationDays)) ? Number(expirationDays) : 7;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

      // Cryptographic secrets generation
      const rawToken = generateSecureToken();
      const rawPin = generateSecurePin();
      const tokenHash = hashToken(rawToken);
      const pinSalt = crypto.randomBytes(16).toString('hex');
      const pinHash = hashPin(rawPin, pinSalt);
      const accessId = crypto.randomUUID();

      const userClient = createUserScopedClient(supabaseUrl, supabaseAnonKey, auth.rawToken);

      let savedToDatabase = false;

      try {
        // First, revoke any existing active tokens for this citizen
        await userClient
          .from('patient_access')
          .update({
            status: 'revoked',
            revoked_at: now.toISOString(),
            updated_at: now.toISOString()
          })
          .eq('citizen_id', citizenId)
          .eq('status', 'active');

        // Insert new access record
        const { error: insertError } = await userClient
          .from('patient_access')
          .insert({
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

        if (!insertError) {
          savedToDatabase = true;
        } else {
          console.warn('[patient-access] Database insert notice:', insertError.message);
        }
      } catch (dbErr: any) {
        console.warn('[patient-access] Database connection exception, using fallback cache:', dbErr?.message);
      }

      // Revoke and update memory fallback store as well
      for (const [key, item] of memoryAccessStore.entries()) {
        if (item.citizen_id === citizenId && item.status === 'active') {
          item.status = 'revoked';
          item.revoked_at = now.toISOString();
        }
      }

      const memoryRecord: PatientAccessRecord = {
        id: accessId,
        citizen_id: citizenId,
        user_id: auth.user.id,
        token_hash: tokenHash,
        pin_hash: pinHash,
        pin_salt: pinSalt,
        status: 'active',
        expires_at: expiresAt,
        revoked_at: null,
        failed_attempts: 0,
        locked_until: null,
        last_accessed_at: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      };
      memoryAccessStore.set(accessId, memoryRecord);

      // Build target patient view URL (Pure opaque token, zero PII, zero health data)
      const origin = req.headers.origin || (req.protocol + '://' + req.get('host'));
      const accessUrl = `${origin}/patient-view?token=${rawToken}`;

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
          savedToDatabase
        }
      });
    } catch (error: any) {
      console.error('[patient-access/generate] Error:', error);
      return res.status(500).json({
        success: false,
        error: 'เกิดข้อผิดพลาดภายในระบบในการสร้างสิทธิ์'
      });
    }
  });

  // 2. STATUS: Get current access permission status for a citizen
  app.get('/api/patient-access/status/:citizenId', async (req: Request, res: Response) => {
    try {
      const auth = await getAuthenticatedUser(req, supabaseServer);
      if (!auth) {
        return res.status(401).json({
          success: false,
          error: 'ไม่ได้รับอนุญาต: กรุณาเข้าสู่ระบบ อสม.'
        });
      }

      const citizenId = req.params.citizenId;
      if (!citizenId) {
        return res.status(400).json({ success: false, error: 'ข้อมูลไม่ถูกต้อง' });
      }

      const userClient = createUserScopedClient(supabaseUrl, supabaseAnonKey, auth.rawToken);
      let foundRecord: any = null;

      try {
        const { data, error } = await userClient
          .from('patient_access')
          .select('id, citizen_id, status, expires_at, created_at, revoked_at, failed_attempts, locked_until')
          .eq('citizen_id', citizenId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          foundRecord = data;
        }
      } catch (dbErr) {
        // Ignore and check memory store
      }

      if (!foundRecord) {
        // Check memory store
        const records = Array.from(memoryAccessStore.values())
          .filter(r => r.citizen_id === citizenId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        if (records.length > 0) {
          foundRecord = records[0];
        }
      }

      if (!foundRecord) {
        return res.json({
          success: true,
          hasAccess: false,
          citizenId
        });
      }

      const now = new Date();
      const expiresAtDate = new Date(foundRecord.expires_at);
      const isExpired = expiresAtDate.getTime() <= now.getTime();
      const isLocked = foundRecord.locked_until ? new Date(foundRecord.locked_until).getTime() > now.getTime() : false;

      let effectiveStatus = foundRecord.status;
      if (effectiveStatus === 'active' && isExpired) {
        effectiveStatus = 'expired';
      }

      return res.json({
        success: true,
        hasAccess: effectiveStatus === 'active',
        access: {
          id: foundRecord.id,
          citizenId: foundRecord.citizen_id,
          status: effectiveStatus,
          expiresAt: foundRecord.expires_at,
          createdAt: foundRecord.created_at,
          revokedAt: foundRecord.revoked_at,
          isExpired,
          isLocked
        }
      });
    } catch (error: any) {
      console.error('[patient-access/status] Error:', error);
      return res.status(500).json({
        success: false,
        error: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์'
      });
    }
  });

  // 3. REVOKE: Revoke existing access permission immediately
  app.post('/api/patient-access/revoke', async (req: Request, res: Response) => {
    try {
      const auth = await getAuthenticatedUser(req, supabaseServer);
      if (!auth) {
        return res.status(401).json({
          success: false,
          error: 'ไม่ได้รับอนุญาต: กรุณาเข้าสู่ระบบ อสม.'
        });
      }

      const { citizenId, accessId } = req.body;
      if (!citizenId && !accessId) {
        return res.status(400).json({
          success: false,
          error: 'กรุณาระบุข้อมูลสิทธิ์ที่ต้องการยกเลิก'
        });
      }

      const now = new Date().toISOString();
      const userClient = createUserScopedClient(supabaseUrl, supabaseAnonKey, auth.rawToken);

      try {
        let query = userClient
          .from('patient_access')
          .update({
            status: 'revoked',
            revoked_at: now,
            updated_at: now
          });

        if (accessId) {
          query = query.eq('id', accessId);
        } else if (citizenId) {
          query = query.eq('citizen_id', citizenId).eq('status', 'active');
        }

        await query;
      } catch (dbErr) {
        console.warn('[patient-access/revoke] Database revoke notice:', dbErr);
      }

      // Also update memory fallback store
      for (const [key, item] of memoryAccessStore.entries()) {
        if ((accessId && item.id === accessId) || (citizenId && item.citizen_id === citizenId && item.status === 'active')) {
          item.status = 'revoked';
          item.revoked_at = now;
        }
      }

      return res.json({
        success: true,
        message: 'ยกเลิกสิทธิ์เข้าดูผลตรวจเรียบร้อยแล้ว'
      });
    } catch (error: any) {
      console.error('[patient-access/revoke] Error:', error);
      return res.status(500).json({
        success: false,
        error: 'เกิดข้อผิดพลาดในการยกเลิกสิทธิ์'
      });
    }
  });

  // 4. VERIFY: Server-side validation for Phase 2 readiness with rate limiting & brute-force protection
  app.post('/api/patient-access/verify', async (req: Request, res: Response) => {
    try {
      const { token, pin } = req.body;

      // Generic error message for security (Anti-Enumeration Rule)
      const genericInvalidError = 'ข้อมูลสำหรับเข้าดูผลตรวจไม่ถูกต้อง';

      if (!token || typeof token !== 'string' || !pin || typeof pin !== 'string') {
        return res.status(400).json({ success: false, error: genericInvalidError });
      }

      const cleanPin = pin.trim();
      const tokenHashed = hashToken(token);

      // Lookup in database first
      let record: PatientAccessRecord | null = null;
      try {
        const { data } = await supabaseServer
          .from('patient_access')
          .select('*')
          .eq('token_hash', tokenHashed)
          .maybeSingle();

        if (data) {
          record = data as PatientAccessRecord;
        }
      } catch (err) {}

      // If not in database, check memory store
      if (!record) {
        for (const item of memoryAccessStore.values()) {
          if (item.token_hash === tokenHashed) {
            record = item;
            break;
          }
        }
      }

      if (!record) {
        // Timing mitigation
        await new Promise(r => setTimeout(r, 200 + Math.random() * 200));
        return res.status(403).json({ success: false, error: genericInvalidError });
      }

      const now = new Date();

      // Check lockout
      if (record.locked_until && new Date(record.locked_until).getTime() > now.getTime()) {
        const remainingMinutes = Math.ceil((new Date(record.locked_until).getTime() - now.getTime()) / 60000);
        return res.status(429).json({
          success: false,
          error: `ระงับการเข้าถึงชั่วคราวเนื่องจากกรอกรหัสไม่ถูกต้องหลายครั้ง กรุณารออีก ${remainingMinutes} นาที`
        });
      }

      // Check status & expiry
      if (record.status === 'revoked' || new Date(record.expires_at).getTime() <= now.getTime()) {
        return res.status(403).json({
          success: false,
          error: 'สิทธิ์นี้หมดอายุหรือถูกยกเลิกแล้ว กรุณาติดต่อ อสม. เพื่อขอรหัสใหม่'
        });
      }

      // Verify PIN using Scrypt + constant time
      const isPinValid = verifyPin(cleanPin, record.pin_salt, record.pin_hash);

      if (!isPinValid) {
        const newAttempts = (record.failed_attempts || 0) + 1;
        let lockUntil: string | null = null;

        if (newAttempts >= 5) {
          // Lock for 15 minutes after 5 failed attempts
          lockUntil = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
        }

        // Update failed count in database and memory
        try {
          await supabaseServer
            .from('patient_access')
            .update({
              failed_attempts: newAttempts,
              locked_until: lockUntil,
              updated_at: now.toISOString()
            })
            .eq('id', record.id);
        } catch (e) {}

        record.failed_attempts = newAttempts;
        record.locked_until = lockUntil;

        // Progressive delay to prevent fast automated brute forcing
        const delayMs = Math.min(newAttempts * 300, 2000);
        await new Promise(r => setTimeout(r, delayMs));

        if (lockUntil) {
          return res.status(429).json({
            success: false,
            error: 'ระงับการเข้าถึงชั่วคราวเนื่องจากกรอกรหัสไม่ถูกต้องหลายครั้ง กรุณารออีก 15 นาที'
          });
        }

        return res.status(403).json({ success: false, error: genericInvalidError });
      }

      // PIN is valid: reset failed attempts & record last accessed timestamp
      try {
        await supabaseServer
          .from('patient_access')
          .update({
            failed_attempts: 0,
            locked_until: null,
            last_accessed_at: now.toISOString(),
            updated_at: now.toISOString()
          })
          .eq('id', record.id);
      } catch (e) {}

      record.failed_attempts = 0;
      record.locked_until = null;
      record.last_accessed_at = now.toISOString();

      return res.json({
        success: true,
        message: 'ยืนยันสิทธิ์สำเร็จ',
        citizenId: record.citizen_id,
        accessId: record.id,
        expiresAt: record.expires_at
      });
    } catch (error: any) {
      console.error('[patient-access/verify] Error:', error);
      return res.status(500).json({
        success: false,
        error: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์'
      });
    }
  });
}
