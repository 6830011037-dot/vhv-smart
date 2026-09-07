-- ==============================================================================
-- SUPABASE FINAL PRODUCTION MIGRATION SCRIPT
-- Application: VHV Smart Health (ระบบผู้ช่วย อสม. อัจฉริยะ)
-- Features: Profiles, Citizens, Health Records, Shared Reports, RLS & RPCs
-- Guarantee: Idempotent, Zero Data Loss, Safe Alter Column, Transactional RPC
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- STEP 1: DROP OLD / CONFLICTING POLICIES BEFORE ALTERING COLUMN TYPES
-- (Prevents ERROR 0A000: cannot alter type of a column used in a policy definition)
-- ==============================================================================

-- Drop Citizens Policies
DROP POLICY IF EXISTS "citizens_select_own" ON public.citizens;
DROP POLICY IF EXISTS "citizens_insert_own" ON public.citizens;
DROP POLICY IF EXISTS "citizens_update_own" ON public.citizens;
DROP POLICY IF EXISTS "citizens_delete_own" ON public.citizens;
DROP POLICY IF EXISTS "Users can manage own citizens" ON public.citizens;
DROP POLICY IF EXISTS "Users can view own citizens" ON public.citizens;
DROP POLICY IF EXISTS "Users can insert own citizens" ON public.citizens;
DROP POLICY IF EXISTS "Users can update own citizens" ON public.citizens;
DROP POLICY IF EXISTS "Users can delete own citizens" ON public.citizens;

-- Drop Health Records Policies
DROP POLICY IF EXISTS "health_records_select_own" ON public.health_records;
DROP POLICY IF EXISTS "health_records_insert_own" ON public.health_records;
DROP POLICY IF EXISTS "health_records_update_own" ON public.health_records;
DROP POLICY IF EXISTS "health_records_delete_own" ON public.health_records;
DROP POLICY IF EXISTS "Users can manage own health records" ON public.health_records;
DROP POLICY IF EXISTS "Users can view own health records" ON public.health_records;
DROP POLICY IF EXISTS "Users can insert own health records" ON public.health_records;
DROP POLICY IF EXISTS "Users can update own health records" ON public.health_records;
DROP POLICY IF EXISTS "Users can delete own health records" ON public.health_records;

-- Drop Profiles Policies
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view public profiles" ON public.profiles;

-- Drop Shared Reports Policies
DROP POLICY IF EXISTS "shared_reports_select" ON public.shared_reports;
DROP POLICY IF EXISTS "shared_reports_insert" ON public.shared_reports;
DROP POLICY IF EXISTS "shared_reports_update" ON public.shared_reports;
DROP POLICY IF EXISTS "shared_reports_delete" ON public.shared_reports;


-- ==============================================================================
-- STEP 2: SAFE SCHEMA UPDATES & UUID TYPE MIGRATION
-- ==============================================================================

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  email TEXT,
  village_name TEXT,
  health_center_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CITIZENS TABLE
CREATE TABLE IF NOT EXISTS public.citizens (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prefix TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  citizen_id TEXT,
  gender TEXT,
  age INTEGER,
  birth_date TEXT,
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

-- Convert user_id in citizens to UUID if it was previously TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'citizens' 
      AND column_name = 'user_id' 
      AND data_type = 'text'
  ) THEN
    ALTER TABLE public.citizens
    ALTER COLUMN user_id TYPE uuid
    USING NULLIF(TRIM(user_id), '')::uuid;
  END IF;
END $$;

-- 3. HEALTH_RECORDS TABLE
CREATE TABLE IF NOT EXISTS public.health_records (
  id TEXT PRIMARY KEY,
  citizen_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Convert user_id in health_records to UUID if it was previously TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'health_records' 
      AND column_name = 'user_id' 
      AND data_type = 'text'
  ) THEN
    ALTER TABLE public.health_records
    ALTER COLUMN user_id TYPE uuid
    USING NULLIF(TRIM(user_id), '')::uuid;
  END IF;
END $$;

-- 4. SHARED_REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.shared_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_phone TEXT NOT NULL,
  receiver_phone TEXT,
  title TEXT NOT NULL,
  message TEXT,
  citizen_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  health_records JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'unread', 'read', 'downloaded', 'imported')),
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ==============================================================================
-- STEP 3: PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_citizens_user_id ON public.citizens (user_id);
CREATE INDEX IF NOT EXISTS idx_citizens_citizen_id ON public.citizens (citizen_id);
CREATE INDEX IF NOT EXISTS idx_health_records_user_id ON public.health_records (user_id);
CREATE INDEX IF NOT EXISTS idx_health_records_citizen_id ON public.health_records (citizen_id);
CREATE INDEX IF NOT EXISTS idx_health_records_date ON public.health_records (date);

CREATE INDEX IF NOT EXISTS idx_shared_reports_sender_id ON public.shared_reports (sender_id);
CREATE INDEX IF NOT EXISTS idx_shared_reports_receiver_id ON public.shared_reports (receiver_id);
CREATE INDEX IF NOT EXISTS idx_shared_reports_status ON public.shared_reports (status);
CREATE INDEX IF NOT EXISTS idx_shared_reports_created_at ON public.shared_reports (created_at DESC);


-- ==============================================================================
-- STEP 4: ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citizens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_reports ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- STEP 5: ATOMIC, TYPE-SAFE RLS POLICIES
-- ==============================================================================

-- --- PROFILES POLICIES ---
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


-- --- CITIZENS POLICIES ---
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


-- --- HEALTH_RECORDS POLICIES ---
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


-- --- SHARED_REPORTS POLICIES ---
CREATE POLICY "shared_reports_select"
ON public.shared_reports
FOR SELECT
TO authenticated
USING (
  auth.uid() = sender_id 
  OR 
  auth.uid() = receiver_id
);

CREATE POLICY "shared_reports_insert"
ON public.shared_reports
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
);

CREATE POLICY "shared_reports_update"
ON public.shared_reports
FOR UPDATE
TO authenticated
USING (
  auth.uid() = sender_id 
  OR 
  auth.uid() = receiver_id
)
WITH CHECK (
  auth.uid() = sender_id 
  OR 
  auth.uid() = receiver_id
);

CREATE POLICY "shared_reports_delete"
ON public.shared_reports
FOR DELETE
TO authenticated
USING (
  (auth.uid() = sender_id AND status = 'pending')
  OR 
  (auth.uid() = receiver_id AND status IN ('accepted', 'rejected', 'cancelled'))
);


-- ==============================================================================
-- STEP 6: SECURE LOOKUP FUNCTIONS (SECURITY DEFINER, LEAK PREVENTION)
-- ==============================================================================

-- 1. Lookup Receiver by Phone
CREATE OR REPLACE FUNCTION public.lookup_receiver_by_phone(target_phone TEXT)
RETURNS TABLE (
  user_id UUID,
  name TEXT,
  phone TEXT,
  village_name TEXT,
  health_center_name TEXT
) 
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  clean_phone TEXT := regexp_replace(target_phone, '\D', '', 'g');
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS user_id, 
    p.name, 
    p.phone, 
    p.village_name, 
    p.health_center_name
  FROM public.profiles p
  WHERE regexp_replace(p.phone, '\D', '', 'g') = clean_phone
  LIMIT 1;
END;
$$;

-- 2. Lookup Receiver by Email
CREATE OR REPLACE FUNCTION public.lookup_receiver_by_email(target_email TEXT)
RETURNS TABLE (
  user_id UUID,
  name TEXT,
  phone TEXT,
  village_name TEXT,
  health_center_name TEXT
) 
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  clean_email TEXT := lower(trim(target_email));
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS user_id, 
    p.name, 
    p.phone, 
    p.village_name, 
    p.health_center_name
  FROM public.profiles p
  WHERE lower(trim(COALESCE(p.email, ''))) = clean_email
     OR p.id IN (SELECT u.id FROM auth.users u WHERE lower(trim(u.email)) = clean_email)
  LIMIT 1;
END;
$$;


-- ==============================================================================
-- STEP 7: TRANSACTIONAL ACCEPT & REJECT RPCS
-- ==============================================================================

-- 1. ACCEPT SHARED REPORT RPC
CREATE OR REPLACE FUNCTION public.accept_shared_report(target_report_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_report RECORD;
  v_caller_id UUID := auth.uid();
  v_cit_raw JSONB;
  v_records_raw JSONB;
  v_cit_elem JSONB;
  v_rec_elem JSONB;
  v_old_cit_id TEXT;
  v_new_cit_id TEXT;
  v_existing_cit_id TEXT;
  v_target_cit_id TEXT;
  v_old_rec_id TEXT;
  v_new_rec_id TEXT;
  v_first_new_cit_id TEXT := NULL;
  v_id_map JSONB := '{}'::jsonb;
  v_inserted_citizens INT := 0;
  v_inserted_records INT := 0;
  v_id_card TEXT;
  v_report_prefix TEXT;
  v_idx INT := 0;
BEGIN
  -- 1. Authenticated check
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Fetch and lock report for transaction isolation (prevents race condition)
  SELECT * INTO v_report
  FROM public.shared_reports
  WHERE id = target_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found with id %', target_report_id;
  END IF;

  -- 3. Validate receiver ownership: only the intended receiver can accept
  IF v_report.receiver_id != v_caller_id THEN
    RAISE EXCEPTION 'Access denied: caller (%) is not the intended receiver (%)', v_caller_id, v_report.receiver_id;
  END IF;

  IF v_report.status = 'rejected' THEN
    RAISE EXCEPTION 'Cannot accept a rejected report';
  END IF;

  -- Deterministic report prefix for cross-client sync reconciliation
  v_report_prefix := substr(replace(target_report_id::text, '-', ''), 1, 12);

  v_cit_raw := v_report.citizen_data;
  v_records_raw := v_report.health_records;

  -- 4. Deep copy Citizens with new ownership to Receiver (User B)
  IF v_cit_raw IS NOT NULL AND v_cit_raw != 'null'::jsonb AND v_cit_raw != '{}'::jsonb THEN
    v_idx := 0;
    FOR v_cit_elem IN 
      SELECT value FROM jsonb_array_elements(
        CASE 
          WHEN jsonb_typeof(v_cit_raw) = 'array' THEN v_cit_raw
          ELSE jsonb_build_array(v_cit_raw)
        END
      )
    LOOP
      v_idx := v_idx + 1;
      v_old_cit_id := COALESCE(NULLIF(TRIM(v_cit_elem->>'id'), ''), NULLIF(TRIM(v_cit_elem->>'citizenId'), ''), 'cit_' || v_idx);
      v_id_card := COALESCE(NULLIF(TRIM(v_cit_elem->>'citizen_id'), ''), NULLIF(TRIM(v_cit_elem->>'idCard'), ''), NULLIF(TRIM(v_cit_elem->>'id_card'), ''), '');
      v_existing_cit_id := NULL;

      -- Check if receiver already has citizen with this valid National ID Card (Strict 13 numeric digits)
      IF v_id_card ~ '^[0-9]{13}$' THEN
        SELECT id INTO v_existing_cit_id
        FROM public.citizens
        WHERE user_id = v_caller_id AND citizen_id = v_id_card
        LIMIT 1;
      END IF;

      IF v_existing_cit_id IS NOT NULL THEN
        v_new_cit_id := v_existing_cit_id;
      ELSE
        -- Deterministic Citizen ID for cross-client sync reconciliation
        v_new_cit_id := 'cit-imp-' || v_report_prefix || '-' || v_old_cit_id;
        
        IF NOT EXISTS (SELECT 1 FROM public.citizens WHERE id = v_new_cit_id) THEN
          INSERT INTO public.citizens (
            id,
            user_id,
            prefix,
            first_name,
            last_name,
            citizen_id,
            gender,
            age,
            birth_date,
            phone,
            house_no,
            moo,
            village_name,
            congenital_disease,
            allergies,
            avatar_color,
            note,
            created_at,
            updated_at
          ) VALUES (
            v_new_cit_id,
            v_caller_id, -- Strictly Receiver ID (User B)
            COALESCE(NULLIF(TRIM(v_cit_elem->>'prefix'), ''), 'นาย'),
            COALESCE(NULLIF(TRIM(v_cit_elem->>'firstName'), ''), NULLIF(TRIM(v_cit_elem->>'first_name'), ''), 'ไม่ระบุชื่อ'),
            COALESCE(NULLIF(TRIM(v_cit_elem->>'lastName'), ''), NULLIF(TRIM(v_cit_elem->>'last_name'), ''), 'ไม่ระบุนามสกุล'),
            v_id_card,
            COALESCE(NULLIF(TRIM(v_cit_elem->>'gender'), ''), 'อื่นๆ'),
            COALESCE(NULLIF(TRIM(v_cit_elem->>'age'), '')::int, 0),
            CASE
              WHEN NULLIF(TRIM(v_cit_elem->>'birthDate'), '') IS NOT NULL
                THEN (v_cit_elem->>'birthDate')::date
              WHEN NULLIF(TRIM(v_cit_elem->>'birth_date'), '') IS NOT NULL
                THEN (v_cit_elem->>'birth_date')::date
              WHEN COALESCE(NULLIF(TRIM(v_cit_elem->>'age'), '')::int, 0) > 0
                THEN (CURRENT_DATE - make_interval(years => (v_cit_elem->>'age')::int))::date
              ELSE NULL
            END,
            COALESCE(NULLIF(TRIM(v_cit_elem->>'phone'), ''), ''),
            COALESCE(NULLIF(TRIM(v_cit_elem->>'houseNo'), ''), NULLIF(TRIM(v_cit_elem->>'house_no'), ''), ''),
            COALESCE(NULLIF(TRIM(v_cit_elem->>'moo'), ''), ''),
            COALESCE(NULLIF(TRIM(v_cit_elem->>'villageName'), ''), NULLIF(TRIM(v_cit_elem->>'village_name'), ''), ''),
            CASE 
              WHEN jsonb_typeof(v_cit_elem->'chronicDiseases') = 'array' THEN
                (SELECT string_agg(elem::text, ', ') FROM jsonb_array_elements_text(v_cit_elem->'chronicDiseases') AS elem)
              ELSE COALESCE(v_cit_elem->>'congenital_disease', v_cit_elem->>'congenitalDisease', NULL)
            END,
            NULLIF(TRIM(COALESCE(v_cit_elem->>'allergies', '')), ''),
            COALESCE(NULLIF(TRIM(v_cit_elem->>'avatarColor'), ''), NULLIF(TRIM(v_cit_elem->>'avatar_color'), ''), '#5D7052'),
            NULLIF(TRIM(COALESCE(v_cit_elem->>'notes', v_cit_elem->>'note', '')), ''),
            NOW(),
            NOW()
          );
          v_inserted_citizens := v_inserted_citizens + 1;
        END IF;
      END IF;

      IF v_first_new_cit_id IS NULL THEN
        v_first_new_cit_id := v_new_cit_id;
      END IF;

      -- Store mapping: oldCitizenId -> newCitizenId
      IF v_old_cit_id != '' THEN
        v_id_map := jsonb_set(v_id_map, ARRAY[v_old_cit_id], to_jsonb(v_new_cit_id));
      END IF;
    END LOOP;
  END IF;

  -- 5. Deep copy Health Records (Deterministic record ID, never compare clinical values!)
  IF v_records_raw IS NOT NULL AND jsonb_typeof(v_records_raw) = 'array' THEN
    v_idx := 0;
    FOR v_rec_elem IN SELECT * FROM jsonb_array_elements(v_records_raw)
    LOOP
      v_idx := v_idx + 1;
      v_old_rec_id := COALESCE(NULLIF(TRIM(v_rec_elem->>'id'), ''), 'rec_' || v_idx);
      v_new_rec_id := 'rec-imp-' || v_report_prefix || '-' || v_old_rec_id;

      -- Resolve mapped citizen ID
      v_target_cit_id := COALESCE(
        v_id_map->>(v_rec_elem->>'citizenId'),
        v_id_map->>(v_rec_elem->>'citizen_id'),
        v_first_new_cit_id
      );

      IF v_target_cit_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.health_records
          WHERE id = v_new_rec_id
        ) THEN
          INSERT INTO public.health_records (
            id,
            citizen_id,
            user_id,
            date,
            sys,
            dia,
            pulse,
            weight,
            height,
            bmi,
            waist,
            fbs,
            is_fasting,
            temperature,
            assessment,
            notes,
            examiner_name,
            created_at,
            updated_at
          ) VALUES (
            v_new_rec_id,
            v_target_cit_id, -- Mapped to User B's Citizen ID
            v_caller_id,     -- Strictly Receiver ID (User B)
            COALESCE(NULLIF(TRIM(v_rec_elem->>'date'), ''), to_char(now(), 'YYYY-MM-DD')),
            COALESCE(NULLIF(v_rec_elem->>'systolic', '')::numeric, NULLIF(v_rec_elem->>'sys', '')::numeric),
            COALESCE(NULLIF(v_rec_elem->>'diastolic', '')::numeric, NULLIF(v_rec_elem->>'dia', '')::numeric),
            NULLIF(v_rec_elem->>'pulse', '')::numeric,
            NULLIF(v_rec_elem->>'weight', '')::numeric,
            NULLIF(v_rec_elem->>'height', '')::numeric,
            COALESCE(
              NULLIF(v_rec_elem->>'bmi', '')::numeric,
              CASE 
                WHEN NULLIF(v_rec_elem->>'height', '')::numeric > 0 AND NULLIF(v_rec_elem->>'weight', '')::numeric > 0 
                  THEN ROUND((NULLIF(v_rec_elem->>'weight', '')::numeric) / ((NULLIF(v_rec_elem->>'height', '')::numeric / 100.0) ^ 2), 2)
                ELSE NULL
              END
            ),
            NULLIF(v_rec_elem->>'waist', '')::numeric,
            COALESCE(NULLIF(v_rec_elem->>'bloodSugar', '')::numeric, NULLIF(v_rec_elem->>'fbs', '')::numeric),
            COALESCE(NULLIF(v_rec_elem->>'bloodSugarFasting', '')::boolean, NULLIF(v_rec_elem->>'is_fasting', '')::boolean),
            NULLIF(v_rec_elem->>'temperature', '')::numeric,
            COALESCE(NULLIF(TRIM(v_rec_elem->>'assessment'), ''), NULLIF(TRIM(v_rec_elem->>'assessment_result'), '')),
            COALESCE(v_rec_elem->>'notes', v_rec_elem->>'note'),
            COALESCE(NULLIF(TRIM(v_rec_elem->>'examinerName'), ''), NULLIF(TRIM(v_rec_elem->>'examiner_name'), '')),
            NOW(),
            NOW()
          );
          v_inserted_records := v_inserted_records + 1;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 6. Atomically update shared_reports status
  UPDATE public.shared_reports
  SET status = 'accepted',
      accepted_at = COALESCE(accepted_at, NOW()),
      updated_at = NOW()
  WHERE id = target_report_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_accepted', (v_report.status = 'accepted'),
    'citizen_id', v_first_new_cit_id,
    'citizens_added', v_inserted_citizens,
    'records_added', v_inserted_records,
    'imported_citizens', v_inserted_citizens,
    'imported_records', v_inserted_records,
    'message', 'นำเข้าข้อมูลเข้าสู่บัญชีของคุณเรียบร้อยแล้ว'
  );
END;
$$;

-- 2. REJECT SHARED REPORT RPC
CREATE OR REPLACE FUNCTION public.reject_shared_report(target_report_id UUID, reason_note TEXT DEFAULT NULL)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_report RECORD;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_report
  FROM public.shared_reports
  WHERE id = target_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found with id %', target_report_id;
  END IF;

  IF v_report.receiver_id != v_caller_id THEN
    RAISE EXCEPTION 'Access denied: caller is not the receiver';
  END IF;

  IF v_report.status = 'accepted' THEN
    RAISE EXCEPTION 'Cannot reject an already accepted report';
  END IF;

  UPDATE public.shared_reports
  SET status = 'rejected',
      message = COALESCE(reason_note, message),
      rejected_at = NOW(),
      updated_at = NOW()
  WHERE id = target_report_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'ปฏิเสธรายงานเรียบร้อยแล้ว'
  );
END;
$$;

COMMIT;
