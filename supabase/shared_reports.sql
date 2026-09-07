-- ==============================================================================
-- PRODUCTION-READY MIGRATION: SHARED REPORTS & CROSS-USER TRANSFER
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CREATE TABLE public.shared_reports
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 2. CREATE PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_shared_reports_sender_id ON public.shared_reports (sender_id);
CREATE INDEX IF NOT EXISTS idx_shared_reports_receiver_id ON public.shared_reports (receiver_id);
CREATE INDEX IF NOT EXISTS idx_shared_reports_status ON public.shared_reports (status);
CREATE INDEX IF NOT EXISTS idx_shared_reports_created_at ON public.shared_reports (created_at DESC);

-- ------------------------------------------------------------------------------
-- 3. ENABLE ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.shared_reports ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 4. RLS POLICIES (EXPLICIT & SECURE)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "shared_reports_select" ON public.shared_reports;
DROP POLICY IF EXISTS "shared_reports_insert" ON public.shared_reports;
DROP POLICY IF EXISTS "shared_reports_update" ON public.shared_reports;
DROP POLICY IF EXISTS "shared_reports_delete" ON public.shared_reports;

-- SELECT: Only sender or intended receiver can view the report
CREATE POLICY "shared_reports_select"
ON public.shared_reports
FOR SELECT
TO authenticated
USING (
  auth.uid() = sender_id 
  OR 
  auth.uid() = receiver_id
);

-- INSERT: Only sender can create report for themselves
CREATE POLICY "shared_reports_insert"
ON public.shared_reports
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
);

-- UPDATE:
-- - Sender can update pending reports
-- - Receiver can update status (accept/reject)
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

-- DELETE:
-- - Sender can delete pending reports
-- - Receiver can delete processed reports
CREATE POLICY "shared_reports_delete"
ON public.shared_reports
FOR DELETE
TO authenticated
USING (
  (auth.uid() = sender_id AND status = 'pending')
  OR 
  (auth.uid() = receiver_id AND status IN ('accepted', 'rejected', 'cancelled'))
);

-- ------------------------------------------------------------------------------
-- 5. SECURE LOOKUP FUNCTIONS (No sensitive credential leaks)
-- ------------------------------------------------------------------------------

-- Lookup receiver by phone
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

-- Lookup receiver by email
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

-- ------------------------------------------------------------------------------
-- 6. TRANSACTIONAL ACCEPT RPC (Deterministic ID Reconciliation & Duplicate Prevention)
-- ------------------------------------------------------------------------------
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
  -- 1. Validate caller authentication
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Fetch and lock report for transaction isolation (prevents race conditions)
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

  -- Report prefix for deterministic client-reconcilable IDs
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
      v_id_card := COALESCE(NULLIF(TRIM(v_cit_elem->>'idCard'), ''), NULLIF(TRIM(v_cit_elem->>'citizen_id'), ''), NULLIF(TRIM(v_cit_elem->>'id_card'), ''), '');
      v_existing_cit_id := NULL;

      -- Check if receiver already has citizen with this National ID Card (Strict 13 numeric digits)
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

-- ------------------------------------------------------------------------------
-- 7. REJECT REPORT RPC
-- ------------------------------------------------------------------------------
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
