-- ==============================================================================
-- MIGRATION: Patient Self-Checkup Access via QR Code & PIN (Phase 1)
-- Application: VHV Smart Health Community
-- Table: public.patient_access
-- Features: Secure token hash, Salted PIN hash, Expiration, Revocation, Brute-force lockout
-- Guarantee: Idempotent, RLS Protected, Zero PII/Health data stored in access record
-- ==============================================================================

BEGIN;

-- 1. Create patient_access Table
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

-- 2. Performance & Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_patient_access_citizen_id ON public.patient_access (citizen_id);
CREATE INDEX IF NOT EXISTS idx_patient_access_token_hash ON public.patient_access (token_hash);
CREATE INDEX IF NOT EXISTS idx_patient_access_status ON public.patient_access (status);
CREATE INDEX IF NOT EXISTS idx_patient_access_expires_at ON public.patient_access (expires_at);
CREATE INDEX IF NOT EXISTS idx_patient_access_user_id ON public.patient_access (user_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.patient_access ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for VHV Authenticated Users
DROP POLICY IF EXISTS "patient_access_select_own" ON public.patient_access;
CREATE POLICY "patient_access_select_own"
ON public.patient_access
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "patient_access_insert_own" ON public.patient_access;
CREATE POLICY "patient_access_insert_own"
ON public.patient_access
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "patient_access_update_own" ON public.patient_access;
CREATE POLICY "patient_access_update_own"
ON public.patient_access
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "patient_access_delete_own" ON public.patient_access;
CREATE POLICY "patient_access_delete_own"
ON public.patient_access
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

COMMIT;
