-- Seed: Comprehensive Network Graph Data
-- Populates network_node and network_edge tables for the Subject Network visualization.
-- Uses actual entity IDs from the seeded database.
-- Run against the dopams database.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 1: PHONE nodes (16 phones)
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO network_node (node_type, entity_id, label, properties) VALUES
  ('PHONE', 'e1f7b899-4230-4cc8-9ff1-919522028126', '+91 98140-11111', '{"phone_type":"MOBILE","carrier":"Airtel"}'::jsonb),
  ('PHONE', 'd8a1258d-98b2-4239-b819-d73723383d1b', '+91 98140-11112', '{"phone_type":"MOBILE","carrier":"Jio"}'::jsonb),
  ('PHONE', '70880080-862e-4063-b48b-d3f1e479bc80', '+91 94170-22222', '{"phone_type":"MOBILE","carrier":"Airtel"}'::jsonb),
  ('PHONE', '576a5dc2-4d43-4c01-85c4-8854aa2499c3', '+91 94170-22223', '{"phone_type":"MOBILE","carrier":"Jio"}'::jsonb),
  ('PHONE', 'f867088f-b277-48ff-b495-f8b5659ff506', '+91 98140-33333', '{"phone_type":"MOBILE","carrier":"Airtel"}'::jsonb),
  ('PHONE', '3c637607-f668-418e-b012-8d3a5f157fa8', '+91 98140-44444', '{"phone_type":"MOBILE","carrier":"Jio"}'::jsonb),
  ('PHONE', 'bfece5ac-2e8e-4325-b1d5-9786991f2c04', '+91 98150-55555', '{"phone_type":"MOBILE","carrier":"Airtel"}'::jsonb),
  ('PHONE', '803dba3e-5077-43e0-9c7b-4be2e52eb03a', '+91 98760-66666', '{"phone_type":"MOBILE","carrier":"Jio"}'::jsonb),
  ('PHONE', 'a3be6486-8603-4e44-a7c0-b95168be8e18', '+91 94170-77777', '{"phone_type":"MOBILE","carrier":"Airtel"}'::jsonb),
  ('PHONE', 'e00c0b86-cc4a-443a-a608-80ed51de8cc2', '+91 98140-88888', '{"phone_type":"MOBILE","carrier":"Jio"}'::jsonb),
  ('PHONE', '1f66c18e-d1ca-4734-bc47-ea956f0212c3', '+91 98760-12345', '{"phone_type":"MOBILE","carrier":"Airtel"}'::jsonb),
  ('PHONE', '92aa35fa-0abf-4485-ac46-813ab670bb99', '+91 98150-67890', '{"phone_type":"MOBILE","carrier":"Jio"}'::jsonb),
  ('PHONE', '818ee105-ed63-4487-910f-aea965f11da0', '+91 98140-13579', '{"phone_type":"MOBILE","carrier":"Airtel"}'::jsonb),
  ('PHONE', 'a376bcd0-4bc4-4653-8658-1448974ccf41', '+91 98140-99999', '{"phone_type":"MOBILE","carrier":"Jio"}'::jsonb),
  ('PHONE', 'bdbe19cd-1691-4811-b2a6-5d0dd889a248', '9876543210', '{"phone_type":"MOBILE","carrier":"Airtel"}'::jsonb),
  ('PHONE', '70263c29-933f-4140-acec-84674f0af802', '+91 98765-43210', '{"phone_type":"MOBILE","carrier":"Jio"}'::jsonb)
ON CONFLICT (node_type, entity_id) DO UPDATE SET label = EXCLUDED.label, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 2: DEVICE nodes (7 devices)
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO network_node (node_type, entity_id, label, properties) VALUES
  ('DEVICE', '57a0851d-9c51-4f9f-8749-5e0065328ff7', 'Samsung Galaxy S22', '{"device_type":"SMARTPHONE"}'::jsonb),
  ('DEVICE', 'a3da43f8-fc12-42c5-bfe9-7ae45d50d0b4', 'iPhone 13', '{"device_type":"SMARTPHONE"}'::jsonb),
  ('DEVICE', 'c8d90f8c-aa28-4fce-a30a-1e39e591deb7', 'Redmi Note 12', '{"device_type":"SMARTPHONE"}'::jsonb),
  ('DEVICE', 'fd3cad01-cfcd-46b5-a8e9-3a5d2b7fae7f', 'Realme C55', '{"device_type":"SMARTPHONE"}'::jsonb),
  ('DEVICE', 'a460745f-4336-456e-901c-31fca27079d8', 'Samsung Galaxy A14', '{"device_type":"SMARTPHONE"}'::jsonb),
  ('DEVICE', 'a992db30-4692-47fb-99e8-1dfd2fbe2023', 'iPhone 14 Pro', '{"device_type":"SMARTPHONE"}'::jsonb),
  ('DEVICE', 'e13bcb31-4ffc-4222-9d12-42b19c83dddf', 'Vivo Y56', '{"device_type":"SMARTPHONE"}'::jsonb)
ON CONFLICT (node_type, entity_id) DO UPDATE SET label = EXCLUDED.label, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 3: VEHICLE nodes (9 vehicles)
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO network_node (node_type, entity_id, label, properties) VALUES
  ('VEHICLE', 'a1d8f95c-38a3-426e-875b-164c63f60e14', 'PB-04-AX-1234 (Toyota)', '{"make":"Toyota","vehicle_type":"SUV"}'::jsonb),
  ('VEHICLE', '8c7523c3-2d7e-44e0-a08b-10fc1c849af1', 'PB-07-BQ-5678 (Mahindra)', '{"make":"Mahindra","vehicle_type":"SUV"}'::jsonb),
  ('VEHICLE', '27403a79-47b4-4eb8-be79-5c4b34051c84', 'PB-07-CK-9012 (Tractor)', '{"make":"Massey Ferguson","vehicle_type":"TRACTOR"}'::jsonb),
  ('VEHICLE', '5f8835b3-dbae-4ea1-aab6-c33cbec6c815', 'PB-04-BN-5678 (Maruti)', '{"make":"Maruti","vehicle_type":"CAR"}'::jsonb),
  ('VEHICLE', '514ae045-154b-44e6-b596-2a6daf7817a8', 'PB-08-DM-3456 (Honda)', '{"make":"Honda","vehicle_type":"MOTORCYCLE"}'::jsonb),
  ('VEHICLE', '11a9ae36-0e7e-4f71-88bc-b0852409cc25', 'PB-13-EN-7890 (Hyundai)', '{"make":"Hyundai","vehicle_type":"CAR"}'::jsonb),
  ('VEHICLE', '9354c46f-ce90-4a10-ba06-6c6ef08acd94', 'PB-07-FK-2345 (Tata)', '{"make":"Tata","vehicle_type":"TRUCK"}'::jsonb),
  ('VEHICLE', '0197c858-137b-455d-80cb-fa62f275e01b', 'PB-08-GL-6789 (Bajaj)', '{"make":"Bajaj","vehicle_type":"MOTORCYCLE"}'::jsonb),
  ('VEHICLE', '115c2ba1-98f8-4b0d-99b4-697c6b6eda4f', 'PB-11-HM-0123 (Truck)', '{"make":"Ashok Leyland","vehicle_type":"TRUCK"}'::jsonb)
ON CONFLICT (node_type, entity_id) DO UPDATE SET label = EXCLUDED.label, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 4: ADDRESS nodes (12 addresses)
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO network_node (node_type, entity_id, label, properties) VALUES
  ('ADDRESS', '7e13edea-4365-4fdd-a27b-48156597fb29', 'Tarn Taran', '{"district":"Tarn Taran","address_type":"RESIDENTIAL"}'::jsonb),
  ('ADDRESS', '32cac743-1391-4469-b7a4-27969dc63f78', 'Harike, Tarn Taran', '{"district":"Tarn Taran","address_type":"HIDEOUT"}'::jsonb),
  ('ADDRESS', '2a442853-5c81-4d45-9c85-681a4a790a2e', 'Hazara Singh Wala, Fazilka', '{"district":"Fazilka","address_type":"RESIDENTIAL"}'::jsonb),
  ('ADDRESS', '82f62abe-c0c0-48cd-bcba-e636f87faab0', 'Hussainiwala, Ferozepur', '{"district":"Ferozepur","address_type":"HIDEOUT"}'::jsonb),
  ('ADDRESS', '93bd9247-da65-41db-998e-9940cc75ba00', 'Amritsar', '{"district":"Amritsar","address_type":"RESIDENTIAL"}'::jsonb),
  ('ADDRESS', '378813f9-6629-456b-bab4-a0290c21ebaa', 'Amritsar (Office)', '{"district":"Amritsar","address_type":"OFFICE"}'::jsonb),
  ('ADDRESS', '645558a2-28bc-4500-abcd-42174fa1dd51', 'Jalandhar', '{"district":"Jalandhar","address_type":"RESIDENTIAL"}'::jsonb),
  ('ADDRESS', '90e98b9f-1bb7-47fd-a7a3-9210cadea43f', 'Jalandhar (Office)', '{"district":"Jalandhar","address_type":"OFFICE"}'::jsonb),
  ('ADDRESS', '433f1d40-aeb7-4f17-9f0d-5b7a6f39c98a', 'Ludhiana', '{"district":"Ludhiana","address_type":"OFFICE"}'::jsonb),
  ('ADDRESS', '24a24899-d67e-4101-b81f-feb381b92ddb', 'Arniwala, Fazilka', '{"district":"Fazilka","address_type":"RESIDENTIAL"}'::jsonb),
  ('ADDRESS', '3ef1b093-4723-41c7-9cee-0a782d96d3dc', 'Abohar, Fazilka', '{"district":"Fazilka","address_type":"RESIDENTIAL"}'::jsonb),
  ('ADDRESS', 'cf61f8b4-cdff-4bf6-a4bf-962e28c81179', 'Abohar (Alt), Fazilka', '{"district":"Fazilka","address_type":"HIDEOUT"}'::jsonb)
ON CONFLICT (node_type, entity_id) DO UPDATE SET label = EXCLUDED.label, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 5: SOCIAL_ACCOUNT nodes (7 accounts)
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO network_node (node_type, entity_id, label, properties) VALUES
  ('SOCIAL_ACCOUNT', '3ecc8ca0-7dc7-4f6d-9aaa-bcdac03e14de', '@irfan_trader82 (Instagram)', '{"platform":"Instagram"}'::jsonb),
  ('SOCIAL_ACCOUNT', 'f333088e-dc33-428e-a746-396964b0aaa0', '@irfan_deals (Telegram)', '{"platform":"Telegram"}'::jsonb),
  ('SOCIAL_ACCOUNT', 'ed6a9595-0073-4b59-a357-c50ad7f5fd3b', 'irfan.khan.tt (Facebook)', '{"platform":"Facebook"}'::jsonb),
  ('SOCIAL_ACCOUNT', 'dcfeea92-b287-4d5a-81c6-29952f5347a4', 'binder.singh.fzk (Facebook)', '{"platform":"Facebook"}'::jsonb),
  ('SOCIAL_ACCOUNT', '4aa8c995-5d0c-4deb-81e9-7f2cb2cce943', '@rajesh_transport (Instagram)', '{"platform":"Instagram"}'::jsonb),
  ('SOCIAL_ACCOUNT', '6adde532-3e97-4f9e-a032-a29a2a41655d', '@ranjit_mann_jld (Instagram)', '{"platform":"Instagram"}'::jsonb),
  ('SOCIAL_ACCOUNT', 'cc64e4c9-a6e1-4d2d-bbcd-e433c483b4b1', 'sanjay.patel.ldh (Facebook)', '{"platform":"Facebook"}'::jsonb)
ON CONFLICT (node_type, entity_id) DO UPDATE SET label = EXCLUDED.label, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 6: IDENTITY_DOC nodes (10 documents)
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO network_node (node_type, entity_id, label, properties) VALUES
  ('IDENTITY_DOC', '112c6472-b727-4180-a141-af8ddbf137b7', 'Aadhaar XXXX-1234', '{"doc_type":"AADHAAR"}'::jsonb),
  ('IDENTITY_DOC', 'ba387f8d-eb96-4afc-b630-3bda2c31681b', 'PAN ABCPK1234F', '{"doc_type":"PAN"}'::jsonb),
  ('IDENTITY_DOC', 'd6471d6f-fcd5-47c3-a1f3-8ad44733b147', 'Aadhaar XXXX-5678', '{"doc_type":"AADHAAR"}'::jsonb),
  ('IDENTITY_DOC', '1d755002-5cf3-47ec-8aa0-edf27e2f86f8', 'Passport J12345678', '{"doc_type":"PASSPORT"}'::jsonb),
  ('IDENTITY_DOC', 'e0ac215b-ed29-4d44-aaa7-94d594eb7c7b', 'Aadhaar XXXX-9012', '{"doc_type":"AADHAAR"}'::jsonb),
  ('IDENTITY_DOC', '79be8f7a-035a-43fd-b06a-146d127933ac', 'DL PB042019...', '{"doc_type":"DRIVING_LICENSE"}'::jsonb),
  ('IDENTITY_DOC', '0f09f70c-8b3e-4847-bf59-4fbc2224a9c2', 'Aadhaar XXXX-3456', '{"doc_type":"AADHAAR"}'::jsonb),
  ('IDENTITY_DOC', '9310b0b3-b888-4235-aaef-7e805f04b178', 'PAN BCDRS5678G', '{"doc_type":"PAN"}'::jsonb),
  ('IDENTITY_DOC', '505500e7-c4f3-4474-a41b-4a65ab677b10', 'Aadhaar XXXX-7890', '{"doc_type":"AADHAAR"}'::jsonb),
  ('IDENTITY_DOC', '99627754-142e-4352-a2ee-72245a0511ae', 'Voter ID PB/04/...', '{"doc_type":"VOTER_ID"}'::jsonb)
ON CONFLICT (node_type, entity_id) DO UPDATE SET label = EXCLUDED.label, updated_at = NOW();


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 7: HAS_PHONE edges (Subject → Phone)
-- ═══════════════════════════════════════════════════════════════════════
-- We need to look up node_ids from the SUBJECT and PHONE nodes we just inserted/already exist.
-- Using subquery-based inserts.

-- Irfan → phones
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, p.node_id, 'HAS_PHONE', 100, 90, '2024-01-15', '2026-03-10'
FROM network_node s, network_node p
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '8d0b8037-4d7c-4598-a6ff-2d5a1cc8141f'
  AND p.node_type = 'PHONE' AND p.entity_id = 'e1f7b899-4230-4cc8-9ff1-919522028126'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, p.node_id, 'HAS_PHONE', 100, 85, '2024-06-01', '2026-03-10'
FROM network_node s, network_node p
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '8d0b8037-4d7c-4598-a6ff-2d5a1cc8141f'
  AND p.node_type = 'PHONE' AND p.entity_id = 'd8a1258d-98b2-4239-b819-d73723383d1b'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Balwinder → phones
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, p.node_id, 'HAS_PHONE', 100, 90, '2023-11-20', '2026-03-08'
FROM network_node s, network_node p
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '773a4d62-53d8-4d9d-b940-20c8844ca781'
  AND p.node_type = 'PHONE' AND p.entity_id = '70880080-862e-4063-b48b-d3f1e479bc80'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, p.node_id, 'HAS_PHONE', 100, 75, '2024-03-15', '2026-02-20'
FROM network_node s, network_node p
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '773a4d62-53d8-4d9d-b940-20c8844ca781'
  AND p.node_type = 'PHONE' AND p.entity_id = '576a5dc2-4d43-4c01-85c4-8854aa2499c3'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Ranjit → phone
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, p.node_id, 'HAS_PHONE', 100, 90, '2024-01-01', '2026-03-10'
FROM network_node s, network_node p
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '797f3711-c13f-47a4-80f2-6062b3400318'
  AND p.node_type = 'PHONE' AND p.entity_id = 'f867088f-b277-48ff-b495-f8b5659ff506'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Mohinder → phone
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, p.node_id, 'HAS_PHONE', 100, 80, '2024-02-01', '2026-03-05'
FROM network_node s, network_node p
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '0991b96c-7601-4bed-887a-f8fa16656fae'
  AND p.node_type = 'PHONE' AND p.entity_id = '3c637607-f668-418e-b012-8d3a5f157fa8'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Anil Kumar → phone
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, p.node_id, 'HAS_PHONE', 100, 85, '2024-05-10', '2026-03-01'
FROM network_node s, network_node p
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '7c41991b-238a-401a-8d1f-e2872272a6fe'
  AND p.node_type = 'PHONE' AND p.entity_id = 'bfece5ac-2e8e-4325-b1d5-9786991f2c04'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Sanjay → phone
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, p.node_id, 'HAS_PHONE', 100, 80, '2024-04-01', '2026-03-09'
FROM network_node s, network_node p
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '88fe49a1-154e-446a-a474-d13e5ec537bf'
  AND p.node_type = 'PHONE' AND p.entity_id = '803dba3e-5077-43e0-9c7b-4be2e52eb03a'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Paramjit → phone
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, p.node_id, 'HAS_PHONE', 100, 85, '2024-01-20', '2026-03-07'
FROM network_node s, network_node p
WHERE s.node_type = 'SUBJECT' AND s.entity_id = 'f360d26f-fac4-4c11-8fed-50402885697a'
  AND p.node_type = 'PHONE' AND p.entity_id = 'a3be6486-8603-4e44-a7c0-b95168be8e18'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Pradeep → phone
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, p.node_id, 'HAS_PHONE', 100, 80, '2024-07-01', '2026-03-06'
FROM network_node s, network_node p
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '52359f5d-9ef1-4fba-8690-35f3d07b8809'
  AND p.node_type = 'PHONE' AND p.entity_id = 'e00c0b86-cc4a-443a-a608-80ed51de8cc2'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Gurpreet → phone
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, p.node_id, 'HAS_PHONE', 100, 75, '2024-08-15', '2026-03-04'
FROM network_node s, network_node p
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '03db7bd3-c7ea-4b66-b5fd-982536267e70'
  AND p.node_type = 'PHONE' AND p.entity_id = '1f66c18e-d1ca-4734-bc47-ea956f0212c3'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Lakshmi → phone
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, p.node_id, 'HAS_PHONE', 100, 70, '2024-09-01', '2026-02-28'
FROM network_node s, network_node p
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '15e83705-e82d-4e93-a565-2ba3c5bee524'
  AND p.node_type = 'PHONE' AND p.entity_id = '92aa35fa-0abf-4485-ac46-813ab670bb99'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Vikram → phone
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, p.node_id, 'HAS_PHONE', 100, 75, '2024-06-15', '2026-03-02'
FROM network_node s, network_node p
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '8de8e0fb-3b40-4768-bb74-bbf0eb64c488'
  AND p.node_type = 'PHONE' AND p.entity_id = '818ee105-ed63-4487-910f-aea965f11da0'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Deepak → phone
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, p.node_id, 'HAS_PHONE', 100, 70, '2024-10-01', '2026-02-25'
FROM network_node s, network_node p
WHERE s.node_type = 'SUBJECT' AND s.entity_id = 'bcf3c771-433f-46c2-93d9-6afc9e268d5f'
  AND p.node_type = 'PHONE' AND p.entity_id = 'a376bcd0-4bc4-4653-8658-1448974ccf41'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Raj Kumar → phone
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, p.node_id, 'HAS_PHONE', 100, 80, '2024-05-01', '2026-03-01'
FROM network_node s, network_node p
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '71008d8f-7a00-4c8e-b113-fa5b8be8ce53'
  AND p.node_type = 'PHONE' AND p.entity_id = 'bdbe19cd-1691-4811-b2a6-5d0dd889a248'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Rajesh → phone
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, p.node_id, 'HAS_PHONE', 100, 85, '2024-02-15', '2026-03-09'
FROM network_node s, network_node p
WHERE s.node_type = 'SUBJECT' AND s.entity_id = 'e857f4d5-2a3a-4cf2-88e4-b4b247e0ad01'
  AND p.node_type = 'PHONE' AND p.entity_id = '70263c29-933f-4140-acec-84674f0af802'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 8: HAS_DEVICE edges (Subject → Device)
-- ═══════════════════════════════════════════════════════════════════════

-- Irfan → Samsung Galaxy S22, iPhone 13
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, d.node_id, 'HAS_DEVICE', 100, 85, '2024-01-15', '2026-03-10'
FROM network_node s, network_node d
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '8d0b8037-4d7c-4598-a6ff-2d5a1cc8141f'
  AND d.node_type = 'DEVICE' AND d.entity_id = '57a0851d-9c51-4f9f-8749-5e0065328ff7'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, d.node_id, 'HAS_DEVICE', 100, 80, '2024-06-01', '2026-03-10'
FROM network_node s, network_node d
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '8d0b8037-4d7c-4598-a6ff-2d5a1cc8141f'
  AND d.node_type = 'DEVICE' AND d.entity_id = 'a3da43f8-fc12-42c5-bfe9-7ae45d50d0b4'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Balwinder → Redmi Note 12
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, d.node_id, 'HAS_DEVICE', 100, 85, '2023-11-20', '2026-03-08'
FROM network_node s, network_node d
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '773a4d62-53d8-4d9d-b940-20c8844ca781'
  AND d.node_type = 'DEVICE' AND d.entity_id = 'c8d90f8c-aa28-4fce-a30a-1e39e591deb7'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Mohinder → Realme C55
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, d.node_id, 'HAS_DEVICE', 100, 75, '2024-02-01', '2026-03-05'
FROM network_node s, network_node d
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '0991b96c-7601-4bed-887a-f8fa16656fae'
  AND d.node_type = 'DEVICE' AND d.entity_id = 'fd3cad01-cfcd-46b5-a8e9-3a5d2b7fae7f'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Pradeep → Samsung Galaxy A14
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, d.node_id, 'HAS_DEVICE', 100, 80, '2024-07-01', '2026-03-06'
FROM network_node s, network_node d
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '52359f5d-9ef1-4fba-8690-35f3d07b8809'
  AND d.node_type = 'DEVICE' AND d.entity_id = 'a460745f-4336-456e-901c-31fca27079d8'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Ranjit → iPhone 14 Pro
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, d.node_id, 'HAS_DEVICE', 100, 85, '2024-01-01', '2026-03-10'
FROM network_node s, network_node d
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '797f3711-c13f-47a4-80f2-6062b3400318'
  AND d.node_type = 'DEVICE' AND d.entity_id = 'a992db30-4692-47fb-99e8-1dfd2fbe2023'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Gurpreet → Vivo Y56
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, d.node_id, 'HAS_DEVICE', 100, 70, '2024-08-15', '2026-03-04'
FROM network_node s, network_node d
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '03db7bd3-c7ea-4b66-b5fd-982536267e70'
  AND d.node_type = 'DEVICE' AND d.entity_id = 'e13bcb31-4ffc-4222-9d12-42b19c83dddf'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 9: HAS_VEHICLE edges (Subject → Vehicle)
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, v.node_id, 'HAS_VEHICLE', 100, 90, '2024-01-15', '2026-03-10'
FROM network_node s, network_node v
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '8d0b8037-4d7c-4598-a6ff-2d5a1cc8141f'
  AND v.node_type = 'VEHICLE' AND v.entity_id = 'a1d8f95c-38a3-426e-875b-164c63f60e14'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, v.node_id, 'HAS_VEHICLE', 100, 85, '2023-11-20', '2026-03-08'
FROM network_node s, network_node v
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '773a4d62-53d8-4d9d-b940-20c8844ca781'
  AND v.node_type = 'VEHICLE' AND v.entity_id = '8c7523c3-2d7e-44e0-a08b-10fc1c849af1'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, v.node_id, 'HAS_VEHICLE', 100, 70, '2024-04-01', '2026-02-15'
FROM network_node s, network_node v
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '773a4d62-53d8-4d9d-b940-20c8844ca781'
  AND v.node_type = 'VEHICLE' AND v.entity_id = '27403a79-47b4-4eb8-be79-5c4b34051c84'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, v.node_id, 'HAS_VEHICLE', 100, 80, '2024-02-15', '2026-03-09'
FROM network_node s, network_node v
WHERE s.node_type = 'SUBJECT' AND s.entity_id = 'e857f4d5-2a3a-4cf2-88e4-b4b247e0ad01'
  AND v.node_type = 'VEHICLE' AND v.entity_id = '5f8835b3-dbae-4ea1-aab6-c33cbec6c815'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, v.node_id, 'HAS_VEHICLE', 100, 80, '2024-01-01', '2026-03-10'
FROM network_node s, network_node v
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '797f3711-c13f-47a4-80f2-6062b3400318'
  AND v.node_type = 'VEHICLE' AND v.entity_id = '514ae045-154b-44e6-b596-2a6daf7817a8'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, v.node_id, 'HAS_VEHICLE', 100, 75, '2024-04-01', '2026-03-09'
FROM network_node s, network_node v
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '88fe49a1-154e-446a-a474-d13e5ec537bf'
  AND v.node_type = 'VEHICLE' AND v.entity_id = '11a9ae36-0e7e-4f71-88bc-b0852409cc25'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, v.node_id, 'HAS_VEHICLE', 100, 80, '2024-05-10', '2026-03-01'
FROM network_node s, network_node v
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '7c41991b-238a-401a-8d1f-e2872272a6fe'
  AND v.node_type = 'VEHICLE' AND v.entity_id = '9354c46f-ce90-4a10-ba06-6c6ef08acd94'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, v.node_id, 'HAS_VEHICLE', 100, 70, '2024-08-15', '2026-03-04'
FROM network_node s, network_node v
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '03db7bd3-c7ea-4b66-b5fd-982536267e70'
  AND v.node_type = 'VEHICLE' AND v.entity_id = '0197c858-137b-455d-80cb-fa62f275e01b'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, v.node_id, 'HAS_VEHICLE', 100, 75, '2024-09-01', '2026-02-28'
FROM network_node s, network_node v
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '15e83705-e82d-4e93-a565-2ba3c5bee524'
  AND v.node_type = 'VEHICLE' AND v.entity_id = '115c2ba1-98f8-4b0d-99b4-697c6b6eda4f'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 10: HAS_ADDRESS edges (Subject → Address)
-- ═══════════════════════════════════════════════════════════════════════

-- Irfan → 2 addresses
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, a.node_id, 'HAS_ADDRESS', 100, 90, '2024-01-15', '2026-03-10'
FROM network_node s, network_node a
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '8d0b8037-4d7c-4598-a6ff-2d5a1cc8141f'
  AND a.node_type = 'ADDRESS' AND a.entity_id = '7e13edea-4365-4fdd-a27b-48156597fb29'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, a.node_id, 'HAS_ADDRESS', 85, 70, '2025-02-01', '2026-01-15'
FROM network_node s, network_node a
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '8d0b8037-4d7c-4598-a6ff-2d5a1cc8141f'
  AND a.node_type = 'ADDRESS' AND a.entity_id = '32cac743-1391-4469-b7a4-27969dc63f78'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Balwinder → 2 addresses
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, a.node_id, 'HAS_ADDRESS', 100, 90, '2023-11-20', '2026-03-08'
FROM network_node s, network_node a
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '773a4d62-53d8-4d9d-b940-20c8844ca781'
  AND a.node_type = 'ADDRESS' AND a.entity_id = '2a442853-5c81-4d45-9c85-681a4a790a2e'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, a.node_id, 'HAS_ADDRESS', 80, 65, '2025-01-01', '2026-02-20'
FROM network_node s, network_node a
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '773a4d62-53d8-4d9d-b940-20c8844ca781'
  AND a.node_type = 'ADDRESS' AND a.entity_id = '82f62abe-c0c0-48cd-bcba-e636f87faab0'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Rajesh → 2 addresses
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, a.node_id, 'HAS_ADDRESS', 100, 85, '2024-02-15', '2026-03-09'
FROM network_node s, network_node a
WHERE s.node_type = 'SUBJECT' AND s.entity_id = 'e857f4d5-2a3a-4cf2-88e4-b4b247e0ad01'
  AND a.node_type = 'ADDRESS' AND a.entity_id = '93bd9247-da65-41db-998e-9940cc75ba00'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, a.node_id, 'HAS_ADDRESS', 90, 75, '2024-06-01', '2026-03-05'
FROM network_node s, network_node a
WHERE s.node_type = 'SUBJECT' AND s.entity_id = 'e857f4d5-2a3a-4cf2-88e4-b4b247e0ad01'
  AND a.node_type = 'ADDRESS' AND a.entity_id = '378813f9-6629-456b-bab4-a0290c21ebaa'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Ranjit → 2 addresses
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, a.node_id, 'HAS_ADDRESS', 100, 90, '2024-01-01', '2026-03-10'
FROM network_node s, network_node a
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '797f3711-c13f-47a4-80f2-6062b3400318'
  AND a.node_type = 'ADDRESS' AND a.entity_id = '645558a2-28bc-4500-abcd-42174fa1dd51'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, a.node_id, 'HAS_ADDRESS', 90, 75, '2024-03-01', '2026-03-08'
FROM network_node s, network_node a
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '797f3711-c13f-47a4-80f2-6062b3400318'
  AND a.node_type = 'ADDRESS' AND a.entity_id = '90e98b9f-1bb7-47fd-a7a3-9210cadea43f'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Sanjay → address
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, a.node_id, 'HAS_ADDRESS', 100, 85, '2024-04-01', '2026-03-09'
FROM network_node s, network_node a
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '88fe49a1-154e-446a-a474-d13e5ec537bf'
  AND a.node_type = 'ADDRESS' AND a.entity_id = '433f1d40-aeb7-4f17-9f0d-5b7a6f39c98a'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Paramjit → address
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, a.node_id, 'HAS_ADDRESS', 100, 85, '2024-01-20', '2026-03-07'
FROM network_node s, network_node a
WHERE s.node_type = 'SUBJECT' AND s.entity_id = 'f360d26f-fac4-4c11-8fed-50402885697a'
  AND a.node_type = 'ADDRESS' AND a.entity_id = '24a24899-d67e-4101-b81f-feb381b92ddb'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Anil Kumar → 2 addresses
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, a.node_id, 'HAS_ADDRESS', 100, 85, '2024-05-10', '2026-03-01'
FROM network_node s, network_node a
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '7c41991b-238a-401a-8d1f-e2872272a6fe'
  AND a.node_type = 'ADDRESS' AND a.entity_id = '3ef1b093-4723-41c7-9cee-0a782d96d3dc'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, a.node_id, 'HAS_ADDRESS', 80, 60, '2025-01-01', '2026-02-15'
FROM network_node s, network_node a
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '7c41991b-238a-401a-8d1f-e2872272a6fe'
  AND a.node_type = 'ADDRESS' AND a.entity_id = 'cf61f8b4-cdff-4bf6-a4bf-962e28c81179'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 11: HAS_SOCIAL edges (Subject → Social Account)
-- ═══════════════════════════════════════════════════════════════════════

-- Irfan → 3 social accounts
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, sa.node_id, 'HAS_SOCIAL', 100, 85, '2024-01-15', '2026-03-10'
FROM network_node s, network_node sa
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '8d0b8037-4d7c-4598-a6ff-2d5a1cc8141f'
  AND sa.node_type = 'SOCIAL_ACCOUNT' AND sa.entity_id = '3ecc8ca0-7dc7-4f6d-9aaa-bcdac03e14de'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, sa.node_id, 'HAS_SOCIAL', 100, 80, '2024-03-01', '2026-03-10'
FROM network_node s, network_node sa
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '8d0b8037-4d7c-4598-a6ff-2d5a1cc8141f'
  AND sa.node_type = 'SOCIAL_ACCOUNT' AND sa.entity_id = 'f333088e-dc33-428e-a746-396964b0aaa0'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, sa.node_id, 'HAS_SOCIAL', 100, 75, '2024-06-01', '2026-03-10'
FROM network_node s, network_node sa
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '8d0b8037-4d7c-4598-a6ff-2d5a1cc8141f'
  AND sa.node_type = 'SOCIAL_ACCOUNT' AND sa.entity_id = 'ed6a9595-0073-4b59-a357-c50ad7f5fd3b'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Balwinder → Facebook
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, sa.node_id, 'HAS_SOCIAL', 100, 80, '2023-11-20', '2026-03-08'
FROM network_node s, network_node sa
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '773a4d62-53d8-4d9d-b940-20c8844ca781'
  AND sa.node_type = 'SOCIAL_ACCOUNT' AND sa.entity_id = 'dcfeea92-b287-4d5a-81c6-29952f5347a4'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Rajesh → Instagram
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, sa.node_id, 'HAS_SOCIAL', 100, 80, '2024-02-15', '2026-03-09'
FROM network_node s, network_node sa
WHERE s.node_type = 'SUBJECT' AND s.entity_id = 'e857f4d5-2a3a-4cf2-88e4-b4b247e0ad01'
  AND sa.node_type = 'SOCIAL_ACCOUNT' AND sa.entity_id = '4aa8c995-5d0c-4deb-81e9-7f2cb2cce943'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Ranjit → Instagram
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, sa.node_id, 'HAS_SOCIAL', 100, 75, '2024-01-01', '2026-03-10'
FROM network_node s, network_node sa
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '797f3711-c13f-47a4-80f2-6062b3400318'
  AND sa.node_type = 'SOCIAL_ACCOUNT' AND sa.entity_id = '6adde532-3e97-4f9e-a032-a29a2a41655d'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Sanjay → Facebook
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, sa.node_id, 'HAS_SOCIAL', 100, 70, '2024-04-01', '2026-03-09'
FROM network_node s, network_node sa
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '88fe49a1-154e-446a-a474-d13e5ec537bf'
  AND sa.node_type = 'SOCIAL_ACCOUNT' AND sa.entity_id = 'cc64e4c9-a6e1-4d2d-bbcd-e433c483b4b1'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 12: HAS_IDENTITY edges (Subject → Identity Document)
-- ═══════════════════════════════════════════════════════════════════════

-- Irfan → Aadhaar + PAN
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, d.node_id, 'HAS_IDENTITY', 100, 95, '2024-01-15', '2026-03-10'
FROM network_node s, network_node d
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '8d0b8037-4d7c-4598-a6ff-2d5a1cc8141f'
  AND d.node_type = 'IDENTITY_DOC' AND d.entity_id = '112c6472-b727-4180-a141-af8ddbf137b7'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, d.node_id, 'HAS_IDENTITY', 100, 90, '2024-01-15', '2026-03-10'
FROM network_node s, network_node d
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '8d0b8037-4d7c-4598-a6ff-2d5a1cc8141f'
  AND d.node_type = 'IDENTITY_DOC' AND d.entity_id = 'ba387f8d-eb96-4afc-b630-3bda2c31681b'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Balwinder → Aadhaar + Passport
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, d.node_id, 'HAS_IDENTITY', 100, 95, '2023-11-20', '2026-03-08'
FROM network_node s, network_node d
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '773a4d62-53d8-4d9d-b940-20c8844ca781'
  AND d.node_type = 'IDENTITY_DOC' AND d.entity_id = 'd6471d6f-fcd5-47c3-a1f3-8ad44733b147'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, d.node_id, 'HAS_IDENTITY', 100, 85, '2023-11-20', '2026-03-08'
FROM network_node s, network_node d
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '773a4d62-53d8-4d9d-b940-20c8844ca781'
  AND d.node_type = 'IDENTITY_DOC' AND d.entity_id = '1d755002-5cf3-47ec-8aa0-edf27e2f86f8'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Rajesh → Aadhaar + DL
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, d.node_id, 'HAS_IDENTITY', 100, 95, '2024-02-15', '2026-03-09'
FROM network_node s, network_node d
WHERE s.node_type = 'SUBJECT' AND s.entity_id = 'e857f4d5-2a3a-4cf2-88e4-b4b247e0ad01'
  AND d.node_type = 'IDENTITY_DOC' AND d.entity_id = 'e0ac215b-ed29-4d44-aaa7-94d594eb7c7b'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, d.node_id, 'HAS_IDENTITY', 100, 85, '2024-02-15', '2026-03-09'
FROM network_node s, network_node d
WHERE s.node_type = 'SUBJECT' AND s.entity_id = 'e857f4d5-2a3a-4cf2-88e4-b4b247e0ad01'
  AND d.node_type = 'IDENTITY_DOC' AND d.entity_id = '79be8f7a-035a-43fd-b06a-146d127933ac'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Ranjit → Aadhaar + PAN
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, d.node_id, 'HAS_IDENTITY', 100, 90, '2024-01-01', '2026-03-10'
FROM network_node s, network_node d
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '797f3711-c13f-47a4-80f2-6062b3400318'
  AND d.node_type = 'IDENTITY_DOC' AND d.entity_id = '0f09f70c-8b3e-4847-bf59-4fbc2224a9c2'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, d.node_id, 'HAS_IDENTITY', 100, 85, '2024-01-01', '2026-03-10'
FROM network_node s, network_node d
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '797f3711-c13f-47a4-80f2-6062b3400318'
  AND d.node_type = 'IDENTITY_DOC' AND d.entity_id = '9310b0b3-b888-4235-aaef-7e805f04b178'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Sanjay → Aadhaar
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, d.node_id, 'HAS_IDENTITY', 100, 90, '2024-04-01', '2026-03-09'
FROM network_node s, network_node d
WHERE s.node_type = 'SUBJECT' AND s.entity_id = '88fe49a1-154e-446a-a474-d13e5ec537bf'
  AND d.node_type = 'IDENTITY_DOC' AND d.entity_id = '505500e7-c4f3-4474-a41b-4a65ab677b10'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Paramjit → Voter ID
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, confidence, strength, first_seen_at, last_seen_at)
SELECT s.node_id, d.node_id, 'HAS_IDENTITY', 100, 85, '2024-01-20', '2026-03-07'
FROM network_node s, network_node d
WHERE s.node_type = 'SUBJECT' AND s.entity_id = 'f360d26f-fac4-4c11-8fed-50402885697a'
  AND d.node_type = 'IDENTITY_DOC' AND d.entity_id = '99627754-142e-4352-a2ee-72245a0511ae'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 13: CO_ACCUSED edges (from shared FIRs)
-- ═══════════════════════════════════════════════════════════════════════

-- Irfan ↔ Rajesh (co-accused in same FIR)
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, is_inferred, confidence, strength, evidence_count, first_seen_at, last_seen_at)
SELECT s1.node_id, s2.node_id, 'CO_ACCUSED', TRUE, 95, 90, 2, '2024-03-15', '2025-08-20'
FROM network_node s1, network_node s2
WHERE s1.node_type = 'SUBJECT' AND s1.entity_id = '8d0b8037-4d7c-4598-a6ff-2d5a1cc8141f'
  AND s2.node_type = 'SUBJECT' AND s2.entity_id = 'e857f4d5-2a3a-4cf2-88e4-b4b247e0ad01'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Balwinder ↔ Paramjit (co-accused)
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, is_inferred, confidence, strength, evidence_count, first_seen_at, last_seen_at)
SELECT s1.node_id, s2.node_id, 'CO_ACCUSED', TRUE, 95, 90, 3, '2023-11-20', '2025-12-10'
FROM network_node s1, network_node s2
WHERE s1.node_type = 'SUBJECT' AND s1.entity_id = '773a4d62-53d8-4d9d-b940-20c8844ca781'
  AND s2.node_type = 'SUBJECT' AND s2.entity_id = 'f360d26f-fac4-4c11-8fed-50402885697a'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Balwinder ↔ Anil Kumar (co-accused)
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, is_inferred, confidence, strength, evidence_count, first_seen_at, last_seen_at)
SELECT s1.node_id, s2.node_id, 'CO_ACCUSED', TRUE, 85, 75, 1, '2024-09-01', '2024-09-01'
FROM network_node s1, network_node s2
WHERE s1.node_type = 'SUBJECT' AND s1.entity_id = '773a4d62-53d8-4d9d-b940-20c8844ca781'
  AND s2.node_type = 'SUBJECT' AND s2.entity_id = '7c41991b-238a-401a-8d1f-e2872272a6fe'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Balwinder ↔ Ajay Thakur (co-accused)
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, is_inferred, confidence, strength, evidence_count, first_seen_at, last_seen_at)
SELECT s1.node_id, s2.node_id, 'CO_ACCUSED', TRUE, 80, 65, 1, '2025-03-01', '2025-03-01'
FROM network_node s1, network_node s2
WHERE s1.node_type = 'SUBJECT' AND s1.entity_id = '773a4d62-53d8-4d9d-b940-20c8844ca781'
  AND s2.node_type = 'SUBJECT' AND s2.entity_id = 'e26a06fd-26d3-4bc8-838a-3f34d9548f8e'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Ajay Thakur ↔ Paramjit (co-accused)
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, is_inferred, confidence, strength, evidence_count, first_seen_at, last_seen_at)
SELECT s1.node_id, s2.node_id, 'CO_ACCUSED', TRUE, 80, 65, 1, '2025-06-15', '2025-06-15'
FROM network_node s1, network_node s2
WHERE s1.node_type = 'SUBJECT' AND s1.entity_id = 'e26a06fd-26d3-4bc8-838a-3f34d9548f8e'
  AND s2.node_type = 'SUBJECT' AND s2.entity_id = 'f360d26f-fac4-4c11-8fed-50402885697a'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Ranjit ↔ Sanjay (co-accused)
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, is_inferred, confidence, strength, evidence_count, first_seen_at, last_seen_at)
SELECT s1.node_id, s2.node_id, 'CO_ACCUSED', TRUE, 90, 80, 2, '2024-06-01', '2025-11-15'
FROM network_node s1, network_node s2
WHERE s1.node_type = 'SUBJECT' AND s1.entity_id = '797f3711-c13f-47a4-80f2-6062b3400318'
  AND s2.node_type = 'SUBJECT' AND s2.entity_id = '88fe49a1-154e-446a-a474-d13e5ec537bf'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Sunita Devi ↔ Pradeep Sharma (co-accused)
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, is_inferred, confidence, strength, evidence_count, first_seen_at, last_seen_at)
SELECT s1.node_id, s2.node_id, 'CO_ACCUSED', TRUE, 85, 70, 1, '2024-12-01', '2024-12-01'
FROM network_node s1, network_node s2
WHERE s1.node_type = 'SUBJECT' AND s1.entity_id = '3d2723f3-9508-4028-abf0-3dbe39183f0d'
  AND s2.node_type = 'SUBJECT' AND s2.entity_id = '52359f5d-9ef1-4fba-8690-35f3d07b8809'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 14: GANG edges (from gang_affiliation field)
-- ═══════════════════════════════════════════════════════════════════════

-- Irfan ↔ Rajesh (Tarn Taran drug syndicate)
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, is_inferred, confidence, strength, evidence_count, first_seen_at, last_seen_at)
SELECT s1.node_id, s2.node_id, 'GANG', FALSE, 95, 95, 5, '2023-06-01', '2026-03-10'
FROM network_node s1, network_node s2
WHERE s1.node_type = 'SUBJECT' AND s1.entity_id = '8d0b8037-4d7c-4598-a6ff-2d5a1cc8141f'
  AND s2.node_type = 'SUBJECT' AND s2.entity_id = 'e857f4d5-2a3a-4cf2-88e4-b4b247e0ad01'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Balwinder ↔ Paramjit (border gang)
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, is_inferred, confidence, strength, evidence_count, first_seen_at, last_seen_at)
SELECT s1.node_id, s2.node_id, 'GANG', FALSE, 95, 95, 4, '2022-09-01', '2026-03-08'
FROM network_node s1, network_node s2
WHERE s1.node_type = 'SUBJECT' AND s1.entity_id = '773a4d62-53d8-4d9d-b940-20c8844ca781'
  AND s2.node_type = 'SUBJECT' AND s2.entity_id = 'f360d26f-fac4-4c11-8fed-50402885697a'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 15: FAMILY edges (from subject_family_member)
-- ═══════════════════════════════════════════════════════════════════════

-- Balwinder ↔ Kamaljeet (SPOUSE)
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, is_inferred, confidence, strength, first_seen_at, last_seen_at)
SELECT s1.node_id, s2.node_id, 'FAMILY', FALSE, 100, 95, '2023-11-20', '2026-03-08'
FROM network_node s1, network_node s2
WHERE s1.node_type = 'SUBJECT' AND s1.entity_id = '773a4d62-53d8-4d9d-b940-20c8844ca781'
  AND s2.node_type = 'SUBJECT' AND s2.entity_id = 'f6697d71-3664-46f1-a249-b0a977cefc50'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Rajesh ↔ Parminder (SPOUSE)
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, is_inferred, confidence, strength, first_seen_at, last_seen_at)
SELECT s1.node_id, s2.node_id, 'FAMILY', FALSE, 100, 95, '2024-02-15', '2026-03-09'
FROM network_node s1, network_node s2
WHERE s1.node_type = 'SUBJECT' AND s1.entity_id = 'e857f4d5-2a3a-4cf2-88e4-b4b247e0ad01'
  AND s2.node_type = 'SUBJECT' AND s2.entity_id = 'c44611f4-969c-49df-b578-23e8d87f01f4'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 16: ASSOCIATE edges (intelligence-based associations)
-- ═══════════════════════════════════════════════════════════════════════

-- Irfan → Pradeep (supplier-customer)
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, is_inferred, confidence, strength, evidence_count, first_seen_at, last_seen_at)
SELECT s1.node_id, s2.node_id, 'ASSOCIATE', TRUE, 80, 70, 3, '2024-06-01', '2026-02-15'
FROM network_node s1, network_node s2
WHERE s1.node_type = 'SUBJECT' AND s1.entity_id = '8d0b8037-4d7c-4598-a6ff-2d5a1cc8141f'
  AND s2.node_type = 'SUBJECT' AND s2.entity_id = '52359f5d-9ef1-4fba-8690-35f3d07b8809'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Irfan → Gurpreet (supply chain)
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, is_inferred, confidence, strength, evidence_count, first_seen_at, last_seen_at)
SELECT s1.node_id, s2.node_id, 'ASSOCIATE', TRUE, 70, 60, 2, '2024-08-15', '2025-12-01'
FROM network_node s1, network_node s2
WHERE s1.node_type = 'SUBJECT' AND s1.entity_id = '8d0b8037-4d7c-4598-a6ff-2d5a1cc8141f'
  AND s2.node_type = 'SUBJECT' AND s2.entity_id = '03db7bd3-c7ea-4b66-b5fd-982536267e70'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Ranjit → Irfan (financing link)
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, is_inferred, confidence, strength, evidence_count, first_seen_at, last_seen_at)
SELECT s1.node_id, s2.node_id, 'ASSOCIATE', TRUE, 75, 80, 3, '2024-01-01', '2026-03-10'
FROM network_node s1, network_node s2
WHERE s1.node_type = 'SUBJECT' AND s1.entity_id = '797f3711-c13f-47a4-80f2-6062b3400318'
  AND s2.node_type = 'SUBJECT' AND s2.entity_id = '8d0b8037-4d7c-4598-a6ff-2d5a1cc8141f'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Sanjay → Irfan (business front → supply)
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, is_inferred, confidence, strength, evidence_count, first_seen_at, last_seen_at)
SELECT s1.node_id, s2.node_id, 'ASSOCIATE', TRUE, 75, 75, 5, '2024-04-01', '2026-03-09'
FROM network_node s1, network_node s2
WHERE s1.node_type = 'SUBJECT' AND s1.entity_id = '88fe49a1-154e-446a-a474-d13e5ec537bf'
  AND s2.node_type = 'SUBJECT' AND s2.entity_id = '8d0b8037-4d7c-4598-a6ff-2d5a1cc8141f'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Balwinder → Mohinder (courier relationship)
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, is_inferred, confidence, strength, evidence_count, first_seen_at, last_seen_at)
SELECT s1.node_id, s2.node_id, 'ASSOCIATE', TRUE, 70, 65, 2, '2024-02-01', '2025-10-20'
FROM network_node s1, network_node s2
WHERE s1.node_type = 'SUBJECT' AND s1.entity_id = '773a4d62-53d8-4d9d-b940-20c8844ca781'
  AND s2.node_type = 'SUBJECT' AND s2.entity_id = '0991b96c-7601-4bed-887a-f8fa16656fae'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Rajesh → Vikram (mechanic/transport link)
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, is_inferred, confidence, strength, evidence_count, first_seen_at, last_seen_at)
SELECT s1.node_id, s2.node_id, 'ASSOCIATE', TRUE, 65, 55, 2, '2024-06-15', '2025-11-01'
FROM network_node s1, network_node s2
WHERE s1.node_type = 'SUBJECT' AND s1.entity_id = 'e857f4d5-2a3a-4cf2-88e4-b4b247e0ad01'
  AND s2.node_type = 'SUBJECT' AND s2.entity_id = '8de8e0fb-3b40-4768-bb74-bbf0eb64c488'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Rajesh → Lakshmi Narayan (transport route link)
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, is_inferred, confidence, strength, evidence_count, first_seen_at, last_seen_at)
SELECT s1.node_id, s2.node_id, 'ASSOCIATE', TRUE, 60, 50, 1, '2024-09-01', '2025-08-15'
FROM network_node s1, network_node s2
WHERE s1.node_type = 'SUBJECT' AND s1.entity_id = 'e857f4d5-2a3a-4cf2-88e4-b4b247e0ad01'
  AND s2.node_type = 'SUBJECT' AND s2.entity_id = '15e83705-e82d-4e93-a565-2ba3c5bee524'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Cross-cluster: Rajesh → Balwinder (inter-gang contact)
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, is_inferred, confidence, strength, evidence_count, first_seen_at, last_seen_at)
SELECT s1.node_id, s2.node_id, 'ASSOCIATE', TRUE, 70, 60, 4, '2024-01-01', '2026-01-15'
FROM network_node s1, network_node s2
WHERE s1.node_type = 'SUBJECT' AND s1.entity_id = 'e857f4d5-2a3a-4cf2-88e4-b4b247e0ad01'
  AND s2.node_type = 'SUBJECT' AND s2.entity_id = '773a4d62-53d8-4d9d-b940-20c8844ca781'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 17: SUPPLIER/BUYER edges
-- ═══════════════════════════════════════════════════════════════════════

-- Irfan → Rajesh (SUPPLIER — Irfan supplies to Rajesh for distribution)
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, is_inferred, confidence, strength, evidence_count, first_seen_at, last_seen_at)
SELECT s1.node_id, s2.node_id, 'SUPPLIER', TRUE, 90, 90, 4, '2023-06-01', '2026-03-10'
FROM network_node s1, network_node s2
WHERE s1.node_type = 'SUBJECT' AND s1.entity_id = '8d0b8037-4d7c-4598-a6ff-2d5a1cc8141f'
  AND s2.node_type = 'SUBJECT' AND s2.entity_id = 'e857f4d5-2a3a-4cf2-88e4-b4b247e0ad01'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Balwinder → Anil Kumar (SUPPLIER — cross-border supply)
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, is_inferred, confidence, strength, evidence_count, first_seen_at, last_seen_at)
SELECT s1.node_id, s2.node_id, 'SUPPLIER', TRUE, 80, 75, 2, '2024-05-10', '2026-01-01'
FROM network_node s1, network_node s2
WHERE s1.node_type = 'SUBJECT' AND s1.entity_id = '773a4d62-53d8-4d9d-b940-20c8844ca781'
  AND s2.node_type = 'SUBJECT' AND s2.entity_id = '7c41991b-238a-401a-8d1f-e2872272a6fe'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 18: CO_LOCATED edges (shared addresses)
-- ═══════════════════════════════════════════════════════════════════════

-- Irfan ↔ Rajesh share Harike hideout area (inferred from sightings)
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, is_inferred, confidence, strength, evidence_count, first_seen_at, last_seen_at)
SELECT s1.node_id, s2.node_id, 'CO_LOCATED', TRUE, 75, 65, 3, '2025-02-01', '2026-01-15'
FROM network_node s1, network_node s2
WHERE s1.node_type = 'SUBJECT' AND s1.entity_id = '8d0b8037-4d7c-4598-a6ff-2d5a1cc8141f'
  AND s2.node_type = 'SUBJECT' AND s2.entity_id = 'e857f4d5-2a3a-4cf2-88e4-b4b247e0ad01'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- Balwinder ↔ Paramjit co-located at Hussainiwala border area
INSERT INTO network_edge (from_node_id, to_node_id, edge_type, is_inferred, confidence, strength, evidence_count, first_seen_at, last_seen_at)
SELECT s1.node_id, s2.node_id, 'CO_LOCATED', TRUE, 80, 70, 4, '2024-01-01', '2026-02-20'
FROM network_node s1, network_node s2
WHERE s1.node_type = 'SUBJECT' AND s1.entity_id = '773a4d62-53d8-4d9d-b940-20c8844ca781'
  AND s2.node_type = 'SUBJECT' AND s2.entity_id = 'f360d26f-fac4-4c11-8fed-50402885697a'
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;


COMMIT;
