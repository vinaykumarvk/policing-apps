-- ============================================================================
-- Comprehensive Subject Profile Data Enrichment
-- Seeds ALL remaining empty fields across all 20 subjects.
-- Some fields are intentionally left NULL (marked N/A) to reflect real-world
-- data gaps — not every subject has every document or data point.
-- Run AFTER seed-dashboard.sql and seed-crime-history.sql
-- Usage: psql $DOPAMS_DATABASE_URL -f scripts/seed-subject-comprehensive.sql
-- ============================================================================

DO $$
DECLARE
  v_irfan       UUID;
  v_balwinder   UUID;
  v_rajesh      UUID;
  v_ranjit      UUID;
  v_mohinder    UUID;
  v_anil        UUID;
  v_sanjay      UUID;
  v_paramjit    UUID;
  v_pradeep     UUID;
  v_deepak      UUID;
  v_gurpreet    UUID;
  v_ajay        UUID;
  v_lakshmi     UUID;
  v_vikram      UUID;
  v_sukhwinder  UUID;
  v_sunita      UUID;
  v_harpreet_d  UUID;
  v_parminder   UUID;
  v_kamaljeet   UUID;
  v_neha        UUID;
BEGIN

  -- ===== Resolve subject IDs =====
  SELECT subject_id INTO v_irfan      FROM subject_profile WHERE full_name ILIKE '%Mohammed Irfan%' LIMIT 1;
  SELECT subject_id INTO v_balwinder  FROM subject_profile WHERE full_name ILIKE '%Balwinder Singh%' LIMIT 1;
  SELECT subject_id INTO v_rajesh     FROM subject_profile WHERE full_name ILIKE '%Rajesh Kumar%' LIMIT 1;
  SELECT subject_id INTO v_ranjit     FROM subject_profile WHERE full_name ILIKE '%Ranjit Singh Mann%' LIMIT 1;
  SELECT subject_id INTO v_mohinder   FROM subject_profile WHERE full_name ILIKE '%Mohinder Pal%' LIMIT 1;
  SELECT subject_id INTO v_anil       FROM subject_profile WHERE full_name ILIKE '%Anil Kumar%' LIMIT 1;
  SELECT subject_id INTO v_sanjay     FROM subject_profile WHERE full_name ILIKE '%Sanjay Patel%' LIMIT 1;
  SELECT subject_id INTO v_paramjit   FROM subject_profile WHERE full_name ILIKE '%Paramjit Singh Brar%' LIMIT 1;
  SELECT subject_id INTO v_pradeep    FROM subject_profile WHERE full_name ILIKE '%Pradeep Sharma%' LIMIT 1;
  SELECT subject_id INTO v_deepak     FROM subject_profile WHERE full_name ILIKE '%Deepak Verma%' LIMIT 1;
  SELECT subject_id INTO v_gurpreet   FROM subject_profile WHERE full_name ILIKE '%Gurpreet Singh%' LIMIT 1;
  SELECT subject_id INTO v_ajay       FROM subject_profile WHERE full_name ILIKE '%Ajay Thakur%' LIMIT 1;
  SELECT subject_id INTO v_lakshmi    FROM subject_profile WHERE full_name ILIKE '%Lakshmi Narayan%' LIMIT 1;
  SELECT subject_id INTO v_vikram     FROM subject_profile WHERE full_name ILIKE '%Vikram Chauhan%' LIMIT 1;
  SELECT subject_id INTO v_sukhwinder FROM subject_profile WHERE full_name ILIKE '%Sukhwinder Kaur%' LIMIT 1;
  SELECT subject_id INTO v_sunita     FROM subject_profile WHERE full_name ILIKE '%Sunita Devi%' LIMIT 1;
  SELECT subject_id INTO v_harpreet_d FROM subject_profile WHERE full_name ILIKE '%Harpreet Kaur Dhillon%' LIMIT 1;
  SELECT subject_id INTO v_parminder  FROM subject_profile WHERE full_name ILIKE '%Parminder Kaur%' LIMIT 1;
  SELECT subject_id INTO v_kamaljeet  FROM subject_profile WHERE full_name ILIKE '%Kamaljeet Kaur%' LIMIT 1;
  SELECT subject_id INTO v_neha       FROM subject_profile WHERE full_name ILIKE '%Neha Gupta%' LIMIT 1;

  -- ============================================================================
  -- 1. HIGH-THREAT SUBJECTS — Mohammed Irfan (comprehensive fill)
  -- ============================================================================
  UPDATE subject_profile SET
    identifiers = '{
      "aadhaarHash": "XXXX-XXXX-4821",
      "panNumber": "ABCPK1234F",
      "passportNumber": "J87654321",
      "voterId": "PB/04/215/678901"
    }'::jsonb,
    crime_number = 'FIR-44/2024',
    ration_card_number = 'PB-TT-2018-00456',
    passport_details = '{"number":"J87654321","issue_date":"2015-03-10","expiry_date":"2025-03-09","place_of_issue":"Amritsar RPO","status":"IMPOUNDED"}'::jsonb,
    visa_details = '{"type":"TOURIST","country":"UAE","issue_date":"2018-06-15","expiry_date":"2019-06-14","status":"EXPIRED"}'::jsonb,
    driving_license_details = '{"number":"PB0420120045678","issue_date":"2012-04-20","expiry_date":"2032-04-19","vehicle_class":"LMV","status":"ACTIVE"}'::jsonb,
    vehicle_rc_details = '[{"registration":"PB-04-AX-1234","vehicle":"Toyota Fortuner","year":2021,"status":"SEIZED"}]'::jsonb,
    bank_account_details = '[{"bank":"Punjab National Bank","branch":"Tarn Taran","account":"XXXXX6789","type":"SAVINGS","status":"FROZEN"},{"bank":"State Bank of India","branch":"Amritsar","account":"XXXXX3456","type":"SAVINGS","status":"ACTIVE"}]'::jsonb,
    transaction_mode = 'MIXED',
    bank_statement_available = TRUE,
    cdat_links = ARRAY['CDAT/TT/2023/045','CDAT/AMR/2024/012'],
    dopams_links = ARRAY['DOP-C-2026-000001','DOP-C-2026-000004'],
    social_handles = '[{"platform":"Facebook","handle":"irfan.khan.tt"},{"platform":"Instagram","handle":"irfan_trader82"},{"platform":"Telegram","handle":"@irfan_deals"},{"platform":"Signal","handle":"+91-98140-11111"}]'::jsonb,
    whatsapp_chat_references = ARRAY['WA/TT/2023/089-DUMP','WA/AMR/2024/044-DUMP'],
    social_media_chat_references = ARRAY['TG/TT/2023/CHANNEL-irfan_deals','FB/TT/2023/MSG-irfan.khan'],
    source_document_references = ARRAY['FIR-287/2019','FIR-142/2021','FIR-89/2023','FIR-44/2024','CDR/TT/2023/IRFAN','FSL/TT/2019/1234','FSL/TT/2021/5678'],
    nidaan_id = 'NID-PB-2019-045678',
    cctns_id = 'CCTNS-PB-TT-2019-28701',
    fingerprint_nfn = 'NFN-PB-0456789',
    dna_profile_id = 'DNA-PB-2023-01234',
    jail_name = 'Central Jail, Amritsar',
    speech_pattern = 'Speaks Punjabi with Tarn Taran dialect, switches to Urdu when agitated. Soft-spoken in interrogation.',
    known_associates = '[{"name":"Rajesh Kumar Singh","role":"DISTRIBUTOR"},{"name":"Ranjit Singh Mann","role":"FINANCIER"},{"name":"Balwinder Singh","role":"SUPPLIER"},{"name":"Pradeep Sharma","role":"RETAILER"}]'::jsonb,
    last_seen_at = NOW() - INTERVAL '1 day',
    last_seen_location = 'Amritsar railway station area (CCTV sighting)',
    native_or_permanent_address = 'Village Chohla Sahib, Tarn Taran, Punjab - 143401'
  WHERE subject_id = v_irfan;

  -- ============================================================================
  -- Balwinder Singh — Border smuggling kingpin
  -- ============================================================================
  UPDATE subject_profile SET
    identifiers = '{
      "aadhaarHash": "XXXX-XXXX-9156",
      "passportNumber": "J12345678",
      "voterId": "PB/07/089/123456"
    }'::jsonb,
    crime_number = 'FIR-201/2024',
    passport_details = '{"number":"J12345678","issue_date":"2010-08-15","expiry_date":"2020-08-14","place_of_issue":"Ferozepur RPO","status":"EXPIRED"}'::jsonb,
    -- No visa (never applied) — intentionally NULL
    driving_license_details = '{"number":"PB0720080034567","issue_date":"2008-05-10","expiry_date":"2028-05-09","vehicle_class":"LMV+TRACTOR","status":"SUSPENDED"}'::jsonb,
    vehicle_rc_details = '[{"registration":"PB-07-BQ-5678","vehicle":"Mahindra Scorpio","year":2020,"status":"SEIZED"},{"registration":"PB-07-CK-9012","vehicle":"MF Tractor 241 DI","year":2018,"status":"ACTIVE"}]'::jsonb,
    bank_account_details = '[{"bank":"Punjab & Sind Bank","branch":"Fazilka","account":"XXXXX1234","type":"SAVINGS","status":"FROZEN"},{"bank":"Bank of India","branch":"Abohar","account":"XXXXX5678","type":"CURRENT","status":"FROZEN"}]'::jsonb,
    transaction_mode = 'CASH',
    bank_statement_available = TRUE,
    cdat_links = ARRAY['CDAT/FZK/2022/089','CDAT/MKT/2023/078'],
    dopams_links = ARRAY['DOP-C-2026-000008','DOP-C-2026-000010'],
    social_handles = '[{"platform":"Facebook","handle":"binder.singh.fzk"}]'::jsonb,
    whatsapp_chat_references = ARRAY['WA/FZK/2022/456-DUMP','WA/FZK/2024/201-DUMP'],
    social_media_chat_references = ARRAY['FB/FZK/2022/MSG-binder.singh'],
    source_document_references = ARRAY['FIR-198/2016','FIR-312/2018','FIR-456/2022','FIR-78/2023','FIR-201/2024','FSL/FZK/2016/0901','FSL/FPR/2018/3456','BSF-INTEL/2022/034'],
    interpol_notice_ref = 'IN-NCB-2023/PB/045',
    ncb_reference = 'NCB/PB/2022/DRG-089',
    nidaan_id = 'NID-PB-2016-098765',
    cctns_id = 'CCTNS-PB-FZK-2016-19801',
    fingerprint_nfn = 'NFN-PB-0987654',
    dna_profile_id = 'DNA-PB-2022-05678',
    jail_name = 'Central Jail, Ferozepur',
    speech_pattern = 'Speaks Punjabi (Malwai dialect). Aggressive tone. Known to use coded agricultural terms during phone calls.',
    known_associates = '[{"name":"Paramjit Singh Brar","role":"ENFORCER"},{"name":"Anil Kumar Yadav","role":"DISTRIBUTOR"},{"name":"Ali Raza (Pakistan)","role":"SUPPLIER"},{"name":"Surjit Singh (brother)","role":"ASSOCIATE"}]'::jsonb,
    last_seen_at = NOW() - INTERVAL '2 days',
    last_seen_location = 'Bathinda grain market area (informant tip)',
    native_or_permanent_address = 'Village Hazara Singh Wala, Tehsil Fazilka, Dist Fazilka, Punjab - 152123',
    ration_card_number = 'PB-FZK-2010-00789'
  WHERE subject_id = v_balwinder;

  -- ============================================================================
  -- Rajesh Kumar Singh — Mid-level distributor
  -- ============================================================================
  UPDATE subject_profile SET
    identifiers = '{
      "aadhaarHash": "XXXX-XXXX-3047",
      "panNumber": "DEFRS4567H",
      "drivingLicense": "PB0420190012345",
      "voterId": "PB/04/312/890123"
    }'::jsonb,
    crime_number = 'FIR-334/2024',
    ration_card_number = 'PB-AMR-2015-01234',
    driving_license_details = '{"number":"PB0420190012345","issue_date":"2019-01-15","expiry_date":"2039-01-14","vehicle_class":"LMV+HMV","status":"ACTIVE"}'::jsonb,
    vehicle_rc_details = '[{"registration":"PB-04-BN-5678","vehicle":"Maruti Swift","year":2019,"status":"UNDER SURVEILLANCE"}]'::jsonb,
    bank_account_details = '[{"bank":"HDFC Bank","branch":"Katra Sher Singh, Amritsar","account":"XXXXX9012","type":"CURRENT","status":"ACTIVE"}]'::jsonb,
    transaction_mode = 'MIXED',
    bank_statement_available = TRUE,
    cdat_links = ARRAY['CDAT/AMR/2023/089'],
    dopams_links = ARRAY['DOP-C-2026-000001'],
    social_handles = '[{"platform":"Instagram","handle":"rajesh_transport"},{"platform":"WhatsApp Business","handle":"+91-98765-43210"}]'::jsonb,
    whatsapp_chat_references = ARRAY['WA/AMR/2023/089-DUMP'],
    source_document_references = ARRAY['FIR-561/2020','FIR-89/2023','FIR-334/2024','CDR/AMR/2023/RAJESH','FSL/AMR/2020/4567'],
    cctns_id = 'CCTNS-PB-AMR-2020-56101',
    nidaan_id = 'NID-PB-2020-034567',
    fingerprint_nfn = 'NFN-PB-0345678',
    known_associates = '[{"name":"Mohammed Irfan","role":"WHOLESALER"},{"name":"Pradeep Sharma","role":"RETAILER"},{"name":"Gurpreet Singh Sidhu","role":"RETAILER"}]'::jsonb,
    last_seen_at = NOW() - INTERVAL '1 day',
    last_seen_location = 'GT Road near Amritsar (ANPR camera)',
    native_or_permanent_address = '127, Katra Sher Singh, Amritsar, Punjab - 143001',
    known_languages = '["Punjabi","Hindi","English (basic)"]'::jsonb,
    email_addresses = '["rajesh.transport.amr@gmail.com"]'::jsonb
  WHERE subject_id = v_rajesh;

  -- ============================================================================
  -- Ranjit Singh Mann — Financier
  -- ============================================================================
  UPDATE subject_profile SET
    identifiers = '{
      "aadhaarHash": "XXXX-XXXX-6783",
      "panNumber": "BCDRS5678G",
      "passportNumber": "K98765432"
    }'::jsonb,
    crime_number = 'FIR-67/2024',
    passport_details = '{"number":"K98765432","issue_date":"2019-11-20","expiry_date":"2029-11-19","place_of_issue":"Jalandhar RPO","status":"SURRENDERED"}'::jsonb,
    visa_details = '{"type":"BUSINESS","country":"Thailand","issue_date":"2020-01-10","expiry_date":"2020-07-09","status":"EXPIRED"}'::jsonb,
    driving_license_details = '{"number":"PB0820100023456","issue_date":"2010-06-15","expiry_date":"2030-06-14","vehicle_class":"LMV","status":"ACTIVE"}'::jsonb,
    vehicle_rc_details = '[{"registration":"PB-08-DM-3456","vehicle":"Honda City","year":2022,"status":"ACTIVE"}]'::jsonb,
    bank_account_details = '[{"bank":"Kotak Mahindra Bank","branch":"Model Town Jalandhar","account":"XXXXX2345","type":"CURRENT","status":"UNDER INVESTIGATION"},{"bank":"ICICI Bank","branch":"Jalandhar","account":"XXXXX6789","type":"SAVINGS","status":"ACTIVE"},{"bank":"Axis Bank","branch":"Delhi","account":"XXXXX0123","type":"CURRENT","status":"FROZEN"}]'::jsonb,
    transaction_mode = 'BANK_TRANSFER',
    bank_statement_available = TRUE,
    cdat_links = ARRAY['CDAT/JLD/2021/112','CDAT/AMR/2023/445'],
    dopams_links = ARRAY['DOP-C-2026-000007'],
    social_handles = '[{"platform":"Instagram","handle":"ranjit_mann_jld"},{"platform":"LinkedIn","handle":"ranjit-mann-gold"}]'::jsonb,
    whatsapp_chat_references = ARRAY['WA/JLD/2023/445-DUMP'],
    source_document_references = ARRAY['FIR-112/2021','FIR-445/2023','FIR-67/2024','ED-REPORT/JLD/2024/001','SFIO/JLD/2024/005'],
    cctns_id = 'CCTNS-PB-JLD-2021-11201',
    nidaan_id = 'NID-PB-2021-056789',
    known_associates = '[{"name":"Mohammed Irfan","role":"WHOLESALER"},{"name":"Sanjay Patel","role":"MONEY_LAUNDERER"},{"name":"Gurtej Singh Mann (son)","role":"ASSOCIATE"}]'::jsonb,
    last_seen_at = NOW() - INTERVAL '3 days',
    last_seen_location = 'Jalandhar Model Town market (CCTV)',
    native_or_permanent_address = 'Village Goraya, Tehsil Phillaur, Dist Jalandhar, Punjab - 144409',
    known_languages = '["Punjabi","Hindi","English"]'::jsonb,
    email_addresses = '["ranjit.mann.gold@gmail.com","mann.enterprises.jld@outlook.com"]'::jsonb,
    speech_pattern = 'Fluent English and Punjabi. Business-like demeanor. Uses corporate jargon to mask drug financing discussions.',
    spouse_name = 'Jaswinder Kaur'
  WHERE subject_id = v_ranjit;

  -- ============================================================================
  -- Mohinder Pal — Courier / distributor
  -- ============================================================================
  UPDATE subject_profile SET
    identifiers = '{
      "aadhaarHash": "XXXX-XXXX-2198",
      "voterId": "PB/08/456/234567"
    }'::jsonb,
    crime_number = 'FIR-456/2024',
    -- No passport (never applied), no PAN (below tax threshold) — realistic gaps
    driving_license_details = '{"number":"PB0820150056789","issue_date":"2015-09-20","expiry_date":"2035-09-19","vehicle_class":"LMV","status":"ACTIVE"}'::jsonb,
    bank_account_details = '[{"bank":"Punjab National Bank","branch":"Basti Danishmandan","account":"XXXXX4567","type":"SAVINGS","status":"ACTIVE"}]'::jsonb,
    transaction_mode = 'CASH',
    bank_statement_available = FALSE,
    cdat_links = ARRAY['CDAT/JLD/2023/123'],
    dopams_links = ARRAY['DOP-C-2026-000004'],
    source_document_references = ARRAY['FIR-234/2019','FIR-567/2021','FIR-123/2023','FIR-456/2024','CDR/JLD/2023/MOHINDER'],
    cctns_id = 'CCTNS-PB-JLD-2019-23401',
    nidaan_id = 'NID-PB-2019-078901',
    fingerprint_nfn = 'NFN-PB-0567890',
    known_associates = '[{"name":"Deepak Verma","role":"RETAILER"},{"name":"Rajesh Kumar Singh","role":"DISTRIBUTOR"}]'::jsonb,
    last_seen_at = NOW() - INTERVAL '1 day',
    last_seen_location = 'Ludhiana bus stand (CCTV)',
    native_or_permanent_address = 'Village Raipur, Tehsil Moga, Dist Moga, Punjab - 142001',
    known_languages = '["Punjabi","Hindi"]'::jsonb,
    spouse_name = 'Kulwinder Kaur',
    speech_pattern = 'Speaks Punjabi (Doabi dialect). Nervous under questioning. Stutters when confronted with evidence.'
  WHERE subject_id = v_mohinder;

  -- ============================================================================
  -- Anil Kumar Yadav — Supplier from border area
  -- ============================================================================
  UPDATE subject_profile SET
    identifiers = '{
      "aadhaarHash": "XXXX-XXXX-7534",
      "voterId": "PB/07/567/345678"
    }'::jsonb,
    crime_number = 'FIR-201/2024',
    -- No passport or PAN — intentionally NA (rural border area subject)
    driving_license_details = '{"number":"PB0720120067890","issue_date":"2012-11-05","expiry_date":"2032-11-04","vehicle_class":"LMV+TRACTOR","status":"ACTIVE"}'::jsonb,
    vehicle_rc_details = '[{"registration":"PB-07-FK-2345","vehicle":"Tata Ace","year":2017,"status":"UNDER SURVEILLANCE"}]'::jsonb,
    bank_account_details = '[{"bank":"State Bank of India","branch":"Abohar","account":"XXXXX8901","type":"SAVINGS","status":"ACTIVE"}]'::jsonb,
    transaction_mode = 'CASH',
    bank_statement_available = TRUE,
    cdat_links = ARRAY['CDAT/FZK/2022/145'],
    dopams_links = ARRAY['DOP-C-2026-000008'],
    source_document_references = ARRAY['FIR-78/2018','FIR-301/2020','FIR-145/2022','FIR-201/2024','FSL/FZK/2018/1111','FSL/FZK/2020/2222'],
    cctns_id = 'CCTNS-PB-FZK-2018-07801',
    nidaan_id = 'NID-PB-2018-012345',
    fingerprint_nfn = 'NFN-PB-0678901',
    known_associates = '[{"name":"Balwinder Singh","role":"SUPPLIER"},{"name":"Paramjit Singh Brar","role":"ASSOCIATE"}]'::jsonb,
    last_seen_at = NOW() - INTERVAL '5 days',
    last_seen_location = 'Abohar dairy market (informant tip)',
    native_or_permanent_address = 'Ward No. 15, Abohar, Dist Fazilka, Punjab - 152116',
    known_languages = '["Punjabi","Hindi","Rajasthani (basic)"]'::jsonb,
    mother_name = 'Shanti Devi',
    spouse_name = 'Meena Devi',
    speech_pattern = 'Speaks Punjabi with Malwai accent. Uses agricultural metaphors as code.'
  WHERE subject_id = v_anil;

  -- ============================================================================
  -- Sanjay Patel — Money launderer / business front
  -- ============================================================================
  UPDATE subject_profile SET
    identifiers = '{
      "aadhaarHash": "XXXX-XXXX-8245",
      "panNumber": "CEFPP9012J",
      "passportNumber": "L45678901"
    }'::jsonb,
    crime_number = 'FIR-890/2022',
    ration_card_number = NULL,
    passport_details = '{"number":"L45678901","issue_date":"2018-02-28","expiry_date":"2028-02-27","place_of_issue":"Ludhiana RPO","status":"SURRENDERED"}'::jsonb,
    visa_details = '{"type":"BUSINESS","country":"Hong Kong","issue_date":"2019-03-15","expiry_date":"2020-03-14","status":"EXPIRED"}'::jsonb,
    driving_license_details = '{"number":"PB1320180078901","issue_date":"2018-07-10","expiry_date":"2038-07-09","vehicle_class":"LMV","status":"ACTIVE"}'::jsonb,
    vehicle_rc_details = '[{"registration":"PB-13-EN-7890","vehicle":"Hyundai Creta","year":2023,"status":"ACTIVE"}]'::jsonb,
    bank_account_details = '[{"bank":"ICICI Bank","branch":"Dugri Road Ludhiana","account":"XXXXX5678","type":"CURRENT","status":"FROZEN"},{"bank":"Yes Bank","branch":"Industrial Area Ludhiana","account":"XXXXX9012","type":"CURRENT","status":"FROZEN"},{"bank":"HDFC Bank","branch":"Connaught Place Delhi","account":"XXXXX3456","type":"SAVINGS","status":"UNDER INVESTIGATION"}]'::jsonb,
    transaction_mode = 'BANK_TRANSFER',
    bank_statement_available = TRUE,
    dopams_links = ARRAY['DOP-C-2026-000007'],
    social_handles = '[{"platform":"Facebook","handle":"sanjay.patel.ldh"},{"platform":"LinkedIn","handle":"sanjay-patel-textiles"}]'::jsonb,
    source_document_references = ARRAY['FIR-890/2022','FIR-445/2023','ED-REPORT/LDH/2023/005','SFIO/LDH/2023/012','ROC/COMPANY/LDH/2023/045'],
    cctns_id = 'CCTNS-PB-LDH-2022-89001',
    known_associates = '[{"name":"Ranjit Singh Mann","role":"FINANCIER"},{"name":"Mohammed Irfan","role":"WHOLESALER"}]'::jsonb,
    last_seen_at = NOW() - INTERVAL '4 days',
    last_seen_location = 'Industrial Area-B, Ludhiana (surveillance log)',
    native_or_permanent_address = 'B-45, Vastrapur, Ahmedabad, Gujarat - 380015',
    known_languages = '["Hindi","English","Gujarati","Punjabi"]'::jsonb,
    email_addresses = '["sanjay.patel.textiles@gmail.com","info@pateltexports.com"]'::jsonb,
    spouse_name = 'Meera Patel',
    speech_pattern = 'Fluent English and Hindi. Very composed. Uses business terminology. Demands lawyer presence immediately upon questioning.'
  WHERE subject_id = v_sanjay;

  -- ============================================================================
  -- Paramjit Singh Brar — Gang enforcer
  -- ============================================================================
  UPDATE subject_profile SET
    identifiers = '{
      "aadhaarHash": "XXXX-XXXX-5312",
      "voterId": "PB/04/123/456789"
    }'::jsonb,
    crime_number = 'FIR-78/2023',
    -- No passport, no PAN — realistic for rural enforcer
    driving_license_details = '{"number":"PB0720100045678","issue_date":"2010-03-25","expiry_date":"2030-03-24","vehicle_class":"LMV+TRACTOR","status":"ACTIVE"}'::jsonb,
    bank_account_details = '[{"bank":"Punjab & Sind Bank","branch":"Arniwala","account":"XXXXX6789","type":"SAVINGS","status":"ACTIVE"}]'::jsonb,
    transaction_mode = 'CASH',
    bank_statement_available = FALSE,
    cdat_links = ARRAY['CDAT/FZK/2022/456'],
    dopams_links = ARRAY['DOP-C-2026-000008'],
    source_document_references = ARRAY['FIR-198/2016','FIR-456/2022','FIR-78/2023','CDR/FZK/2023/PARAMJIT'],
    cctns_id = 'CCTNS-PB-FZK-2016-19802',
    nidaan_id = 'NID-PB-2016-098766',
    fingerprint_nfn = 'NFN-PB-0789012',
    known_associates = '[{"name":"Balwinder Singh","role":"BOSS"},{"name":"Anil Kumar Yadav","role":"DISTRIBUTOR"}]'::jsonb,
    last_seen_at = NOW() - INTERVAL '6 days',
    last_seen_location = 'Near Fazilka border post (field observation)',
    native_or_permanent_address = 'Village Arniwala, Tehsil Fazilka, Punjab - 152123',
    known_languages = '["Punjabi"]'::jsonb,
    spouse_name = 'Harjinder Kaur',
    speech_pattern = 'Speaks only Punjabi. Aggressive and confrontational. Refuses to cooperate during interrogation.'
  WHERE subject_id = v_paramjit;

  -- ============================================================================
  -- MEDIUM-THREAT SUBJECTS — Fill remaining gaps
  -- ============================================================================

  -- Pradeep Sharma — Street-level pusher
  UPDATE subject_profile SET
    identifiers = '{"aadhaarHash": "XXXX-XXXX-1456"}'::jsonb,
    crime_number = 'FIR-234/2024',
    -- No passport, no PAN, no DL — low socio-economic status, realistic
    bank_account_details = '[{"bank":"India Post Payments Bank","branch":"Sultanpuri","account":"XXXXX0123","type":"SAVINGS","status":"ACTIVE"}]'::jsonb,
    transaction_mode = 'CASH',
    bank_statement_available = FALSE,
    source_document_references = ARRAY['FIR-678/2021','FIR-234/2024','FSL/AMR/2021/5555'],
    cctns_id = 'CCTNS-PB-AMR-2021-67801',
    known_associates = '[{"name":"Rajesh Kumar Singh","role":"DISTRIBUTOR"},{"name":"Sunita Devi","role":"FACILITATOR"}]'::jsonb,
    last_seen_at = NOW() - INTERVAL '10 days',
    last_seen_location = 'Sultanpuri market area, Amritsar',
    native_or_permanent_address = 'Gali Mohalla Sultanpuri, Amritsar, Punjab - 143001',
    known_languages = '["Punjabi","Hindi"]'::jsonb,
    marital_status = 'UNMARRIED',
    speech_pattern = 'Speaks Punjabi. Evasive and restless during questioning.'
  WHERE subject_id = v_pradeep;

  -- Deepak Verma — District-level retailer
  UPDATE subject_profile SET
    identifiers = '{"aadhaarHash": "XXXX-XXXX-2567"}'::jsonb,
    crime_number = 'FIR-890/2024',
    driving_license_details = '{"number":"PB0820200089012","issue_date":"2020-08-15","expiry_date":"2040-08-14","vehicle_class":"MCWG+LMV","status":"ACTIVE"}'::jsonb,
    bank_account_details = '[{"bank":"HDFC Bank","branch":"Nakodar","account":"XXXXX3456","type":"SAVINGS","status":"ACTIVE"}]'::jsonb,
    transaction_mode = 'UPI',
    bank_statement_available = FALSE,
    source_document_references = ARRAY['FIR-445/2022','FIR-890/2024','FSL/JLD/2022/6666'],
    cctns_id = 'CCTNS-PB-JLD-2022-44501',
    known_associates = '[{"name":"Mohinder Pal","role":"SUPPLIER"}]'::jsonb,
    last_seen_at = NOW() - INTERVAL '8 days',
    last_seen_location = 'Nakodar market area, Jalandhar',
    native_or_permanent_address = 'Mohalla Guru Nanak Nagar, Nakodar, Jalandhar, Punjab - 144040',
    known_languages = '["Punjabi","Hindi"]'::jsonb,
    marital_status = 'UNMARRIED',
    mother_name = 'Sunita Verma',
    email_addresses = '["deepak.verma91@gmail.com"]'::jsonb,
    speech_pattern = NULL -- N/A: no detailed interrogation conducted yet
  WHERE subject_id = v_deepak;

  -- Gurpreet Singh Sidhu — Low-level distributor
  UPDATE subject_profile SET
    identifiers = '{"aadhaarHash": "XXXX-XXXX-3678"}'::jsonb,
    crime_number = 'FIR-123/2023',
    driving_license_details = '{"number":"PB0420180090123","issue_date":"2018-11-20","expiry_date":"2038-11-19","vehicle_class":"MCWG+LMV","status":"ACTIVE"}'::jsonb,
    vehicle_rc_details = '[{"registration":"PB-08-GL-6789","vehicle":"Bajaj Auto Rickshaw","year":2020,"status":"ACTIVE"}]'::jsonb,
    transaction_mode = 'CASH',
    bank_statement_available = FALSE,
    source_document_references = ARRAY['FIR-123/2023','CDR/AMR/2023/GURPREET'],
    cctns_id = 'CCTNS-PB-AMR-2023-12301',
    known_associates = '[{"name":"Rajesh Kumar Singh","role":"DISTRIBUTOR"}]'::jsonb,
    native_or_permanent_address = 'Village Baba Bakala, Dist Amritsar, Punjab - 143201',
    known_languages = '["Punjabi","Hindi"]'::jsonb,
    marital_status = 'MARRIED',
    spouse_name = 'Simran Kaur',
    mother_name = 'Manjit Kaur'
  WHERE subject_id = v_gurpreet;

  -- Ajay Thakur — Peripheral gang member
  UPDATE subject_profile SET
    identifiers = '{"aadhaarHash": "XXXX-XXXX-4789"}'::jsonb,
    -- No crime_number yet (SUSPECT status, not accused)
    transaction_mode = 'CASH',
    source_document_references = ARRAY['FIR-78/2023'],
    cctns_id = 'CCTNS-PB-MKT-2023-07801',
    known_associates = '[{"name":"Paramjit Singh Brar","role":"BOSS"}]'::jsonb,
    native_or_permanent_address = 'Village Malout, Dist Muktsar, Punjab - 152107',
    known_languages = '["Punjabi","Hindi"]'::jsonb,
    marital_status = 'MARRIED',
    spouse_name = 'Rani Thakur',
    mother_name = 'Savitri Devi'
  WHERE subject_id = v_ajay;

  -- Lakshmi Narayan — Long-haul courier
  UPDATE subject_profile SET
    identifiers = '{"aadhaarHash": "XXXX-XXXX-5890"}'::jsonb,
    crime_number = 'FIR-567/2022',
    driving_license_details = '{"number":"PB1120100034567","issue_date":"2010-02-10","expiry_date":"2030-02-09","vehicle_class":"LMV+HMV","status":"ACTIVE"}'::jsonb,
    vehicle_rc_details = '[{"registration":"PB-11-HM-0123","vehicle":"Ashok Leyland Ecomet","year":2019,"status":"UNDER SURVEILLANCE"}]'::jsonb,
    bank_account_details = '[{"bank":"Punjab National Bank","branch":"Bathinda","account":"XXXXX7890","type":"SAVINGS","status":"ACTIVE"}]'::jsonb,
    transaction_mode = 'CASH',
    bank_statement_available = FALSE,
    source_document_references = ARRAY['FIR-567/2022','FSL/BTH/2022/7777','CDR/BTH/2022/LAKSHMI'],
    cctns_id = 'CCTNS-PB-BTH-2022-56701',
    known_associates = '[{"name":"Balwinder Singh","role":"SUPPLIER"},{"name":"Anil Kumar Yadav","role":"DISTRIBUTOR"}]'::jsonb,
    last_seen_at = NOW() - INTERVAL '3 days',
    last_seen_location = 'Bathinda bypass toll (ANPR camera)',
    native_or_permanent_address = 'Gali No. 3, Bathinda, Punjab - 151001',
    known_languages = '["Punjabi","Hindi"]'::jsonb,
    marital_status = 'MARRIED',
    spouse_name = 'Shanti Devi',
    mother_name = 'Kamla Devi',
    speech_pattern = 'Speaks Hindi with UP accent. Cooperative when confronted with evidence.'
  WHERE subject_id = v_lakshmi;

  -- Vikram Chauhan — Vehicle modifier / facilitator
  UPDATE subject_profile SET
    identifiers = '{"aadhaarHash": "XXXX-XXXX-6901"}'::jsonb,
    driving_license_details = '{"number":"PB0820160045678","issue_date":"2016-04-12","expiry_date":"2036-04-11","vehicle_class":"MCWG+LMV","status":"ACTIVE"}'::jsonb,
    bank_account_details = '[{"bank":"State Bank of India","branch":"Industrial Area Jalandhar","account":"XXXXX1234","type":"SAVINGS","status":"ACTIVE"}]'::jsonb,
    transaction_mode = 'CASH',
    bank_statement_available = FALSE,
    source_document_references = ARRAY['FIR-890/2023'],
    cctns_id = 'CCTNS-PB-JLD-2023-89001',
    native_or_permanent_address = 'Mohalla Raghunath Nagar, Industrial Area, Jalandhar, Punjab - 144004',
    known_languages = '["Punjabi","Hindi"]'::jsonb,
    marital_status = 'MARRIED',
    spouse_name = 'Neelam Chauhan',
    mother_name = 'Santosh Chauhan',
    speech_pattern = NULL -- N/A: not formally interrogated
  WHERE subject_id = v_vikram;

  -- Sukhwinder Kaur — Courier for Balwinder gang
  UPDATE subject_profile SET
    identifiers = '{"aadhaarHash": "XXXX-XXXX-7012"}'::jsonb,
    crime_number = 'FIR-345/2023',
    -- No passport, no DL, no PAN — rural woman with limited documentation
    bank_account_details = '[{"bank":"Punjab National Bank","branch":"Ferozepur","account":"XXXXX5678","type":"JAN_DHAN","status":"ACTIVE"}]'::jsonb,
    transaction_mode = 'CASH',
    bank_statement_available = FALSE,
    source_document_references = ARRAY['FIR-345/2023','FSL/FPR/2023/8888'],
    cctns_id = 'CCTNS-PB-FPR-2023-34501',
    known_associates = '[{"name":"Balwinder Singh","role":"HANDLER"}]'::jsonb,
    native_or_permanent_address = 'Village Hussainiwala, Dist Ferozepur, Punjab - 152002',
    known_languages = '["Punjabi"]'::jsonb,
    marital_status = 'WIDOWED',
    mother_name = 'Harbans Kaur (deceased)',
    speech_pattern = 'Speaks only Punjabi. Extremely reluctant to provide information. Claims ignorance of contents she was carrying.'
  WHERE subject_id = v_sukhwinder;

  -- Sunita Devi — Acquitted facilitator
  UPDATE subject_profile SET
    identifiers = '{"aadhaarHash": "XXXX-XXXX-8123"}'::jsonb,
    ration_card_number = 'PB-AMR-2012-05678',
    -- No passport, no DL, no PAN
    transaction_mode = 'CASH',
    source_document_references = ARRAY['FIR-678/2021'],
    cctns_id = 'CCTNS-PB-AMR-2021-67802',
    native_or_permanent_address = 'Mohalla Sultanpuri, Amritsar, Punjab - 143001',
    known_languages = '["Punjabi","Hindi"]'::jsonb,
    marital_status = 'SEPARATED',
    mother_name = 'Parkash Devi'
  WHERE subject_id = v_sunita;

  -- ============================================================================
  -- LOW-THREAT / DRAFT SUBJECTS — Sparse data (realistic)
  -- ============================================================================

  -- Harpreet Kaur Dhillon — Teacher, suspected property facilitator
  UPDATE subject_profile SET
    identifiers = '{"aadhaarHash": "XXXX-XXXX-9234", "panNumber": "GHIJK5678L"}'::jsonb,
    driving_license_details = '{"number":"PB0420170056789","issue_date":"2017-09-10","expiry_date":"2037-09-09","vehicle_class":"MCWG+LMV","status":"ACTIVE"}'::jsonb,
    bank_account_details = '[{"bank":"HDFC Bank","branch":"Lawrence Road Amritsar","account":"XXXXX9012","type":"SAVINGS","status":"ACTIVE"}]'::jsonb,
    transaction_mode = 'UPI',
    -- No criminal records, no source docs yet (only under surveillance)
    source_document_references = ARRAY['INTEL/AMR/2025/SURV-DHI-001'],
    native_or_permanent_address = 'House No. 234, Model Town, Amritsar, Punjab - 143001',
    known_languages = '["Punjabi","Hindi","English"]'::jsonb,
    marital_status = 'UNMARRIED',
    mother_name = 'Balwinder Kaur',
    email_addresses = '["harpreet.dhillon.teacher@gmail.com"]'::jsonb,
    mobile_numbers = '["8556677889"]'::jsonb,
    occupation = 'Teacher (Government School)',
    cdr_status = 'NOT_REQUESTED'
  WHERE subject_id = v_harpreet_d;

  -- Parminder Kaur — Spouse of Rajesh (peripheral involvement unclear)
  UPDATE subject_profile SET
    identifiers = '{"aadhaarHash": "XXXX-XXXX-0345"}'::jsonb,
    ration_card_number = 'PB-AMR-2015-01235',
    -- No passport, no DL, no PAN — homemaker
    native_or_permanent_address = '127, Katra Sher Singh, Amritsar, Punjab - 143001',
    known_languages = '["Punjabi","Hindi"]'::jsonb,
    marital_status = 'MARRIED',
    spouse_name = 'Rajesh Kumar Singh',
    mother_name = 'Gurdev Kaur',
    mobile_numbers = '["7001234567"]'::jsonb,
    cdr_status = 'NOT_REQUESTED'
  WHERE subject_id = v_parminder;

  -- Kamaljeet Kaur — Spouse of Balwinder
  UPDATE subject_profile SET
    identifiers = '{"aadhaarHash": "XXXX-XXXX-1456"}'::jsonb,
    ration_card_number = 'PB-FZK-2010-00790',
    native_or_permanent_address = 'Village Hazara Singh Wala, Tehsil Fazilka, Punjab - 152123',
    known_languages = '["Punjabi"]'::jsonb,
    marital_status = 'MARRIED',
    spouse_name = 'Balwinder Singh',
    mother_name = 'Surjit Kaur',
    mobile_numbers = '["8990011223"]'::jsonb,
    cdr_status = 'NOT_REQUESTED'
  WHERE subject_id = v_kamaljeet;

  -- Neha Gupta — Student, minimal involvement suspected
  UPDATE subject_profile SET
    identifiers = '{"aadhaarHash": "XXXX-XXXX-2567", "panNumber": "HIJKL3456M"}'::jsonb,
    -- No passport, no DL
    bank_account_details = '[{"bank":"State Bank of India","branch":"Ludhiana","account":"XXXXX6789","type":"SAVINGS","status":"ACTIVE"}]'::jsonb,
    transaction_mode = 'UPI',
    native_or_permanent_address = '45-B, Sarabha Nagar, Ludhiana, Punjab - 141001',
    known_languages = '["Hindi","English","Punjabi"]'::jsonb,
    marital_status = 'UNMARRIED',
    mother_name = 'Sunita Gupta',
    email_addresses = '["neha.gupta96@outlook.com"]'::jsonb,
    mobile_numbers = '["8223344557"]'::jsonb,
    social_handles = '[{"platform":"Instagram","handle":"neha_gupta96"},{"platform":"Snapchat","handle":"neha_g96"}]'::jsonb,
    cdr_status = 'NOT_REQUESTED'
  WHERE subject_id = v_neha;

  -- ============================================================================
  -- 2. UPI ACCOUNTS (normalized entity table)
  -- ============================================================================

  INSERT INTO upi_account (vpa, provider_app, transaction_volume, is_active)
  SELECT v.vpa, v.app, v.vol, v.active
  FROM (VALUES
    ('irfan82@ybl',              'PhonePe',    250000,  TRUE),
    ('rajesh.transport@paytm',   'Paytm',      180000,  TRUE),
    ('deepak91@upi',             'BHIM',        45000,  TRUE),
    ('sanjay.patel@icici',       'iMobile',    500000,  TRUE),
    ('ranjit.mann@kotak',        'Kotak UPI',  350000,  TRUE),
    ('neha96@ybl',               'PhonePe',     15000,  TRUE)
  ) AS v(vpa, app, vol, active)
  ON CONFLICT (vpa) DO NOTHING;

  INSERT INTO subject_upi_link (subject_id, upi_id, relationship, confidence, source_system)
  SELECT s.sid, u.upi_id, 'OWNER', 90, 'FINANCIAL_INTEL'
  FROM (VALUES
    (v_irfan, 'irfan82@ybl'),
    (v_rajesh, 'rajesh.transport@paytm'),
    (v_deepak, 'deepak91@upi'),
    (v_sanjay, 'sanjay.patel@icici'),
    (v_ranjit, 'ranjit.mann@kotak'),
    (v_neha, 'neha96@ybl')
  ) AS s(sid, vpa)
  JOIN upi_account u ON u.vpa = s.vpa
  ON CONFLICT DO NOTHING;

  -- ============================================================================
  -- 3. CRYPTO WALLETS (only for tech-savvy subjects)
  -- ============================================================================

  INSERT INTO crypto_wallet (wallet_address, currency, wallet_type, exchange_name, exchange_kyc_name, is_active)
  SELECT v.addr, v.curr, v.wtype, v.exch, v.kyc, v.active
  FROM (VALUES
    ('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 'BTC',  'EXCHANGE', 'WazirX',  'Sanjay R Patel', TRUE),
    ('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18', 'ETH',  'COLD',     NULL,       NULL,             TRUE),
    ('TN3W4H6rK2ce4vX9Fd8EL2NuZGjZj5LGTS',         'USDT', 'EXCHANGE', 'Binance',  NULL,             TRUE)
  ) AS v(addr, curr, wtype, exch, kyc, active)
  ON CONFLICT (wallet_address, currency) DO NOTHING;

  INSERT INTO subject_crypto_link (subject_id, wallet_id, relationship, confidence, source_system)
  SELECT s.sid, c.wallet_id, 'OWNER', s.conf, 'DARK_WEB_INTEL'
  FROM (VALUES
    (v_sanjay, 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 'BTC',  85),
    (v_sanjay, '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18', 'ETH',  70),
    (v_irfan,  'TN3W4H6rK2ce4vX9Fd8EL2NuZGjZj5LGTS',         'USDT', 60)
  ) AS s(sid, addr, curr, conf)
  JOIN crypto_wallet c ON c.wallet_address = s.addr AND c.currency = s.curr
  ON CONFLICT DO NOTHING;

  -- ============================================================================
  -- 4. BANK ACCOUNTS (normalized entity table — enriched)
  -- ============================================================================

  INSERT INTO bank_account (account_number, ifsc_code, normalized_key, bank_name, branch_name, account_type, account_holder_name, is_joint_account, is_frozen, average_monthly_balance, suspicious_transaction_count, statement_available)
  SELECT v.acct, v.ifsc, v.nkey, v.bank, v.branch, v.atype, v.holder, v.joint, v.frozen, v.bal, v.stxn, v.stmt
  FROM (VALUES
    ('XXXXX6789',    'PUNB0123400', 'PUNB0123400:XXXXX6789',    'Punjab National Bank', 'Tarn Taran',                'SAVINGS', 'Mohammed Irfan',     FALSE, TRUE,  125000, 8,  TRUE),
    ('XXXXX3456',    'SBIN0012345', 'SBIN0012345:XXXXX3456',    'State Bank of India',  'Amritsar',                  'SAVINGS', 'Mohammed Irfan',     FALSE, FALSE,  85000, 3,  TRUE),
    ('XXXXX1234',    'PSIB0021100', 'PSIB0021100:XXXXX1234',    'Punjab & Sind Bank',   'Fazilka',                   'SAVINGS', 'Balwinder Singh',    FALSE, TRUE,  450000, 12, TRUE),
    ('XXXXX5678',    'BKID0007800', 'BKID0007800:XXXXX5678',    'Bank of India',        'Abohar',                    'CURRENT', 'Balwinder Singh',    FALSE, TRUE,  780000, 15, TRUE),
    ('XXXXX9012',    'HDFC0001234', 'HDFC0001234:XXXXX9012',    'HDFC Bank',            'Katra Sher Singh Amritsar', 'CURRENT', 'Rajesh Kumar Singh', FALSE, FALSE, 210000, 5,  TRUE),
    ('XXXXX2345',    'KKBK0004567', 'KKBK0004567:XXXXX2345',    'Kotak Mahindra Bank',  'Model Town Jalandhar',      'CURRENT', 'Ranjit Singh Mann',  FALSE, FALSE, 1500000, 7, TRUE),
    ('XXXXX0123',    'UTIB0002345', 'UTIB0002345:XXXXX0123',    'Axis Bank',            'Connaught Place Delhi',     'CURRENT', 'Ranjit Singh Mann',  FALSE, TRUE,  2800000, 10, TRUE),
    ('XXXXX5678IC',  'ICIC0001234', 'ICIC0001234:XXXXX5678IC',  'ICICI Bank',           'Dugri Road Ludhiana',       'CURRENT', 'Sanjay Patel',       FALSE, TRUE,  3200000, 18, TRUE),
    ('XXXXX8901',    'SBIN0056789', 'SBIN0056789:XXXXX8901',    'State Bank of India',  'Abohar',                    'SAVINGS', 'Anil Kumar Yadav',   FALSE, FALSE,  45000, 2,  TRUE)
  ) AS v(acct, ifsc, nkey, bank, branch, atype, holder, joint, frozen, bal, stxn, stmt)
  ON CONFLICT (normalized_key) DO NOTHING;

  INSERT INTO subject_account_link (subject_id, account_id, relationship, confidence, source_system)
  SELECT s.sid, ba.account_id, 'HOLDER', 95, 'FINANCIAL_INTEL'
  FROM (VALUES
    (v_irfan,     'PUNB0123400:XXXXX6789'),
    (v_irfan,     'SBIN0012345:XXXXX3456'),
    (v_balwinder, 'PSIB0021100:XXXXX1234'),
    (v_balwinder, 'BKID0007800:XXXXX5678'),
    (v_rajesh,    'HDFC0001234:XXXXX9012'),
    (v_ranjit,    'KKBK0004567:XXXXX2345'),
    (v_ranjit,    'UTIB0002345:XXXXX0123'),
    (v_sanjay,    'ICIC0001234:XXXXX5678IC'),
    (v_anil,      'SBIN0056789:XXXXX8901')
  ) AS s(sid, nkey)
  JOIN bank_account ba ON ba.normalized_key = s.nkey
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Comprehensive subject profile seed data inserted successfully.';
END $$;
