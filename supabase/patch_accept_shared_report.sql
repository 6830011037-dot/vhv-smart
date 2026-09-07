-- ==============================================================================
-- SUPABASE SQL PATCH: TRUE DATA INTEGRITY FOR accept_shared_report RPC
-- ==============================================================================
-- รายละเอียด:
--   1. ป้องกันการปลอมแปลงค่าวัดทางการแพทย์ (No Fabricated Health Data)
--   2. ไม่ใส่ค่าสมมติ 120, 80, 75, 60, 160, 22.0, 75, 100, 36.5 ใดๆ ทั้งสิ้น
--   3. รักษาค่า NULL ตามความจริงหากไม่มีการระบุข้อมูลในการตรวจ
--   4. คำนวณ BMI เฉพาะเมื่อมีส่วนสูงและน้ำหนักจริง (BMI = weight / ((height/100)^2))
--   5. วันเกิด (birth_date) แปลงตามปี คริสต์ศักราช (Gregorian AD) เท่านั้น
--   6. ปรับคอลัมน์ให้อนุญาต NULL เพื่อรองรับข้อมูลตามความเป็นจริง
--   7. รักษา Transaction (FOR UPDATE), SECURITY DEFINER, RLS, ID Mapping, User Isolation
-- ==============================================================================

-- ตรวจสอบและปลด NOT NULL constraint ของคอลัมน์ค่าวัดสุขภาพ (ถ้ามี)
ALTER TABLE IF EXISTS public.health_records 
  ALTER COLUMN sys DROP NOT NULL,
  ALTER COLUMN dia DROP NOT NULL,
  ALTER COLUMN pulse DROP NOT NULL,
  ALTER COLUMN weight DROP NOT NULL,
  ALTER COLUMN height DROP NOT NULL,
  ALTER COLUMN bmi DROP NOT NULL,
  ALTER COLUMN waist DROP NOT NULL,
  ALTER COLUMN fbs DROP NOT NULL,
  ALTER COLUMN is_fasting DROP NOT NULL,
  ALTER COLUMN temperature DROP NOT NULL,
  ALTER COLUMN assessment DROP NOT NULL,
  ALTER COLUMN examiner_name DROP NOT NULL;

ALTER TABLE IF EXISTS public.citizens
  ALTER COLUMN birth_date DROP NOT NULL;

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

  -- ตัวแปรสำหรับข้อมูล Citizens
  v_cit_prefix TEXT;
  v_cit_first_name TEXT;
  v_cit_last_name TEXT;
  v_cit_gender TEXT;
  v_cit_age INT;
  v_cit_birth_date DATE;
  v_cit_phone TEXT;
  v_cit_house_no TEXT;
  v_cit_moo TEXT;
  v_cit_village_name TEXT;
  v_cit_congenital TEXT;
  v_cit_allergies TEXT;
  v_cit_avatar_color TEXT;
  v_cit_note TEXT;

  -- ตัวแปรสำหรับข้อมูล Health Records (ไม่มีค่า Default ทางการแพทย์ปลอม)
  v_rec_date TEXT;
  v_rec_sys NUMERIC;
  v_rec_dia NUMERIC;
  v_rec_pulse NUMERIC;
  v_rec_weight NUMERIC;
  v_rec_height NUMERIC;
  v_rec_bmi NUMERIC;
  v_rec_waist NUMERIC;
  v_rec_fbs NUMERIC;
  v_rec_is_fasting BOOLEAN;
  v_rec_temperature NUMERIC;
  v_rec_assessment TEXT;
  v_rec_notes TEXT;
  v_rec_examiner TEXT;
BEGIN
  -- 1. ตรวจสอบการ Authentication
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Fetch และ Lock แถวรายงาน ป้องกัน Race Condition
  SELECT * INTO v_report
  FROM public.shared_reports
  WHERE id = target_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found with id %', target_report_id;
  END IF;

  -- 3. ตรวจสอบสิทธิ์ผู้รับ: เฉพาะ receiver_id เท่านั้นที่มีสิทธิ์กดยอมรับ
  IF v_report.receiver_id != v_caller_id THEN
    RAISE EXCEPTION 'Access denied: caller (%) is not the intended receiver (%)', v_caller_id, v_report.receiver_id;
  END IF;

  IF v_report.status = 'rejected' THEN
    RAISE EXCEPTION 'Cannot accept a rejected report';
  END IF;

  -- คีย์ระบุตัวตนเฉพาะของรายงานเพื่อสร้างรหัสที่ Deterministic สอดคล้องกับฝั่ง Client (Safe ID Reconciliation)
  v_report_prefix := substr(replace(target_report_id::text, '-', ''), 1, 12);

  v_cit_raw := v_report.citizen_data;
  v_records_raw := v_report.health_records;

  -- 4. จัดการข้อมูลประชาชนเข้าสู่บัญชีของผู้รับ (User B) อย่างปลอดภัย
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
      -- รองรับชื่อคีย์จาก JSON ทั้ง citizen_id, idCard, id_card
      v_id_card := COALESCE(NULLIF(TRIM(v_cit_elem->>'citizen_id'), ''), NULLIF(TRIM(v_cit_elem->>'idCard'), ''), NULLIF(TRIM(v_cit_elem->>'id_card'), ''), '');
      v_existing_cit_id := NULL;

      -- ตรวจสอบว่าผู้รับมีข้อมูลประชาชนที่มีเลขบัตรประชาชน (citizen_id) ที่ถูกต้อง 13 หลักเท่านั้น (Strict 13 numeric digits)
      IF v_id_card ~ '^[0-9]{13}$' THEN
        SELECT id INTO v_existing_cit_id
        FROM public.citizens
        WHERE user_id = v_caller_id AND citizen_id = v_id_card
        LIMIT 1;
      END IF;

      IF v_existing_cit_id IS NOT NULL THEN
        v_new_cit_id := v_existing_cit_id;
      ELSE
        -- สร้าง Deterministic ID ภายใต้สิทธิ์ของผู้รับ (User B) สอดคล้องกับ client-side reconciliation
        v_new_cit_id := 'cit-imp-' || v_report_prefix || '-' || v_old_cit_id;
        
        v_cit_prefix := COALESCE(NULLIF(TRIM(v_cit_elem->>'prefix'), ''), 'นาย');
        v_cit_first_name := COALESCE(NULLIF(TRIM(v_cit_elem->>'firstName'), ''), NULLIF(TRIM(v_cit_elem->>'first_name'), ''), 'ไม่ระบุชื่อ');
        v_cit_last_name := COALESCE(NULLIF(TRIM(v_cit_elem->>'lastName'), ''), NULLIF(TRIM(v_cit_elem->>'last_name'), ''), 'ไม่ระบุนามสกุล');
        v_cit_gender := COALESCE(NULLIF(TRIM(v_cit_elem->>'gender'), ''), 'อื่นๆ');
        v_cit_age := COALESCE(NULLIF(TRIM(v_cit_elem->>'age'), '')::int, 0);
        
        -- คำนวณวันเกิด: ใช้ birthDate ค.ศ. ถ้ามี หรือคำนวณย้อนหลังจาก age (Gregorian) ถ้าไม่มีให้เป็น NULL
        v_cit_birth_date := CASE
          WHEN NULLIF(TRIM(v_cit_elem->>'birthDate'), '') IS NOT NULL
            THEN (v_cit_elem->>'birthDate')::date
          WHEN NULLIF(TRIM(v_cit_elem->>'birth_date'), '') IS NOT NULL
            THEN (v_cit_elem->>'birth_date')::date
          WHEN v_cit_age > 0
            THEN (CURRENT_DATE - make_interval(years => v_cit_age))::date
          ELSE NULL
        END;

        v_cit_phone := COALESCE(NULLIF(TRIM(v_cit_elem->>'phone'), ''), '');
        v_cit_house_no := COALESCE(NULLIF(TRIM(v_cit_elem->>'houseNo'), ''), NULLIF(TRIM(v_cit_elem->>'house_no'), ''), '');
        v_cit_moo := COALESCE(NULLIF(TRIM(v_cit_elem->>'moo'), ''), '');
        v_cit_village_name := COALESCE(NULLIF(TRIM(v_cit_elem->>'villageName'), ''), NULLIF(TRIM(v_cit_elem->>'village_name'), ''), '');
        
        v_cit_congenital := CASE 
          WHEN jsonb_typeof(v_cit_elem->'chronicDiseases') = 'array' THEN
            (SELECT string_agg(elem::text, ', ') FROM jsonb_array_elements_text(v_cit_elem->'chronicDiseases') AS elem)
          ELSE COALESCE(v_cit_elem->>'congenital_disease', v_cit_elem->>'congenitalDisease', NULL)
        END;
        
        v_cit_allergies := NULLIF(TRIM(COALESCE(v_cit_elem->>'allergies', '')), '');
        v_cit_avatar_color := COALESCE(NULLIF(TRIM(v_cit_elem->>'avatarColor'), ''), NULLIF(TRIM(v_cit_elem->>'avatar_color'), ''), '#5D7052');
        v_cit_note := NULLIF(TRIM(COALESCE(v_cit_elem->>'notes', v_cit_elem->>'note', '')), '');

        -- นำเข้าอย่างปลอดภัย Idempotent insert: ตรวจสอบ id เพื่อป้องกันการเพิ่มซ้ำ
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
            v_caller_id,
            v_cit_prefix,
            v_cit_first_name,
            v_cit_last_name,
            v_id_card,
            v_cit_gender,
            v_cit_age,
            v_cit_birth_date,
            v_cit_phone,
            v_cit_house_no,
            v_cit_moo,
            v_cit_village_name,
            v_cit_congenital,
            v_cit_allergies,
            v_cit_avatar_color,
            v_cit_note,
            NOW(),
            NOW()
          );
          v_inserted_citizens := v_inserted_citizens + 1;
        END IF;
      END IF;

      IF v_first_new_cit_id IS NULL THEN
        v_first_new_cit_id := v_new_cit_id;
      END IF;

      -- แมป oldCitizenId -> newCitizenId เพื่อเชื่อมผลตรวจสุขภาพ
      IF v_old_cit_id != '' THEN
        v_id_map := jsonb_set(v_id_map, ARRAY[v_old_cit_id], to_jsonb(v_new_cit_id));
      END IF;
    END LOOP;
  END IF;

  -- 5. จัดการผลตรวจสุขภาพ (ใช้ Deterministic Record ID ป้องกันการ Duplicate และไม่ใช้ค่าวัดทางคลินิกเป็น Key)
  IF v_records_raw IS NOT NULL AND jsonb_typeof(v_records_raw) = 'array' THEN
    v_idx := 0;
    FOR v_rec_elem IN SELECT * FROM jsonb_array_elements(v_records_raw)
    LOOP
      v_idx := v_idx + 1;
      v_old_rec_id := COALESCE(NULLIF(TRIM(v_rec_elem->>'id'), ''), 'rec_' || v_idx);
      
      -- Deterministic record ID สอดคล้องระหว่าง Client และ Database RPC
      v_new_rec_id := 'rec-imp-' || v_report_prefix || '-' || v_old_rec_id;

      -- ค้นหา Citizen ID ที่แมปไว้
      v_target_cit_id := COALESCE(
        v_id_map->>(v_rec_elem->>'citizenId'),
        v_id_map->>(v_rec_elem->>'citizen_id'),
        v_first_new_cit_id
      );

      IF v_target_cit_id IS NOT NULL THEN
        -- ดึงค่าวัดจริง ไม่มีการปลอมแปลงค่า (No Fabricated Health Data)
        v_rec_date := COALESCE(NULLIF(TRIM(v_rec_elem->>'date'), ''), to_char(now(), 'YYYY-MM-DD'));
        v_rec_sys := COALESCE(NULLIF(v_rec_elem->>'systolic', '')::numeric, NULLIF(v_rec_elem->>'sys', '')::numeric);
        v_rec_dia := COALESCE(NULLIF(v_rec_elem->>'diastolic', '')::numeric, NULLIF(v_rec_elem->>'dia', '')::numeric);
        v_rec_pulse := NULLIF(v_rec_elem->>'pulse', '')::numeric;
        v_rec_weight := NULLIF(v_rec_elem->>'weight', '')::numeric;
        v_rec_height := NULLIF(v_rec_elem->>'height', '')::numeric;
        
        -- คำนวณ BMI: ถ้าไม่มี bmi ตรงๆ ให้คำนวณจาก weight / ((height/100)^2) หากมีข้อมูลจริง ถ้าไม่มีให้คง NULL
        v_rec_bmi := COALESCE(
          NULLIF(v_rec_elem->>'bmi', '')::numeric,
          CASE 
            WHEN v_rec_height > 0 AND v_rec_weight > 0 
              THEN ROUND(v_rec_weight / ((v_rec_height / 100.0) ^ 2), 2)
            ELSE NULL
          END
        );

        v_rec_waist := NULLIF(v_rec_elem->>'waist', '')::numeric;
        v_rec_fbs := COALESCE(NULLIF(v_rec_elem->>'bloodSugar', '')::numeric, NULLIF(v_rec_elem->>'fbs', '')::numeric);
        v_rec_is_fasting := COALESCE(NULLIF(v_rec_elem->>'bloodSugarFasting', '')::boolean, NULLIF(v_rec_elem->>'is_fasting', '')::boolean);
        v_rec_temperature := NULLIF(v_rec_elem->>'temperature', '')::numeric;
        v_rec_assessment := COALESCE(NULLIF(TRIM(v_rec_elem->>'assessment'), ''), NULLIF(TRIM(v_rec_elem->>'assessment_result'), ''));
        v_rec_notes := COALESCE(v_rec_elem->>'notes', v_rec_elem->>'note');
        v_rec_examiner := COALESCE(NULLIF(TRIM(v_rec_elem->>'examinerName'), ''), NULLIF(TRIM(v_rec_elem->>'examiner_name'), ''));

        -- CRITICAL SAFETY RULE: ตรวจสอบความซ้ำซ้อนจาก Record ID เท่านั้น ไม่ใช้ (citizen_id, date, sys, dia) เด็ดขาด
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
            v_target_cit_id, -- กำหนดให้อยู่ภายใต้ Citizen ID ของผู้รับ (User B)
            v_caller_id,     -- กำหนด user_id เป็นของผู้รับ (User B)
            v_rec_date,
            v_rec_sys,
            v_rec_dia,
            v_rec_pulse,
            v_rec_weight,
            v_rec_height,
            v_rec_bmi,
            v_rec_waist,
            v_rec_fbs,
            v_rec_is_fasting,
            v_rec_temperature,
            v_rec_assessment,
            v_rec_notes,
            v_rec_examiner,
            NOW(),
            NOW()
          );
          v_inserted_records := v_inserted_records + 1;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 6. อัปเดตสถานะของ shared_reports เป็น accepted อย่างปลอดภัย
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
