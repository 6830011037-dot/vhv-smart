-- ==============================================================================
-- ZERO DATA LOSS MIGRATION & RLS SCRIPT FOR SUPABASE SQL EDITOR
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 4: ALTER COLUMN TYPE FROM TEXT TO UUID
-- ------------------------------------------------------------------------------
ALTER TABLE public.citizens
ALTER COLUMN user_id TYPE uuid
USING NULLIF(TRIM(user_id), '')::uuid;

ALTER TABLE public.health_records
ALTER COLUMN user_id TYPE uuid
USING NULLIF(TRIM(user_id), '')::uuid;


-- ------------------------------------------------------------------------------
-- STEP 7: ENABLE ROW LEVEL SECURITY
-- ------------------------------------------------------------------------------
ALTER TABLE public.citizens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------------------------
-- STEP 8: DROP EXISTING POLICIES & CREATE TYPE-SAFE RLS POLICIES
-- ------------------------------------------------------------------------------

-- 1. CITIZENS POLICIES
DROP POLICY IF EXISTS "citizens_select_own" ON public.citizens;
DROP POLICY IF EXISTS "citizens_insert_own" ON public.citizens;
DROP POLICY IF EXISTS "citizens_update_own" ON public.citizens;
DROP POLICY IF EXISTS "citizens_delete_own" ON public.citizens;
DROP POLICY IF EXISTS "Users can manage own citizens" ON public.citizens;
DROP POLICY IF EXISTS "Users can view own citizens" ON public.citizens;

CREATE POLICY "citizens_select_own"
ON public.citizens
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "citizens_insert_own"
ON public.citizens
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "citizens_update_own"
ON public.citizens
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "citizens_delete_own"
ON public.citizens
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);


-- 2. HEALTH_RECORDS POLICIES
DROP POLICY IF EXISTS "health_records_select_own" ON public.health_records;
DROP POLICY IF EXISTS "health_records_insert_own" ON public.health_records;
DROP POLICY IF EXISTS "health_records_update_own" ON public.health_records;
DROP POLICY IF EXISTS "health_records_delete_own" ON public.health_records;
DROP POLICY IF EXISTS "Users can manage own health records" ON public.health_records;
DROP POLICY IF EXISTS "Users can view own health records" ON public.health_records;

CREATE POLICY "health_records_select_own"
ON public.health_records
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "health_records_insert_own"
ON public.health_records
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "health_records_update_own"
ON public.health_records
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "health_records_delete_own"
ON public.health_records
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);


-- 3. PROFILES POLICIES
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_delete_own"
ON public.profiles
FOR DELETE
TO authenticated
USING (auth.uid() = id);
