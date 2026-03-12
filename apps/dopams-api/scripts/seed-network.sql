-- seed-network.sql — Populate subject relationships, family, and phone data
-- for the criminal network graph (FR-11).
--
-- Prerequisites:
--   - 20 subjects already seeded in subject_profile
--   - Tables: subject_subject_link, subject_family_member, phone_number, subject_phone_link
--
-- After running this script, call POST /api/v1/graph/rebuild to project into
-- network_node/network_edge.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Subject-Subject Links  (3 clusters + cross-cluster)
--    CHECK constraint: subject_id_a < subject_id_b → use LEAST/GREATEST
--    Allowed relationships: ASSOCIATE, FAMILY, GANG, CO_ACCUSED, SUPPLIER, BUYER, UNKNOWN
-- ═══════════════════════════════════════════════════════════════════════════════

-- Helper: insert a directional link using LEAST/GREATEST to satisfy CHECK
-- Usage: SELECT link_subjects('Name A', 'Name B', 'RELATIONSHIP', strength);

CREATE OR REPLACE FUNCTION pg_temp.link_subjects(
  name_a TEXT, name_b TEXT, rel TEXT, str NUMERIC DEFAULT 50
) RETURNS VOID AS $$
DECLARE
  id_a UUID; id_b UUID;
BEGIN
  SELECT subject_id INTO id_a FROM subject_profile WHERE full_name = name_a AND is_merged = FALSE LIMIT 1;
  SELECT subject_id INTO id_b FROM subject_profile WHERE full_name = name_b AND is_merged = FALSE LIMIT 1;
  IF id_a IS NULL OR id_b IS NULL THEN
    RAISE NOTICE 'Skipping link: % ↔ % (subject not found)', name_a, name_b;
    RETURN;
  END IF;
  INSERT INTO subject_subject_link (subject_id_a, subject_id_b, relationship, strength, evidence_count, source_system)
  VALUES (LEAST(id_a, id_b), GREATEST(id_a, id_b), rel, str, 1, 'SEED')
  ON CONFLICT (subject_id_a, subject_id_b, relationship) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ── Cluster 1: Amritsar Supply Chain ────────────────────────────────────────
SELECT pg_temp.link_subjects('Mohammed Irfan', 'Rajesh Kumar Singh', 'SUPPLIER', 90);
SELECT pg_temp.link_subjects('Mohammed Irfan', 'Pradeep Sharma',     'ASSOCIATE', 80);
SELECT pg_temp.link_subjects('Mohammed Irfan', 'Ranjit Singh Mann',  'ASSOCIATE', 85);
SELECT pg_temp.link_subjects('Rajesh Kumar Singh',  'Gurpreet Singh Sidhu','ASSOCIATE', 75);
SELECT pg_temp.link_subjects('Pradeep Sharma',      'Deepak Verma',        'BUYER',     70);
SELECT pg_temp.link_subjects('Ranjit Singh Mann',   'Sanjay Patel',        'CO_ACCUSED',65);

-- ── Cluster 2: Border / Fazilka ─────────────────────────────────────────────
SELECT pg_temp.link_subjects('Balwinder Singh', 'Paramjit Singh Brar','GANG',      90);
SELECT pg_temp.link_subjects('Balwinder Singh', 'Mohinder Pal',       'ASSOCIATE', 80);
SELECT pg_temp.link_subjects('Balwinder Singh', 'Anil Kumar Yadav',   'SUPPLIER',  85);
SELECT pg_temp.link_subjects('Paramjit Singh Brar',  'Ajay Thakur',        'GANG',      70);
SELECT pg_temp.link_subjects('Mohinder Pal',         'Vikram Chauhan',     'ASSOCIATE', 60);

-- ── Cross-cluster links (enable multi-hop paths) ─────────────────────────────
SELECT pg_temp.link_subjects('Rajesh Kumar Singh',  'Balwinder Singh','CO_ACCUSED', 75);
SELECT pg_temp.link_subjects('Sanjay Patel',        'Mohinder Pal',        'ASSOCIATE',  55);
SELECT pg_temp.link_subjects('Pradeep Sharma',      'Vikram Chauhan',      'ASSOCIATE',  50);

-- ── Peripheral / low-confidence links ────────────────────────────────────────
SELECT pg_temp.link_subjects('Mohammed Irfan', 'Harpreet Kaur Dhillon','UNKNOWN',   40);
SELECT pg_temp.link_subjects('Balwinder Singh','Neha Gupta',           'UNKNOWN',   35);
SELECT pg_temp.link_subjects('Ranjit Singh Mann',   'Lakshmi Narayan',      'ASSOCIATE', 45);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Family Members (via subject_family_member with relative_subject_id)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pg_temp.link_family(
  subject_name TEXT, relative_name TEXT, rel_type TEXT
) RETURNS VOID AS $$
DECLARE
  sid UUID; rid UUID;
BEGIN
  SELECT subject_id INTO sid FROM subject_profile WHERE full_name = subject_name AND is_merged = FALSE LIMIT 1;
  SELECT subject_id INTO rid FROM subject_profile WHERE full_name = relative_name AND is_merged = FALSE LIMIT 1;
  IF sid IS NULL THEN
    RAISE NOTICE 'Skipping family: subject % not found', subject_name;
    RETURN;
  END IF;
  INSERT INTO subject_family_member (subject_id, relative_subject_id, relationship_type, full_name)
  VALUES (sid, rid, rel_type, relative_name)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

SELECT pg_temp.link_family('Rajesh Kumar Singh',   'Parminder Kaur',       'SPOUSE');
SELECT pg_temp.link_family('Pradeep Sharma',       'Sunita Devi',          'SISTER');
SELECT pg_temp.link_family('Balwinder Singh', 'Kamaljeet Kaur',       'SPOUSE');
SELECT pg_temp.link_family('Gurpreet Singh Sidhu', 'Sukhwinder Kaur',      'SISTER');


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Phone numbers — extract from JSONB mobile_numbers, seed phone_number +
--    subject_phone_link. Include 2 shared-phone scenarios.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Extract each subject's mobile_numbers JSONB array into normalized phone records
INSERT INTO phone_number (raw_value, normalized_value, phone_type)
SELECT DISTINCT
  elem::TEXT,
  REGEXP_REPLACE(REGEXP_REPLACE(elem::TEXT, '[^0-9]', '', 'g'), '^91', ''),
  'MOBILE'
FROM subject_profile sp,
     LATERAL jsonb_array_elements_text(
       CASE jsonb_typeof(sp.mobile_numbers)
         WHEN 'array' THEN sp.mobile_numbers
         ELSE '[]'::jsonb
       END
     ) AS elem
WHERE sp.is_merged = FALSE
  AND elem::TEXT ~ '[0-9]'
ON CONFLICT (normalized_value) DO NOTHING;

-- Link each subject to their own phones
INSERT INTO subject_phone_link (subject_id, phone_id, relationship, confidence, source_system)
SELECT DISTINCT sp.subject_id, pn.phone_id, 'OWNER', 95, 'SEED'
FROM subject_profile sp,
     LATERAL jsonb_array_elements_text(
       CASE jsonb_typeof(sp.mobile_numbers)
         WHEN 'array' THEN sp.mobile_numbers
         ELSE '[]'::jsonb
       END
     ) AS elem
JOIN phone_number pn ON pn.normalized_value = REGEXP_REPLACE(REGEXP_REPLACE(elem::TEXT, '[^0-9]', '', 'g'), '^91', '')
WHERE sp.is_merged = FALSE
ON CONFLICT (subject_id, phone_id, relationship) DO NOTHING;

-- ── Shared phone scenario 1: Irfan + Rajesh share a burner phone ─────────────
INSERT INTO phone_number (raw_value, normalized_value, phone_type)
VALUES ('9876500001', '9876500001', 'MOBILE')
ON CONFLICT (normalized_value) DO NOTHING;

INSERT INTO subject_phone_link (subject_id, phone_id, relationship, confidence, source_system)
SELECT sp.subject_id, pn.phone_id, 'USER', 70, 'CDR_ANALYSIS'
FROM subject_profile sp, phone_number pn
WHERE sp.full_name IN ('Mohammed Irfan', 'Rajesh Kumar Singh')
  AND sp.is_merged = FALSE
  AND pn.normalized_value = '9876500001'
ON CONFLICT (subject_id, phone_id, relationship) DO NOTHING;

-- ── Shared phone scenario 2: Balwinder + Paramjit share a phone ──────────────
INSERT INTO phone_number (raw_value, normalized_value, phone_type)
VALUES ('9876500002', '9876500002', 'MOBILE')
ON CONFLICT (normalized_value) DO NOTHING;

INSERT INTO subject_phone_link (subject_id, phone_id, relationship, confidence, source_system)
SELECT sp.subject_id, pn.phone_id, 'USER', 65, 'CDR_ANALYSIS'
FROM subject_profile sp, phone_number pn
WHERE sp.full_name IN ('Balwinder Singh', 'Paramjit Singh Brar')
  AND sp.is_merged = FALSE
  AND pn.normalized_value = '9876500002'
ON CONFLICT (subject_id, phone_id, relationship) DO NOTHING;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- After running this script:
--   POST /api/v1/graph/rebuild   (as ADMINISTRATOR)
-- to project all subjects into network_node/network_edge for the graph UI.
-- ═══════════════════════════════════════════════════════════════════════════════
