-- ==============================================================================
-- MIGRATION: Patient Self-Checkup Access via QR Code & PIN (Phase 1)
-- Application: VHV Smart Health Community
-- Table: public.patient_access
-- Features: Secure token hash, Salted PIN hash, Expiration, Revocation, Brute-force lockout
-- Guarantee: Idempotent, RLS Protected, Zero PII/Health data stored in access record
-- ==============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.patient_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id TEXT NOT NULL REFERENCES public.citizens(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  pin_salt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_access_citizen_id ON public.patient_access (citizen_id);
CREATE INDEX IF NOT EXISTS idx_patient_access_token_hash ON public.patient_access (token_hash);
CREATE INDEX IF NOT EXISTS idx_patient_access_status ON public.patient_access (status);
CREATE INDEX IF NOT EXISTS idx_patient_access_expires_at ON public.patient_access (expires_at);
CREATE INDEX IF NOT EXISTS idx_patient_access_user_id ON public.patient_access (user_id);

ALTER TABLE public.patient_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_access_select_own" ON public.patient_access;
CREATE POLICY "patient_access_select_own"
ON public.patient_access FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.citizens c WHERE c.id = patient_access.citizen_id AND c.user_id = auth.uid())
);

DROP POLICY IF EXISTS "patient_access_insert_own" ON public.patient_access;
CREATE POLICY "patient_access_insert_own"
ON public.patient_access FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.citizens c WHERE c.id = patient_access.citizen_id AND c.user_id = auth.uid())
);

DROP POLICY IF EXISTS "patient_access_update_own" ON public.patient_access;
CREATE POLICY "patient_access_update_own"
ON public.patient_access FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.citizens c WHERE c.id = patient_access.citizen_id AND c.user_id = auth.uid())
)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.citizens c WHERE c.id = patient_access.citizen_id AND c.user_id = auth.uid())
);

DROP POLICY IF EXISTS "patient_access_delete_own" ON public.patient_access;
CREATE POLICY "patient_access_delete_own"
ON public.patient_access FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.citizens c WHERE c.id = patient_access.citizen_id AND c.user_id = auth.uid())
);

-- Atomic failure counter. This prevents concurrent wrong-PIN requests from
-- racing each other and bypassing the five-attempt lockout threshold.
CREATE OR REPLACE FUNCTION public.increment_patient_access_failure(
  p_access_id UUID,
  p_lock_minutes INTEGER DEFAULT 15,
  p_max_attempts INTEGER DEFAULT 5
)
RETURNS TABLE(failed_attempts INTEGER, locked_until TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts INTEGER;
  v_locked_until TIMESTAMPTZ;
BEGIN
  UPDATE public.patient_access
  SET failed_attempts = failed_attempts + 1,
      locked_until = CASE
        WHEN failed_attempts + 1 >= p_max_attempts
        THEN NOW() + make_interval(mins => GREATEST(1, p_lock_minutes))
        ELSE NULL
      END,
      updated_at = NOW()
  WHERE id = p_access_id
    AND status = 'active'
    AND (locked_until IS NULL OR locked_until <= NOW())
  RETURNING patient_access.failed_attempts, patient_access.locked_until
  INTO v_attempts, v_locked_until;

  IF NOT FOUND THEN
    SELECT pa.failed_attempts, pa.locked_until
    INTO v_attempts, v_locked_until
    FROM public.patient_access pa
    WHERE pa.id = p_access_id;
  END IF;

  RETURN QUERY SELECT COALESCE(v_attempts, 0), v_locked_until;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_patient_access_failure(UUID, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_patient_access_failure(UUID, INTEGER, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.increment_patient_access_failure(UUID, INTEGER, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_patient_access_failure(UUID, INTEGER, INTEGER) TO service_role;

COMMIT;

-- Audit trail for Patient Access security events. No raw token/PIN or patient health data is stored.
CREATE TABLE IF NOT EXISTS public.patient_access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_id UUID REFERENCES public.patient_access(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event TEXT NOT NULL CHECK (event IN (
    'access_generated',
    'verify_invalid_input',
    'verify_invalid_token',
    'verify_locked',
    'verify_inactive_or_expired',
    'verify_pin_failed',
    'verify_pin_locked',
    'verify_success','access_revoked'
  )),
  success BOOLEAN NOT NULL DEFAULT FALSE,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_access_audit_access_id ON public.patient_access_audit(access_id);
CREATE INDEX IF NOT EXISTS idx_patient_access_audit_user_id ON public.patient_access_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_patient_access_audit_created_at ON public.patient_access_audit(created_at DESC);

ALTER TABLE public.patient_access_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.patient_access_audit FROM PUBLIC;
REVOKE ALL ON public.patient_access_audit FROM anon;
REVOKE ALL ON public.patient_access_audit FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_access_audit TO service_role;
