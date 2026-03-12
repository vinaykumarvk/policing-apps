-- Migration 059: Idempotent data backfill
-- Extracts existing JSONB arrays into normalized entity + link tables
-- Safe to re-run — uses ON CONFLICT DO NOTHING throughout

-- ─── 1. Backfill phone_number + subject_phone_link from mobile_numbers JSONB ──
INSERT INTO phone_number (raw_value, normalized_value, phone_type)
SELECT DISTINCT
  elem::text,
  REGEXP_REPLACE(REGEXP_REPLACE(elem::text, '[\s\-()"]', '', 'g'), '^\+?91', ''),
  'MOBILE'
FROM subject_profile sp,
     jsonb_array_elements_text(CASE WHEN jsonb_typeof(sp.mobile_numbers) = 'array' THEN sp.mobile_numbers ELSE '[]'::jsonb END) AS elem
WHERE sp.is_merged = FALSE
  AND elem::text != ''
  AND LENGTH(REGEXP_REPLACE(REGEXP_REPLACE(elem::text, '[\s\-()"]', '', 'g'), '^\+?91', '')) >= 10
ON CONFLICT (normalized_value) DO NOTHING;

INSERT INTO subject_phone_link (subject_id, phone_id, relationship, source_system)
SELECT DISTINCT
  sp.subject_id,
  pn.phone_id,
  'OWNER',
  COALESCE(sp.source_system, 'MANUAL')
FROM subject_profile sp,
     jsonb_array_elements_text(CASE WHEN jsonb_typeof(sp.mobile_numbers) = 'array' THEN sp.mobile_numbers ELSE '[]'::jsonb END) AS elem
JOIN phone_number pn ON pn.normalized_value = REGEXP_REPLACE(REGEXP_REPLACE(elem::text, '[\s\-()"]', '', 'g'), '^\+?91', '')
WHERE sp.is_merged = FALSE
  AND elem::text != ''
ON CONFLICT (subject_id, phone_id, relationship) DO NOTHING;

-- ─── 2. Backfill identity_document from subject_profile columns ────────────────

-- Aadhaar
INSERT INTO identity_document (document_type, document_value, normalized_value)
SELECT DISTINCT 'AADHAAR', sp.aadhaar_hash, REGEXP_REPLACE(sp.aadhaar_hash, '[\s\-]', '', 'g')
FROM subject_profile sp
WHERE sp.is_merged = FALSE AND sp.aadhaar_hash IS NOT NULL AND sp.aadhaar_hash != ''
ON CONFLICT (document_type, normalized_value) DO NOTHING;

INSERT INTO subject_identity_link (subject_id, document_pk, source_system)
SELECT sp.subject_id, id.document_pk, COALESCE(sp.source_system, 'MANUAL')
FROM subject_profile sp
JOIN identity_document id ON id.document_type = 'AADHAAR'
  AND id.normalized_value = REGEXP_REPLACE(sp.aadhaar_hash, '[\s\-]', '', 'g')
WHERE sp.is_merged = FALSE AND sp.aadhaar_hash IS NOT NULL AND sp.aadhaar_hash != ''
ON CONFLICT (subject_id, document_pk) DO NOTHING;

-- PAN
INSERT INTO identity_document (document_type, document_value, normalized_value)
SELECT DISTINCT 'PAN', sp.pan_number, UPPER(REPLACE(sp.pan_number, ' ', ''))
FROM subject_profile sp
WHERE sp.is_merged = FALSE AND sp.pan_number IS NOT NULL AND sp.pan_number != ''
ON CONFLICT (document_type, normalized_value) DO NOTHING;

INSERT INTO subject_identity_link (subject_id, document_pk, source_system)
SELECT sp.subject_id, id.document_pk, COALESCE(sp.source_system, 'MANUAL')
FROM subject_profile sp
JOIN identity_document id ON id.document_type = 'PAN'
  AND id.normalized_value = UPPER(REPLACE(sp.pan_number, ' ', ''))
WHERE sp.is_merged = FALSE AND sp.pan_number IS NOT NULL AND sp.pan_number != ''
ON CONFLICT (subject_id, document_pk) DO NOTHING;

-- Passport
INSERT INTO identity_document (document_type, document_value, normalized_value)
SELECT DISTINCT 'PASSPORT', sp.passport_number, UPPER(REPLACE(sp.passport_number, ' ', ''))
FROM subject_profile sp
WHERE sp.is_merged = FALSE AND sp.passport_number IS NOT NULL AND sp.passport_number != ''
ON CONFLICT (document_type, normalized_value) DO NOTHING;

INSERT INTO subject_identity_link (subject_id, document_pk, source_system)
SELECT sp.subject_id, id.document_pk, COALESCE(sp.source_system, 'MANUAL')
FROM subject_profile sp
JOIN identity_document id ON id.document_type = 'PASSPORT'
  AND id.normalized_value = UPPER(REPLACE(sp.passport_number, ' ', ''))
WHERE sp.is_merged = FALSE AND sp.passport_number IS NOT NULL AND sp.passport_number != ''
ON CONFLICT (subject_id, document_pk) DO NOTHING;

-- Driving License
INSERT INTO identity_document (document_type, document_value, normalized_value)
SELECT DISTINCT 'DRIVING_LICENSE', sp.driving_license, UPPER(REGEXP_REPLACE(sp.driving_license, '[\s\-]', '', 'g'))
FROM subject_profile sp
WHERE sp.is_merged = FALSE AND sp.driving_license IS NOT NULL AND sp.driving_license != ''
ON CONFLICT (document_type, normalized_value) DO NOTHING;

INSERT INTO subject_identity_link (subject_id, document_pk, source_system)
SELECT sp.subject_id, id.document_pk, COALESCE(sp.source_system, 'MANUAL')
FROM subject_profile sp
JOIN identity_document id ON id.document_type = 'DRIVING_LICENSE'
  AND id.normalized_value = UPPER(REGEXP_REPLACE(sp.driving_license, '[\s\-]', '', 'g'))
WHERE sp.is_merged = FALSE AND sp.driving_license IS NOT NULL AND sp.driving_license != ''
ON CONFLICT (subject_id, document_pk) DO NOTHING;

-- Voter ID
INSERT INTO identity_document (document_type, document_value, normalized_value)
SELECT DISTINCT 'VOTER_ID', sp.voter_id, UPPER(REPLACE(sp.voter_id, ' ', ''))
FROM subject_profile sp
WHERE sp.is_merged = FALSE AND sp.voter_id IS NOT NULL AND sp.voter_id != ''
ON CONFLICT (document_type, normalized_value) DO NOTHING;

INSERT INTO subject_identity_link (subject_id, document_pk, source_system)
SELECT sp.subject_id, id.document_pk, COALESCE(sp.source_system, 'MANUAL')
FROM subject_profile sp
JOIN identity_document id ON id.document_type = 'VOTER_ID'
  AND id.normalized_value = UPPER(REPLACE(sp.voter_id, ' ', ''))
WHERE sp.is_merged = FALSE AND sp.voter_id IS NOT NULL AND sp.voter_id != ''
ON CONFLICT (subject_id, document_pk) DO NOTHING;

-- ─── 3. Backfill social_account + subject_social_link from social_handles ──────
INSERT INTO social_account (platform, handle, normalized_handle)
SELECT DISTINCT
  COALESCE(elem->>'platform', 'unknown'),
  COALESCE(elem->>'handle', elem->>'username', ''),
  LOWER(REPLACE(COALESCE(elem->>'handle', elem->>'username', ''), '@', ''))
FROM subject_profile sp,
     jsonb_array_elements(CASE WHEN jsonb_typeof(sp.social_handles) = 'array' THEN sp.social_handles ELSE '[]'::jsonb END) AS elem
WHERE sp.is_merged = FALSE
  AND COALESCE(elem->>'handle', elem->>'username', '') != ''
ON CONFLICT (platform, normalized_handle) DO NOTHING;

INSERT INTO subject_social_link (subject_id, social_id, relationship, source_system)
SELECT DISTINCT
  sp.subject_id,
  sa.social_id,
  'OWNER',
  COALESCE(sp.source_system, 'MANUAL')
FROM subject_profile sp,
     jsonb_array_elements(CASE WHEN jsonb_typeof(sp.social_handles) = 'array' THEN sp.social_handles ELSE '[]'::jsonb END) AS elem
JOIN social_account sa ON sa.platform = COALESCE(elem->>'platform', 'unknown')
  AND sa.normalized_handle = LOWER(REPLACE(COALESCE(elem->>'handle', elem->>'username', ''), '@', ''))
WHERE sp.is_merged = FALSE
  AND COALESCE(elem->>'handle', elem->>'username', '') != ''
ON CONFLICT (subject_id, social_id, relationship) DO NOTHING;

-- ─── 4. Backfill device from cdr_record IMEI (if table exists) ────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cdr_record') THEN
    EXECUTE '
      INSERT INTO device (imei, normalized_imei)
      SELECT DISTINCT imei, SUBSTRING(REGEXP_REPLACE(imei, ''\D'', '''', ''g'') FROM 1 FOR 15)
      FROM cdr_record
      WHERE imei IS NOT NULL AND imei != ''''
        AND LENGTH(REGEXP_REPLACE(imei, ''\D'', '''', ''g'')) >= 15
      ON CONFLICT (normalized_imei) DO NOTHING
    ';
  END IF;
END $$;

-- ─── 5. Project backfilled entities into network_node/network_edge ─────────────
-- Subject nodes
INSERT INTO network_node (node_type, entity_id, label, properties)
SELECT 'SUBJECT', sp.subject_id, sp.full_name,
  jsonb_build_object('threat_level', sp.threat_level, 'monitoring_status', sp.monitoring_status)
FROM subject_profile sp
WHERE sp.is_merged = FALSE
ON CONFLICT (node_type, entity_id) DO NOTHING;

-- Phone nodes
INSERT INTO network_node (node_type, entity_id, label)
SELECT 'PHONE', pn.phone_id, pn.normalized_value
FROM phone_number pn
ON CONFLICT (node_type, entity_id) DO NOTHING;

-- Phone edges
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence)
SELECT nn_s.node_id, nn_p.node_id, 'HAS_PHONE', spl.confidence
FROM subject_phone_link spl
JOIN network_node nn_s ON nn_s.node_type = 'SUBJECT' AND nn_s.entity_id = spl.subject_id
JOIN network_node nn_p ON nn_p.node_type = 'PHONE' AND nn_p.entity_id = spl.phone_id
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Identity doc nodes
INSERT INTO network_node (node_type, entity_id, label, properties)
SELECT 'IDENTITY_DOC', id.document_pk, id.document_type || ':' || id.normalized_value,
  jsonb_build_object('document_type', id.document_type)
FROM identity_document id
ON CONFLICT (node_type, entity_id) DO NOTHING;

-- Identity edges
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence)
SELECT nn_s.node_id, nn_i.node_id, 'HAS_IDENTITY', sil.confidence
FROM subject_identity_link sil
JOIN network_node nn_s ON nn_s.node_type = 'SUBJECT' AND nn_s.entity_id = sil.subject_id
JOIN network_node nn_i ON nn_i.node_type = 'IDENTITY_DOC' AND nn_i.entity_id = sil.document_pk
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Social account nodes
INSERT INTO network_node (node_type, entity_id, label, properties)
SELECT 'SOCIAL_ACCOUNT', sa.social_id, sa.platform || ':' || sa.normalized_handle,
  jsonb_build_object('platform', sa.platform)
FROM social_account sa
ON CONFLICT (node_type, entity_id) DO NOTHING;

-- Social edges
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence)
SELECT nn_s.node_id, nn_sc.node_id, 'HAS_SOCIAL', socl.confidence
FROM subject_social_link socl
JOIN network_node nn_s ON nn_s.node_type = 'SUBJECT' AND nn_s.entity_id = socl.subject_id
JOIN network_node nn_sc ON nn_sc.node_type = 'SOCIAL_ACCOUNT' AND nn_sc.entity_id = socl.social_id
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;
