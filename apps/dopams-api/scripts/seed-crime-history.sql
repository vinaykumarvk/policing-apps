-- ============================================================================
-- Comprehensive Crime History & Entity Seed Data for DOPAMS
-- Seeds: subject enrichment, FIRs, seizures, warrants, family, property,
--        phones, addresses, identities, vehicles, devices, social accounts,
--        location sightings, hawala contacts
-- ============================================================================

DO $$
DECLARE
  -- Subject IDs (looked up by name)
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

  -- Unit IDs
  v_unit_dist1  UUID;
  v_unit_dist2  UUID;
  v_unit_hq     UUID;

  -- Temp FIR IDs for linking seizures/warrants
  v_fir UUID;
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

  -- Resolve unit IDs
  SELECT unit_id INTO v_unit_dist1 FROM organization_unit WHERE code = 'DIST-1' LIMIT 1;
  SELECT unit_id INTO v_unit_dist2 FROM organization_unit WHERE code = 'DIST-2' LIMIT 1;
  SELECT unit_id INTO v_unit_hq    FROM organization_unit WHERE code = 'HQ' LIMIT 1;

  -- ============================================================================
  -- 1. ENRICH SUBJECT PROFILES — Drug Intelligence & Physical Description
  -- ============================================================================

  -- Mohammed Irfan — International heroin trafficker
  UPDATE subject_profile SET
    full_name_local = 'मोहम्मद इरफान',
    father_name = 'Abdul Rashid Khan', mother_name = 'Fatima Begum',
    date_of_birth = '1982-08-15', age = 43,
    place_of_birth = 'Tarn Taran, Punjab',
    build = 'MEDIUM', height_cm = 175, weight_kg = 78,
    eye_color = 'Brown', hair_color = 'Black', facial_hair = 'Full beard, trimmed',
    complexion = 'Wheatish', distinguishing_marks = 'Scar on left forearm, tattoo on right shoulder',
    scars = '[{"location":"Left forearm","description":"3-inch knife scar from 2018 altercation"}]'::jsonb,
    tattoos = '[{"location":"Right shoulder","description":"Eagle tattoo"}]'::jsonb,
    handedness = 'RIGHT', blood_group = 'O+',
    nationality = 'Indian', religion = 'Islam', education = 'Class 10',
    marital_status = 'MARRIED', spouse_name = 'Rubina Begum',
    known_languages = '["Punjabi","Hindi","Urdu"]'::jsonb,
    email_addresses = '["irfan.trader82@gmail.com"]'::jsonb,
    residential_address = 'House No. 45, Gali Peer Wali, Tarn Taran, Punjab',
    native_state = 'Punjab',
    district = 'Tarn Taran', police_station = 'Sadar Tarn Taran',
    primary_drug = 'Heroin (Chitta)',
    drug_types_dealt = ARRAY['Heroin','Chitta','Opium','Pharmaceutical opioids'],
    supply_chain_position = 'WHOLESALER',
    operational_level = 'INTER_STATE',
    territory_description = 'Tarn Taran-Amritsar corridor, receives consignments from border and distributes across Punjab',
    territory_districts = ARRAY['Tarn Taran','Amritsar','Jalandhar','Ludhiana'],
    territory_states = ARRAY['Punjab','Haryana','Himachal Pradesh'],
    typical_quantity = '1-5 kg per consignment',
    quantity_category = 'COMMERCIAL',
    concealment_methods = ARRAY['Modified vehicle fuel tanks','Double-walled suitcases','Agricultural produce loads'],
    transport_routes = '[{"from":"Attari Border","to":"Tarn Taran","mode":"Private car"},{"from":"Tarn Taran","to":"Ludhiana","mode":"Goods truck"}]'::jsonb,
    communication_methods = ARRAY['Encrypted messaging (Signal)','Coded phone calls','In-person meets at dhabas'],
    known_code_words = '{"heroin":"maal","1kg":"ek bori","money":"paisa","police":"mama","delivery":"parcel"}'::jsonb,
    modus_operandi = 'Receives bulk heroin from border contacts, repackages at safe houses, distributes via trusted couriers. Uses multiple SIM cards and frequently changes phones.',
    gang_affiliation = 'Tarn Taran drug syndicate (Irfan-Rajesh network)',
    criminal_history = '["FIR 287/2019 PS Sadar TT — 21/61/85 NDPS convicted","FIR 142/2021 PS Harike — 21C NDPS trial pending","FIR 89/2023 PS Tarn Taran — 21/29 NDPS investigation","FIR 44/2024 PS Amritsar — 3/25 NDPS + 120B IPC investigation"]'::jsonb,
    ndps_history = '["Sec 21 — Possession of commercial quantity heroin","Sec 21C — Financing illicit traffic","Sec 29 — Abetment and conspiracy","Sec 61 — Attempt to commit offences","Sec 85 — Previous conviction enhancement"]'::jsonb,
    section_of_law = ARRAY['21 NDPS','21C NDPS','29 NDPS','61 NDPS','85 NDPS','120B IPC'],
    total_arrests = 5, total_convictions = 1, total_acquittals = 0,
    first_arrested_at = '2019-06-12', last_arrested_at = '2024-01-18',
    is_recidivist = TRUE, custody_status = 'ON_BAIL', bail_status = 'Regular bail in FIR 142/2021',
    is_proclaimed_offender = FALSE, is_habitual_offender = TRUE,
    offender_status = 'ACCUSED', offender_role = ARRAY['WHOLESALER','FINANCIER'],
    drug_procurement_method = 'Cross-border smuggling via Attari-Wagah route and Harike border',
    drug_delivery_method = 'Couriers using modified vehicles, dead drops at highway dhabas',
    cdr_status = 'COMPLETED',
    fit_for_68f = TRUE, fit_for_pitndps_act = TRUE,
    pd_act_details = 'PIT-NDPS order dated 2023-04-15, detained 6 months at Central Jail Amritsar',
    source_system = 'CCTNS',
    extraction_confidence_score = 0.92
  WHERE subject_id = v_irfan;

  -- Balwinder Singh — Border smuggling kingpin
  UPDATE subject_profile SET
    full_name_local = 'ਬਲਵਿੰਦਰ ਸਿੰਘ',
    father_name = 'Gurbachan Singh', mother_name = 'Surjit Kaur',
    date_of_birth = '1978-03-22', age = 48,
    place_of_birth = 'Fazilka, Punjab',
    build = 'LARGE', height_cm = 182, weight_kg = 95,
    eye_color = 'Brown', hair_color = 'Black/Grey', facial_hair = 'Turban, full beard',
    complexion = 'Fair', distinguishing_marks = 'Missing right index finger tip, bullet wound scar on left thigh',
    scars = '[{"location":"Left thigh","description":"Bullet entry wound from 2016 BSF encounter"},{"location":"Right hand","description":"Missing tip of index finger"}]'::jsonb,
    handedness = 'RIGHT', blood_group = 'B+',
    nationality = 'Indian', religion = 'Sikh', caste = 'Jat', education = 'Class 8',
    marital_status = 'MARRIED', spouse_name = 'Kamaljeet Kaur',
    known_languages = '["Punjabi","Hindi"]'::jsonb,
    residential_address = 'Village Hazara Singh Wala, Tehsil Fazilka, Dist Fazilka, Punjab',
    native_state = 'Punjab',
    district = 'Fazilka', police_station = 'Sadar Fazilka',
    primary_drug = 'Heroin',
    drug_types_dealt = ARRAY['Heroin','Opium','Poppy husk','Arms'],
    supply_chain_position = 'DISTRIBUTOR',
    operational_level = 'INTERNATIONAL',
    territory_description = 'Indo-Pak border belt from Fazilka to Ferozepur. Receives smuggled consignments via border throwing/tunnels. Key hub operator.',
    territory_districts = ARRAY['Fazilka','Ferozepur','Muktsar','Bathinda'],
    territory_states = ARRAY['Punjab','Rajasthan'],
    typical_quantity = '5-15 kg per consignment',
    quantity_category = 'LARGE_COMMERCIAL',
    concealment_methods = ARRAY['Underground bunkers near border','Tractor trolleys with hidden compartments','Camel-back transport in desert stretch'],
    transport_routes = '[{"from":"Pakistan border","to":"Fazilka","mode":"Throwing/tunnel"},{"from":"Fazilka","to":"Bathinda","mode":"Tractor trolley"},{"from":"Bathinda","to":"Rajasthan","mode":"Private vehicle"}]'::jsonb,
    communication_methods = ARRAY['Hawala network runners','Pre-paid SIMs (changed weekly)','Meeting at border-area farms'],
    known_code_words = '{"heroin":"atta","opium":"ghee","delivery":"bori","police":"uncle","money":"weight"}'::jsonb,
    modus_operandi = 'Controls border receiving network. Uses farm laborers as first receivers. Multiple underground bunkers for storage. Distributes via trusted gang members. Known for violence against informants.',
    gang_affiliation = 'Balwinder-Paramjit border gang',
    criminal_history = '["FIR 198/2016 PS Fazilka — 21/29 NDPS convicted 10yr RI","FIR 312/2018 PS Ferozepur — 21/61 NDPS convicted 7yr RI","FIR 456/2022 PS Fazilka — 21C/29 NDPS trial pending","FIR 78/2023 PS Muktsar — 25/27 Arms Act + NDPS investigation","FIR 201/2024 PS Abohar — 21/29 NDPS + 120B IPC investigation"]'::jsonb,
    ndps_history = '["Sec 21 — Commercial quantity heroin (convicted twice)","Sec 21C — Financing drug traffic","Sec 29 — Conspiracy (multiple cases)","Sec 61 — Attempt","Sec 85 — Repeat offender enhancement"]'::jsonb,
    section_of_law = ARRAY['21 NDPS','21C NDPS','29 NDPS','61 NDPS','85 NDPS','25 Arms Act','27 Arms Act','120B IPC'],
    total_arrests = 6, total_convictions = 2, total_acquittals = 0,
    first_arrested_at = '2016-09-03', last_arrested_at = '2024-03-10',
    is_recidivist = TRUE, custody_status = 'ON_BAIL',
    bail_status = 'High Court bail in FIR 456/2022, regular bail in FIR 78/2023',
    is_proclaimed_offender = FALSE, is_habitual_offender = TRUE,
    offender_status = 'CONVICTED', offender_role = ARRAY['DISTRIBUTOR','SMUGGLER'],
    drug_procurement_method = 'Cross-border smuggling from Pakistan via throwing and tunnel methods',
    drug_delivery_method = 'Farm workers as first-line couriers, tractor trolleys for bulk transport',
    cdr_status = 'COMPLETED',
    fit_for_68f = TRUE, fit_for_pitndps_act = TRUE,
    pd_act_details = 'PIT-NDPS order dated 2022-08-10, detention 12 months Central Jail Ferozepur. Second PIT-NDPS under consideration.',
    history_sheet_details = 'History sheet opened at PS Fazilka in 2016. Updated 2022.',
    source_system = 'CCTNS',
    extraction_confidence_score = 0.95
  WHERE subject_id = v_balwinder;

  -- Rajesh Kumar Singh — Mid-level distributor
  UPDATE subject_profile SET
    full_name_local = 'ਰਾਜੇਸ਼ ਕੁਮਾਰ ਸਿੰਘ',
    father_name = 'Ram Prasad Singh', mother_name = 'Shanti Devi',
    place_of_birth = 'Amritsar, Punjab',
    build = 'MEDIUM', height_cm = 170, weight_kg = 72,
    eye_color = 'Brown', hair_color = 'Black',
    complexion = 'Dark', handedness = 'RIGHT', blood_group = 'A+',
    nationality = 'Indian', religion = 'Hindu', education = 'BA (dropped out)',
    marital_status = 'MARRIED', spouse_name = 'Parminder Kaur',
    residential_address = '127, Katra Sher Singh, Amritsar, Punjab',
    native_state = 'Punjab',
    district = 'Amritsar', police_station = 'Kotwali Amritsar',
    primary_drug = 'Heroin (Chitta)',
    drug_types_dealt = ARRAY['Heroin','Chitta','Pharmaceutical opioids'],
    supply_chain_position = 'DISTRIBUTOR',
    operational_level = 'INTRA_STATE',
    territory_districts = ARRAY['Amritsar','Tarn Taran','Gurdaspur'],
    territory_states = ARRAY['Punjab'],
    typical_quantity = '100-500g per deal',
    quantity_category = 'COMMERCIAL',
    concealment_methods = ARRAY['Hidden in transport truck cabin','Courier handoffs at bus stands'],
    modus_operandi = 'Receives from Irfan, distributes to street-level pushers. Runs a transport business as front.',
    gang_affiliation = 'Tarn Taran drug syndicate (Irfan-Rajesh network)',
    criminal_history = '["FIR 561/2020 PS Kotwali Amritsar — 21/29 NDPS convicted","FIR 89/2023 PS Tarn Taran — 21 NDPS investigation","FIR 334/2024 PS Amritsar — 22 NDPS investigation"]'::jsonb,
    ndps_history = '["Sec 21 — Commercial quantity heroin","Sec 22 — Psychotropic substances","Sec 29 — Conspiracy"]'::jsonb,
    section_of_law = ARRAY['21 NDPS','22 NDPS','29 NDPS','120B IPC'],
    total_convictions = 1, total_acquittals = 0,
    last_arrested_at = '2024-02-05',
    is_recidivist = TRUE, custody_status = 'ON_BAIL',
    bail_status = 'Regular bail in FIR 89/2023',
    is_habitual_offender = TRUE,
    offender_status = 'ACCUSED', offender_role = ARRAY['DISTRIBUTOR'],
    drug_procurement_method = 'Sourced from Irfan syndicate via pre-arranged meets',
    drug_delivery_method = 'Transport business trucks, trusted couriers',
    cdr_status = 'UNDER_ANALYSIS',
    fit_for_pitndps_act = TRUE,
    source_system = 'CCTNS',
    extraction_confidence_score = 0.88
  WHERE subject_id = v_rajesh;

  -- Ranjit Singh Mann — Financier
  UPDATE subject_profile SET
    full_name_local = 'ਰਣਜੀਤ ਸਿੰਘ ਮਾਨ',
    father_name = 'Kartar Singh Mann', mother_name = 'Harbans Kaur',
    place_of_birth = 'Jalandhar, Punjab',
    build = 'HEAVY', height_cm = 178, weight_kg = 92,
    eye_color = 'Brown', hair_color = 'Grey',
    complexion = 'Fair', handedness = 'RIGHT', blood_group = 'AB+',
    nationality = 'Indian', religion = 'Sikh', caste = 'Jat', education = 'B.Com',
    marital_status = 'MARRIED',
    residential_address = 'Bungalow 22, Model Town, Jalandhar, Punjab',
    native_state = 'Punjab',
    district = 'Jalandhar', police_station = 'Division No. 3 Jalandhar',
    supply_chain_position = 'FINANCIER',
    operational_level = 'INTER_STATE',
    primary_drug = 'Heroin',
    drug_types_dealt = ARRAY['Heroin','Opium'],
    territory_districts = ARRAY['Jalandhar','Amritsar','Ludhiana','Tarn Taran'],
    territory_states = ARRAY['Punjab','Delhi'],
    modus_operandi = 'Provides financing for drug consignments. Uses real estate and gold trading businesses to launder proceeds. Never handles drugs directly.',
    criminal_history = '["FIR 112/2021 PS Div 3 Jalandhar — 21C NDPS + 3 PMLA investigation","FIR 445/2023 PS Amritsar — 29 NDPS co-accused trial pending","FIR 67/2024 PS Jalandhar — PMLA investigation"]'::jsonb,
    ndps_history = '["Sec 21C — Financing illicit drug traffic","Sec 29 — Abetment and criminal conspiracy"]'::jsonb,
    section_of_law = ARRAY['21C NDPS','29 NDPS','3 PMLA','120B IPC'],
    total_convictions = 0, total_acquittals = 0,
    custody_status = 'ON_BAIL',
    bail_status = 'Anticipatory bail in FIR 112/2021',
    is_recidivist = FALSE,
    offender_status = 'ACCUSED', offender_role = ARRAY['FINANCIER'],
    cdr_status = 'COMPLETED',
    fit_for_pitndps_act = TRUE,
    source_system = 'CCTNS',
    extraction_confidence_score = 0.80
  WHERE subject_id = v_ranjit;

  -- Mohinder Pal — Courier / distributor
  UPDATE subject_profile SET
    full_name_local = 'ਮੋਹਿੰਦਰ ਪਾਲ',
    father_name = 'Des Raj', mother_name = 'Parkash Kaur',
    place_of_birth = 'Moga, Punjab',
    build = 'THIN', height_cm = 168, weight_kg = 62,
    eye_color = 'Brown', hair_color = 'Black',
    complexion = 'Dark', handedness = 'LEFT', blood_group = 'B-',
    nationality = 'Indian', religion = 'Hindu', education = 'Class 5',
    marital_status = 'MARRIED',
    residential_address = 'Gali No. 7, Basti Danishmandan, Jalandhar, Punjab',
    native_state = 'Punjab',
    district = 'Jalandhar', police_station = 'Basti Danishmandan',
    primary_drug = 'Heroin (Chitta)',
    drug_types_dealt = ARRAY['Heroin','Chitta','Pharmaceutical tablets'],
    supply_chain_position = 'COURIER',
    operational_level = 'INTRA_STATE',
    territory_districts = ARRAY['Jalandhar','Moga','Ludhiana'],
    concealment_methods = ARRAY['Body concealment','Modified shoes','Food packets'],
    modus_operandi = 'Works as courier between multiple networks. Structures transactions below detection thresholds. Frequently changes routes.',
    criminal_history = '["FIR 234/2019 PS Basti Danishmandan — 21 NDPS convicted 5yr RI","FIR 567/2021 PS Moga — 22 NDPS acquitted","FIR 123/2023 PS Jalandhar — 21/29 NDPS trial pending","FIR 456/2024 PS Ludhiana — 21 NDPS investigation"]'::jsonb,
    ndps_history = '["Sec 21 — Possession heroin","Sec 22 — Psychotropic substances","Sec 29 — Conspiracy"]'::jsonb,
    section_of_law = ARRAY['21 NDPS','22 NDPS','29 NDPS'],
    total_convictions = 1, total_acquittals = 1,
    custody_status = 'FREE',
    is_recidivist = TRUE, is_habitual_offender = TRUE,
    offender_status = 'ACCUSED', offender_role = ARRAY['COURIER','DISTRIBUTOR'],
    cdr_status = 'UNDER_ANALYSIS',
    source_system = 'CCTNS',
    extraction_confidence_score = 0.85
  WHERE subject_id = v_mohinder;

  -- Anil Kumar Yadav — Supplier from border area
  UPDATE subject_profile SET
    full_name_local = 'ਅਨਿਲ ਕੁਮਾਰ ਯਾਦਵ',
    father_name = 'Hari Ram Yadav',
    place_of_birth = 'Abohar, Punjab',
    build = 'MEDIUM', height_cm = 172, weight_kg = 75,
    complexion = 'Wheatish', blood_group = 'O+',
    nationality = 'Indian', religion = 'Hindu', education = 'Class 12',
    marital_status = 'MARRIED',
    residential_address = 'Ward No. 15, Abohar, Dist Fazilka, Punjab',
    native_state = 'Punjab',
    district = 'Fazilka', police_station = 'Abohar',
    primary_drug = 'Heroin',
    drug_types_dealt = ARRAY['Heroin','Poppy husk','Opium'],
    supply_chain_position = 'DISTRIBUTOR',
    operational_level = 'INTRA_STATE',
    territory_districts = ARRAY['Fazilka','Muktsar','Bathinda'],
    modus_operandi = 'Receives from Balwinder gang, distributes in southern Punjab. Uses dairy farm as storage front.',
    criminal_history = '["FIR 78/2018 PS Abohar — 15 NDPS convicted","FIR 301/2020 PS Abohar — 21 NDPS convicted","FIR 145/2022 PS Muktsar — 21/29 NDPS trial pending","FIR 201/2024 PS Abohar — 21 NDPS investigation"]'::jsonb,
    ndps_history = '["Sec 15 — Poppy straw","Sec 21 — Heroin possession","Sec 29 — Conspiracy"]'::jsonb,
    section_of_law = ARRAY['15 NDPS','21 NDPS','29 NDPS'],
    total_convictions = 2, total_acquittals = 0,
    custody_status = 'ON_BAIL',
    is_recidivist = TRUE, is_habitual_offender = TRUE,
    offender_status = 'CONVICTED', offender_role = ARRAY['DISTRIBUTOR','SUPPLIER'],
    cdr_status = 'COMPLETED',
    fit_for_pitndps_act = TRUE,
    source_system = 'CCTNS',
    extraction_confidence_score = 0.82
  WHERE subject_id = v_anil;

  -- Sanjay Patel — Money launderer / business front
  UPDATE subject_profile SET
    full_name_local = 'संजय पटेल',
    father_name = 'Ramesh Patel',
    place_of_birth = 'Ludhiana, Punjab',
    build = 'MEDIUM', height_cm = 174, weight_kg = 80,
    complexion = 'Fair', blood_group = 'A+',
    nationality = 'Indian', religion = 'Hindu', education = 'MBA',
    marital_status = 'MARRIED',
    residential_address = 'Flat 12B, Green Enclave, Dugri Road, Ludhiana, Punjab',
    native_state = 'Gujarat',
    district = 'Ludhiana', police_station = 'Dugri',
    supply_chain_position = 'FINANCIER',
    operational_level = 'INTER_STATE',
    modus_operandi = 'Operates textile export firm as front. Launders drug money through over/under-invoicing of trade goods. Maintains multiple shell companies.',
    criminal_history = '["FIR 890/2022 PS Dugri — 3/4 PMLA investigation","FIR 445/2023 PS Amritsar — 29 NDPS co-accused trial pending"]'::jsonb,
    section_of_law = ARRAY['3 PMLA','4 PMLA','29 NDPS','120B IPC'],
    total_convictions = 0, total_acquittals = 0,
    custody_status = 'FREE',
    offender_status = 'ACCUSED', offender_role = ARRAY['FINANCIER','MONEY_LAUNDERER'],
    cdr_status = 'REQUESTED',
    source_system = 'CCTNS',
    extraction_confidence_score = 0.75
  WHERE subject_id = v_sanjay;

  -- Paramjit Singh Brar — Gang enforcer
  UPDATE subject_profile SET
    full_name_local = 'ਪਰਮਜੀਤ ਸਿੰਘ ਬਰਾੜ',
    father_name = 'Jaswant Singh Brar',
    place_of_birth = 'Fazilka, Punjab',
    build = 'LARGE', height_cm = 180, weight_kg = 90,
    complexion = 'Fair', blood_group = 'B+',
    nationality = 'Indian', religion = 'Sikh', caste = 'Jat', education = 'Class 10',
    marital_status = 'MARRIED',
    residential_address = 'Village Arniwala, Tehsil Fazilka, Punjab',
    native_state = 'Punjab',
    district = 'Fazilka', police_station = 'Arniwala',
    primary_drug = 'Heroin',
    drug_types_dealt = ARRAY['Heroin','Opium','Poppy husk'],
    supply_chain_position = 'DISTRIBUTOR',
    operational_level = 'INTRA_STATE',
    territory_districts = ARRAY['Fazilka','Ferozepur','Muktsar'],
    modus_operandi = 'Enforcer and distributor for Balwinder gang. Handles border receiving operations. Known for intimidation of rivals.',
    gang_affiliation = 'Balwinder-Paramjit border gang',
    criminal_history = '["FIR 198/2016 PS Fazilka — 21/29 NDPS co-accused convicted","FIR 456/2022 PS Fazilka — 21C/29 NDPS co-accused trial pending","FIR 78/2023 PS Muktsar — 25/27 Arms Act + NDPS co-accused investigation"]'::jsonb,
    ndps_history = '["Sec 21 — Commercial quantity heroin","Sec 29 — Conspiracy"]'::jsonb,
    section_of_law = ARRAY['21 NDPS','29 NDPS','25 Arms Act','27 Arms Act'],
    total_convictions = 1, total_acquittals = 0,
    custody_status = 'ON_BAIL',
    is_recidivist = TRUE,
    offender_status = 'CONVICTED', offender_role = ARRAY['DISTRIBUTOR','ENFORCER'],
    cdr_status = 'COMPLETED',
    fit_for_pitndps_act = TRUE,
    source_system = 'CCTNS',
    extraction_confidence_score = 0.86
  WHERE subject_id = v_paramjit;

  -- Pradeep Sharma, Deepak Verma, Gurpreet, Ajay, Lakshmi, Vikram, Sukhwinder, Sunita — MEDIUM threats
  UPDATE subject_profile SET
    full_name_local = 'ਪ੍ਰਦੀਪ ਸ਼ਰਮਾ', father_name = 'Om Prakash Sharma',
    place_of_birth = 'Amritsar', build = 'SMALL', height_cm = 165, weight_kg = 60,
    complexion = 'Dark', blood_group = 'B+', religion = 'Hindu', education = 'Class 12',
    district = 'Amritsar', police_station = 'Sultanpuri',
    primary_drug = 'Chitta', drug_types_dealt = ARRAY['Chitta','Pharmaceutical tablets'],
    supply_chain_position = 'RETAILER', operational_level = 'LOCAL',
    territory_districts = ARRAY['Amritsar'],
    modus_operandi = 'Street-level pusher. Receives small quantities from Rajesh and sells to addicts.',
    criminal_history = '["FIR 678/2021 PS Sultanpuri — 21 NDPS convicted 3yr RI","FIR 234/2024 PS Amritsar — 22 NDPS investigation"]'::jsonb,
    section_of_law = ARRAY['21 NDPS','22 NDPS'],
    total_convictions = 1, custody_status = 'FREE', is_recidivist = TRUE,
    offender_status = 'ACCUSED', offender_role = ARRAY['RETAILER'],
    source_system = 'CCTNS', extraction_confidence_score = 0.70
  WHERE subject_id = v_pradeep;

  UPDATE subject_profile SET
    full_name_local = 'ਦੀਪਕ ਵਰਮਾ', father_name = 'Satish Verma',
    place_of_birth = 'Jalandhar', build = 'MEDIUM', height_cm = 171, weight_kg = 70,
    complexion = 'Wheatish', blood_group = 'A-', religion = 'Hindu', education = 'BA',
    district = 'Jalandhar', police_station = 'Nakodar',
    primary_drug = 'Chitta', drug_types_dealt = ARRAY['Chitta','Heroin','Pharmaceutical tablets'],
    supply_chain_position = 'RETAILER', operational_level = 'DISTRICT',
    territory_districts = ARRAY['Jalandhar','Kapurthala'],
    modus_operandi = 'Purchases from Mohinder Pal, distributes in Nakodar area. Runs a hardware shop as front.',
    criminal_history = '["FIR 445/2022 PS Nakodar — 21 NDPS convicted 2yr RI","FIR 890/2024 PS Jalandhar — 21 NDPS investigation"]'::jsonb,
    section_of_law = ARRAY['21 NDPS'],
    total_convictions = 1, custody_status = 'FREE', is_recidivist = TRUE,
    offender_status = 'ACCUSED', offender_role = ARRAY['RETAILER','BUYER'],
    source_system = 'CCTNS', extraction_confidence_score = 0.68
  WHERE subject_id = v_deepak;

  UPDATE subject_profile SET
    full_name_local = 'ਗੁਰਪ੍ਰੀਤ ਸਿੰਘ ਸਿੱਧੂ', father_name = 'Balbir Singh Sidhu',
    place_of_birth = 'Amritsar', build = 'MEDIUM', height_cm = 176, weight_kg = 78,
    complexion = 'Fair', blood_group = 'O-', religion = 'Sikh', education = 'ITI',
    district = 'Amritsar', police_station = 'Baba Bakala',
    supply_chain_position = 'RETAILER', operational_level = 'LOCAL',
    drug_types_dealt = ARRAY['Chitta'],
    modus_operandi = 'Low-level distributor linked to Rajesh. Works as auto-rickshaw driver by day.',
    criminal_history = '["FIR 123/2023 PS Baba Bakala — 21 NDPS trial pending"]'::jsonb,
    section_of_law = ARRAY['21 NDPS'],
    total_convictions = 0, custody_status = 'ON_BAIL',
    offender_status = 'ACCUSED', offender_role = ARRAY['RETAILER'],
    source_system = 'CCTNS', extraction_confidence_score = 0.62
  WHERE subject_id = v_gurpreet;

  UPDATE subject_profile SET
    full_name_local = 'ਅਜੈ ਠਾਕੁਰ', father_name = 'Mohan Lal Thakur',
    place_of_birth = 'Muktsar', build = 'MEDIUM', height_cm = 169, weight_kg = 68,
    complexion = 'Wheatish', religion = 'Hindu', education = 'Class 10',
    district = 'Muktsar', police_station = 'Malout',
    drug_types_dealt = ARRAY['Opium','Poppy husk'],
    supply_chain_position = 'RETAILER', operational_level = 'LOCAL',
    modus_operandi = 'Peripheral gang member. Assists in local distribution for Paramjit.',
    criminal_history = '["FIR 78/2023 PS Muktsar — 15 NDPS investigation"]'::jsonb,
    section_of_law = ARRAY['15 NDPS'],
    total_convictions = 0, custody_status = 'FREE',
    offender_status = 'SUSPECT', offender_role = ARRAY['RETAILER'],
    source_system = 'CCTNS', extraction_confidence_score = 0.58
  WHERE subject_id = v_ajay;

  UPDATE subject_profile SET
    full_name_local = 'ਲਕਸ਼ਮੀ ਨਾਰਾਇਣ', father_name = 'Vishnu Narayan',
    place_of_birth = 'Bathinda', build = 'MEDIUM', height_cm = 173, weight_kg = 74,
    complexion = 'Dark', religion = 'Hindu', education = 'Class 8',
    district = 'Bathinda', police_station = 'Sadar Bathinda',
    supply_chain_position = 'COURIER', operational_level = 'INTRA_STATE',
    drug_types_dealt = ARRAY['Heroin','Opium'],
    modus_operandi = 'Long-haul truck driver. Transports consignments between Fazilka and Bathinda.',
    criminal_history = '["FIR 567/2022 PS Bathinda — 21 NDPS trial pending"]'::jsonb,
    section_of_law = ARRAY['21 NDPS'],
    total_convictions = 0, custody_status = 'ON_BAIL',
    offender_status = 'ACCUSED', offender_role = ARRAY['COURIER'],
    source_system = 'CCTNS', extraction_confidence_score = 0.55
  WHERE subject_id = v_lakshmi;

  UPDATE subject_profile SET
    full_name_local = 'ਵਿਕਰਮ ਚੌਹਾਨ', father_name = 'Baldev Chauhan',
    place_of_birth = 'Jalandhar', build = 'SMALL', height_cm = 166, weight_kg = 58,
    complexion = 'Dark', religion = 'Hindu', education = 'ITI (Mechanic)',
    district = 'Jalandhar', police_station = 'Industrial Area',
    modus_operandi = 'Auto mechanic who modifies vehicles with hidden compartments for drug transport. Facilitator, not a dealer.',
    criminal_history = '["FIR 890/2023 PS Industrial Area — 29 NDPS (abetment) investigation"]'::jsonb,
    section_of_law = ARRAY['29 NDPS'],
    total_convictions = 0, custody_status = 'FREE',
    offender_status = 'SUSPECT', offender_role = ARRAY['FACILITATOR'],
    source_system = 'CCTNS', extraction_confidence_score = 0.52
  WHERE subject_id = v_vikram;

  UPDATE subject_profile SET
    full_name_local = 'ਸੁਖਵਿੰਦਰ ਕੌਰ', father_name = 'Baldev Singh (deceased)',
    place_of_birth = 'Ferozepur', build = 'MEDIUM', height_cm = 160, weight_kg = 58,
    complexion = 'Wheatish', religion = 'Sikh', education = 'Class 5',
    district = 'Ferozepur', police_station = 'Sadar Ferozepur',
    supply_chain_position = 'COURIER', operational_level = 'LOCAL',
    modus_operandi = 'Used as courier by Balwinder gang. Carries small packets concealed in clothing during bus journeys.',
    criminal_history = '["FIR 345/2023 PS Ferozepur — 21 NDPS arrested, bail granted"]'::jsonb,
    section_of_law = ARRAY['21 NDPS'],
    total_convictions = 0, custody_status = 'ON_BAIL',
    offender_status = 'ACCUSED', offender_role = ARRAY['COURIER'],
    source_system = 'CCTNS', extraction_confidence_score = 0.50
  WHERE subject_id = v_sukhwinder;

  UPDATE subject_profile SET
    full_name_local = 'ਸੁਨੀਤਾ ਦੇਵੀ', father_name = 'Krishan Lal',
    place_of_birth = 'Amritsar', build = 'SMALL', height_cm = 155, weight_kg = 50,
    complexion = 'Wheatish', religion = 'Hindu', education = 'Class 8',
    district = 'Amritsar', police_station = 'Sultanpuri',
    modus_operandi = 'Rents premises used as stash house by Pradeep. Peripheral involvement.',
    criminal_history = '["FIR 678/2021 PS Sultanpuri — 29 NDPS (abetment) acquitted"]'::jsonb,
    section_of_law = ARRAY['29 NDPS'],
    total_convictions = 0, total_acquittals = 1, custody_status = 'FREE',
    offender_status = 'ACQUITTED', offender_role = ARRAY['FACILITATOR'],
    source_system = 'CCTNS', extraction_confidence_score = 0.42
  WHERE subject_id = v_sunita;

  -- LOW threats — minimal updates
  UPDATE subject_profile SET
    full_name_local = 'ਹਰਪ੍ਰੀਤ ਕੌਰ ਢਿੱਲੋਂ', father_name = 'Avtar Singh Dhillon',
    place_of_birth = 'Amritsar', district = 'Amritsar',
    complexion = 'Fair', religion = 'Sikh', education = 'MA',
    modus_operandi = 'Suspected of allowing her property to be used for drug meetings. Under surveillance.',
    offender_status = 'SUSPECT', custody_status = 'FREE',
    source_system = 'INTELLIGENCE', extraction_confidence_score = 0.35
  WHERE subject_id = v_harpreet_d;

  UPDATE subject_profile SET
    full_name_local = 'ਪਰਮਿੰਦਰ ਕੌਰ',
    district = 'Amritsar', religion = 'Sikh', education = 'Class 12',
    offender_status = 'UNKNOWN', custody_status = 'FREE',
    source_system = 'CCTNS', extraction_confidence_score = 0.30
  WHERE subject_id = v_parminder;

  UPDATE subject_profile SET
    full_name_local = 'ਕਮਲਜੀਤ ਕੌਰ', father_name = 'Gurcharan Singh',
    place_of_birth = 'Fazilka', district = 'Fazilka', religion = 'Sikh',
    offender_status = 'UNKNOWN', custody_status = 'FREE',
    source_system = 'CCTNS', extraction_confidence_score = 0.28
  WHERE subject_id = v_kamaljeet;

  UPDATE subject_profile SET
    full_name_local = 'नेहा गुप्ता', father_name = 'Rakesh Gupta',
    place_of_birth = 'Ludhiana', district = 'Ludhiana', religion = 'Hindu', education = 'BCA',
    offender_status = 'UNKNOWN', custody_status = 'FREE',
    source_system = 'INTELLIGENCE', extraction_confidence_score = 0.25
  WHERE subject_id = v_neha;

  -- ============================================================================
  -- 2. FIR RECORDS
  -- ============================================================================

  -- === Mohammed Irfan — 4 FIRs ===
  INSERT INTO fir_record (subject_id, fir_number, fir_date, police_station, district, state, sections_of_law, role_in_case, arrest_date, arresting_agency, charge_sheet_date, charge_sheet_number, court_name, court_case_number, case_stage, verdict, sentence_details, sentence_start_date, sentence_end_date, fine_amount, bail_type, bail_date, bail_conditions, source_system) VALUES
  (v_irfan, 'FIR-287/2019', '2019-06-10', 'PS Sadar Tarn Taran', 'Tarn Taran', 'Punjab', ARRAY['21 NDPS','61 NDPS','85 NDPS'], 'ACCUSED', '2019-06-12', 'Punjab Police SSOC', '2019-09-15', 'CS-287/2019', 'Sessions Court Tarn Taran', 'SC-445/2019', 'JUDGMENT', 'CONVICTED', '7 years RI with fine Rs. 1,00,000', '2019-11-20', '2026-11-19', 100000, 'NONE', NULL, NULL, 'CCTNS'),
  (v_irfan, 'FIR-142/2021', '2021-03-22', 'PS Harike', 'Tarn Taran', 'Punjab', ARRAY['21C NDPS','29 NDPS'], 'ACCUSED', '2021-03-25', 'STF Punjab', '2021-07-10', 'CS-142/2021', 'Sessions Court Tarn Taran', 'SC-890/2021', 'TRIAL', 'PENDING', NULL, NULL, NULL, NULL, 'REGULAR', '2021-09-15', 'Shall not leave Punjab without permission. Report to PS weekly.', 'CCTNS'),
  (v_irfan, 'FIR-89/2023', '2023-08-15', 'PS Tarn Taran City', 'Tarn Taran', 'Punjab', ARRAY['21 NDPS','29 NDPS'], 'ACCUSED', '2023-08-18', 'Punjab Police', '2024-01-20', 'CS-89/2023', 'Sessions Court Tarn Taran', 'SC-123/2024', 'TRIAL', 'PENDING', NULL, NULL, NULL, NULL, 'REGULAR', '2023-11-01', 'Surrender passport. Report fortnightly.', 'CCTNS'),
  (v_irfan, 'FIR-44/2024', '2024-01-15', 'PS Kotwali Amritsar', 'Amritsar', 'Punjab', ARRAY['21 NDPS','29 NDPS','120B IPC'], 'ACCUSED', '2024-01-18', 'STF Punjab', NULL, NULL, NULL, NULL, 'INVESTIGATION', 'PENDING', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'CCTNS')
  ON CONFLICT DO NOTHING;

  -- === Balwinder Singh — 5 FIRs ===
  INSERT INTO fir_record (subject_id, fir_number, fir_date, police_station, district, state, sections_of_law, role_in_case, arrest_date, arresting_agency, charge_sheet_date, charge_sheet_number, court_name, court_case_number, case_stage, next_hearing_date, verdict, sentence_details, sentence_start_date, sentence_end_date, fine_amount, bail_type, bail_date, bail_conditions, source_system) VALUES
  (v_balwinder, 'FIR-198/2016', '2016-09-01', 'PS Sadar Fazilka', 'Fazilka', 'Punjab', ARRAY['21 NDPS','29 NDPS','61 NDPS'], 'ACCUSED', '2016-09-03', 'BSF + Punjab Police', '2017-01-15', 'CS-198/2016', 'Sessions Court Fazilka', 'SC-34/2017', 'JUDGMENT', NULL, 'CONVICTED', '10 years RI with fine Rs. 2,00,000', '2017-03-20', '2027-03-19', 200000, 'NONE', NULL, NULL, 'CCTNS'),
  (v_balwinder, 'FIR-312/2018', '2018-11-05', 'PS Sadar Ferozepur', 'Ferozepur', 'Punjab', ARRAY['21 NDPS','61 NDPS'], 'ACCUSED', '2018-11-08', 'Punjab Police SSOC', '2019-03-22', 'CS-312/2018', 'Sessions Court Ferozepur', 'SC-567/2019', 'JUDGMENT', NULL, 'CONVICTED', '7 years RI with fine Rs. 1,50,000', '2019-06-10', '2026-06-09', 150000, 'NONE', NULL, NULL, 'CCTNS'),
  (v_balwinder, 'FIR-456/2022', '2022-04-18', 'PS Sadar Fazilka', 'Fazilka', 'Punjab', ARRAY['21C NDPS','29 NDPS'], 'ACCUSED', '2022-04-22', 'STF Punjab', '2022-09-10', 'CS-456/2022', 'Sessions Court Fazilka', 'SC-789/2022', 'TRIAL', '2026-04-15', 'PENDING', NULL, NULL, NULL, NULL, 'REGULAR', '2023-01-10', 'High Court bail. Report monthly to PS Fazilka. Surrender passport.', 'CCTNS'),
  (v_balwinder, 'FIR-78/2023', '2023-06-20', 'PS Malout', 'Muktsar', 'Punjab', ARRAY['25 Arms Act','27 Arms Act','21 NDPS'], 'ACCUSED', '2023-06-25', 'Punjab Police', '2024-01-05', 'CS-78/2023', 'Sessions Court Muktsar', 'SC-45/2024', 'ARGUMENTS', '2026-05-20', 'PENDING', NULL, NULL, NULL, NULL, 'REGULAR', '2023-10-15', 'Report weekly. Shall not enter Fazilka district.', 'CCTNS'),
  (v_balwinder, 'FIR-201/2024', '2024-03-08', 'PS Abohar', 'Fazilka', 'Punjab', ARRAY['21 NDPS','29 NDPS','120B IPC'], 'ACCUSED', '2024-03-10', 'STF Punjab + BSF', NULL, NULL, NULL, NULL, 'INVESTIGATION', NULL, 'PENDING', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'CCTNS')
  ON CONFLICT DO NOTHING;

  -- === Rajesh Kumar Singh — 3 FIRs ===
  INSERT INTO fir_record (subject_id, fir_number, fir_date, police_station, district, state, sections_of_law, role_in_case, arrest_date, arresting_agency, charge_sheet_date, court_name, case_stage, next_hearing_date, verdict, sentence_details, sentence_start_date, fine_amount, bail_type, bail_date, bail_conditions, source_system) VALUES
  (v_rajesh, 'FIR-561/2020', '2020-10-12', 'PS Kotwali Amritsar', 'Amritsar', 'Punjab', ARRAY['21 NDPS','29 NDPS'], 'ACCUSED', '2020-10-15', 'Punjab Police', '2021-02-20', 'Sessions Court Amritsar', 'JUDGMENT', NULL, 'CONVICTED', '5 years RI with fine Rs. 50,000', '2021-05-10', 50000, 'NONE', NULL, NULL, 'CCTNS'),
  (v_rajesh, 'FIR-89/2023', '2023-08-15', 'PS Tarn Taran City', 'Tarn Taran', 'Punjab', ARRAY['21 NDPS'], 'ACCUSED', '2023-08-20', 'Punjab Police', '2024-01-15', 'Sessions Court Tarn Taran', 'TRIAL', '2026-06-10', 'PENDING', NULL, NULL, NULL, 'REGULAR', '2023-12-05', 'Report to PS fortnightly.', 'CCTNS'),
  (v_rajesh, 'FIR-334/2024', '2024-02-01', 'PS Kotwali Amritsar', 'Amritsar', 'Punjab', ARRAY['22 NDPS'], 'ACCUSED', '2024-02-05', 'Punjab Police', NULL, NULL, 'INVESTIGATION', NULL, 'PENDING', NULL, NULL, NULL, NULL, NULL, NULL, 'CCTNS')
  ON CONFLICT DO NOTHING;

  -- === Ranjit Singh Mann — 3 FIRs ===
  INSERT INTO fir_record (subject_id, fir_number, fir_date, police_station, district, state, sections_of_law, role_in_case, arrest_date, charge_sheet_date, court_name, case_stage, next_hearing_date, verdict, bail_type, bail_date, bail_conditions, source_system) VALUES
  (v_ranjit, 'FIR-112/2021', '2021-07-10', 'PS Division No.3 Jalandhar', 'Jalandhar', 'Punjab', ARRAY['21C NDPS','3 PMLA'], 'ACCUSED', '2021-07-15', '2022-01-20', 'Special NDPS Court Jalandhar', 'TRIAL', '2026-07-01', 'PENDING', 'ANTICIPATORY', '2021-07-12', 'Shall cooperate with investigation. Not tamper with evidence.', 'CCTNS'),
  (v_ranjit, 'FIR-445/2023', '2023-09-05', 'PS Kotwali Amritsar', 'Amritsar', 'Punjab', ARRAY['29 NDPS','120B IPC'], 'ACCUSED', '2023-09-10', '2024-02-15', 'Sessions Court Amritsar', 'TRIAL', '2026-05-15', 'PENDING', 'REGULAR', '2024-01-20', 'Report to PS monthly.', 'CCTNS'),
  (v_ranjit, 'FIR-67/2024', '2024-01-20', 'PS Division No.3 Jalandhar', 'Jalandhar', 'Punjab', ARRAY['3 PMLA','4 PMLA'], 'ACCUSED', NULL, NULL, NULL, 'INVESTIGATION', NULL, 'PENDING', NULL, NULL, NULL, 'ED')
  ON CONFLICT DO NOTHING;

  -- === Mohinder Pal — 4 FIRs ===
  INSERT INTO fir_record (subject_id, fir_number, fir_date, police_station, district, state, sections_of_law, role_in_case, arrest_date, charge_sheet_date, court_name, case_stage, verdict, sentence_details, sentence_start_date, fine_amount, bail_type, bail_date, source_system) VALUES
  (v_mohinder, 'FIR-234/2019', '2019-04-10', 'PS Basti Danishmandan', 'Jalandhar', 'Punjab', ARRAY['21 NDPS'], 'ACCUSED', '2019-04-12', '2019-08-20', 'Sessions Court Jalandhar', 'JUDGMENT', 'CONVICTED', '5 years RI with fine Rs. 50,000', '2019-11-01', 50000, 'NONE', NULL, 'CCTNS'),
  (v_mohinder, 'FIR-567/2021', '2021-09-15', 'PS Sadar Moga', 'Moga', 'Punjab', ARRAY['22 NDPS'], 'ACCUSED', '2021-09-18', '2022-02-10', 'Sessions Court Moga', 'JUDGMENT', 'ACQUITTED', NULL, NULL, NULL, NULL, NULL, 'CCTNS'),
  (v_mohinder, 'FIR-123/2023', '2023-05-20', 'PS Basti Danishmandan', 'Jalandhar', 'Punjab', ARRAY['21 NDPS','29 NDPS'], 'ACCUSED', '2023-05-22', '2023-11-15', 'Sessions Court Jalandhar', 'TRIAL', 'PENDING', NULL, NULL, NULL, 'REGULAR', '2023-09-01', 'CCTNS'),
  (v_mohinder, 'FIR-456/2024', '2024-02-10', 'PS Industrial Area Ludhiana', 'Ludhiana', 'Punjab', ARRAY['21 NDPS'], 'ACCUSED', '2024-02-12', NULL, NULL, 'INVESTIGATION', 'PENDING', NULL, NULL, NULL, NULL, NULL, 'CCTNS')
  ON CONFLICT DO NOTHING;

  -- === Anil Kumar Yadav — 4 FIRs ===
  INSERT INTO fir_record (subject_id, fir_number, fir_date, police_station, district, state, sections_of_law, role_in_case, arrest_date, charge_sheet_date, court_name, case_stage, verdict, sentence_details, fine_amount, bail_type, bail_date, source_system) VALUES
  (v_anil, 'FIR-78/2018', '2018-03-15', 'PS Abohar', 'Fazilka', 'Punjab', ARRAY['15 NDPS'], 'ACCUSED', '2018-03-18', '2018-08-10', 'Sessions Court Fazilka', 'JUDGMENT', 'CONVICTED', '3 years RI with fine Rs. 25,000', 25000, 'NONE', NULL, 'CCTNS'),
  (v_anil, 'FIR-301/2020', '2020-07-22', 'PS Abohar', 'Fazilka', 'Punjab', ARRAY['21 NDPS'], 'ACCUSED', '2020-07-25', '2020-12-15', 'Sessions Court Fazilka', 'JUDGMENT', 'CONVICTED', '5 years RI with fine Rs. 75,000', 75000, 'NONE', NULL, 'CCTNS'),
  (v_anil, 'FIR-145/2022', '2022-06-10', 'PS Malout', 'Muktsar', 'Punjab', ARRAY['21 NDPS','29 NDPS'], 'ACCUSED', '2022-06-15', '2022-12-20', 'Sessions Court Muktsar', 'TRIAL', 'PENDING', NULL, NULL, 'REGULAR', '2023-03-01', 'CCTNS'),
  (v_anil, 'FIR-201/2024', '2024-03-08', 'PS Abohar', 'Fazilka', 'Punjab', ARRAY['21 NDPS'], 'ACCUSED', '2024-03-12', NULL, NULL, 'INVESTIGATION', 'PENDING', NULL, NULL, NULL, NULL, 'CCTNS')
  ON CONFLICT DO NOTHING;

  -- === Paramjit Singh Brar — 3 FIRs ===
  INSERT INTO fir_record (subject_id, fir_number, fir_date, police_station, district, state, sections_of_law, role_in_case, arrest_date, charge_sheet_date, court_name, case_stage, verdict, sentence_details, fine_amount, bail_type, bail_date, source_system) VALUES
  (v_paramjit, 'FIR-198/2016', '2016-09-01', 'PS Sadar Fazilka', 'Fazilka', 'Punjab', ARRAY['21 NDPS','29 NDPS'], 'ACCUSED', '2016-09-05', '2017-01-15', 'Sessions Court Fazilka', 'JUDGMENT', 'CONVICTED', '7 years RI with fine Rs. 1,00,000', 100000, 'NONE', NULL, 'CCTNS'),
  (v_paramjit, 'FIR-456/2022', '2022-04-18', 'PS Sadar Fazilka', 'Fazilka', 'Punjab', ARRAY['21C NDPS','29 NDPS'], 'ACCUSED', '2022-04-25', '2022-09-10', 'Sessions Court Fazilka', 'TRIAL', 'PENDING', NULL, NULL, 'REGULAR', '2023-02-01', 'CCTNS'),
  (v_paramjit, 'FIR-78/2023', '2023-06-20', 'PS Malout', 'Muktsar', 'Punjab', ARRAY['25 Arms Act','21 NDPS'], 'ACCUSED', '2023-06-28', '2024-01-05', 'Sessions Court Muktsar', 'TRIAL', 'PENDING', NULL, NULL, 'REGULAR', '2023-11-10', 'CCTNS')
  ON CONFLICT DO NOTHING;

  -- === Medium/Low threat FIRs ===
  INSERT INTO fir_record (subject_id, fir_number, fir_date, police_station, district, state, sections_of_law, role_in_case, arrest_date, charge_sheet_date, court_name, case_stage, verdict, sentence_details, fine_amount, bail_type, bail_date, source_system) VALUES
  (v_pradeep, 'FIR-678/2021', '2021-11-05', 'PS Sultanpuri', 'Amritsar', 'Punjab', ARRAY['21 NDPS'], 'ACCUSED', '2021-11-08', '2022-03-20', 'Sessions Court Amritsar', 'JUDGMENT', 'CONVICTED', '3 years RI with fine Rs. 25,000', 25000, 'NONE', NULL, 'CCTNS'),
  (v_pradeep, 'FIR-234/2024', '2024-01-20', 'PS Kotwali Amritsar', 'Amritsar', 'Punjab', ARRAY['22 NDPS'], 'ACCUSED', '2024-01-22', NULL, NULL, 'INVESTIGATION', 'PENDING', NULL, NULL, NULL, NULL, 'CCTNS'),
  (v_deepak, 'FIR-445/2022', '2022-08-12', 'PS Nakodar', 'Jalandhar', 'Punjab', ARRAY['21 NDPS'], 'ACCUSED', '2022-08-15', '2023-01-10', 'Sessions Court Jalandhar', 'JUDGMENT', 'CONVICTED', '2 years RI with fine Rs. 20,000', 20000, 'NONE', NULL, 'CCTNS'),
  (v_deepak, 'FIR-890/2024', '2024-02-28', 'PS Basti Danishmandan', 'Jalandhar', 'Punjab', ARRAY['21 NDPS'], 'ACCUSED', '2024-03-01', NULL, NULL, 'INVESTIGATION', 'PENDING', NULL, NULL, NULL, NULL, 'CCTNS'),
  (v_gurpreet, 'FIR-123/2023', '2023-04-10', 'PS Baba Bakala', 'Amritsar', 'Punjab', ARRAY['21 NDPS'], 'ACCUSED', '2023-04-12', '2023-09-20', 'Sessions Court Amritsar', 'TRIAL', 'PENDING', NULL, NULL, 'REGULAR', '2023-07-15', 'CCTNS'),
  (v_sanjay, 'FIR-890/2022', '2022-12-05', 'PS Dugri', 'Ludhiana', 'Punjab', ARRAY['3 PMLA','4 PMLA'], 'ACCUSED', NULL, NULL, NULL, 'INVESTIGATION', 'PENDING', NULL, NULL, 'ANTICIPATORY', '2022-12-03', 'ED'),
  (v_sanjay, 'FIR-445/2023', '2023-09-05', 'PS Kotwali Amritsar', 'Amritsar', 'Punjab', ARRAY['29 NDPS','120B IPC'], 'ACCUSED', '2023-09-12', '2024-02-15', 'Sessions Court Amritsar', 'TRIAL', 'PENDING', NULL, NULL, 'REGULAR', '2024-01-25', 'CCTNS'),
  (v_lakshmi, 'FIR-567/2022', '2022-10-20', 'PS Sadar Bathinda', 'Bathinda', 'Punjab', ARRAY['21 NDPS'], 'ACCUSED', '2022-10-22', '2023-03-15', 'Sessions Court Bathinda', 'TRIAL', 'PENDING', NULL, NULL, 'REGULAR', '2023-02-10', 'CCTNS'),
  (v_sukhwinder, 'FIR-345/2023', '2023-07-15', 'PS Sadar Ferozepur', 'Ferozepur', 'Punjab', ARRAY['21 NDPS'], 'ACCUSED', '2023-07-18', '2023-12-20', 'Sessions Court Ferozepur', 'TRIAL', 'PENDING', NULL, NULL, 'REGULAR', '2023-10-05', 'CCTNS'),
  (v_sunita, 'FIR-678/2021', '2021-11-05', 'PS Sultanpuri', 'Amritsar', 'Punjab', ARRAY['29 NDPS'], 'ACCUSED', '2021-11-10', '2022-03-20', 'Sessions Court Amritsar', 'JUDGMENT', 'ACQUITTED', NULL, NULL, NULL, NULL, 'CCTNS'),
  (v_ajay, 'FIR-78/2023', '2023-06-20', 'PS Malout', 'Muktsar', 'Punjab', ARRAY['15 NDPS'], 'SUSPECT', NULL, NULL, NULL, 'INVESTIGATION', 'PENDING', NULL, NULL, NULL, NULL, 'CCTNS'),
  (v_vikram, 'FIR-890/2023', '2023-10-10', 'PS Industrial Area', 'Jalandhar', 'Punjab', ARRAY['29 NDPS'], 'SUSPECT', NULL, NULL, NULL, 'INVESTIGATION', 'PENDING', NULL, NULL, NULL, NULL, 'CCTNS')
  ON CONFLICT DO NOTHING;

  -- ============================================================================
  -- 3. SEIZURE RECORDS
  -- ============================================================================

  INSERT INTO seizure_record (subject_id, seizure_date, seizure_location, seizing_officer, seizing_agency, drug_type, gross_weight_grams, net_weight_grams, purity_percentage, estimated_street_value, quantity_category, field_test_result, fsl_report_number, fsl_result, disposal_status, sealed_package_count) VALUES
  -- Irfan seizures
  (v_irfan, '2019-06-12', 'House No. 45, Gali Peer Wali, Tarn Taran', 'SI Harjinder Singh', 'Punjab Police SSOC', 'Heroin', 520, 485, 42.5, 4850000, 'COMMERCIAL', 'Positive for diacetylmorphine', 'FSL/TT/2019/1234', 'Confirmed heroin, purity 42.5%', 'SAMPLE_RETAINED', 4),
  (v_irfan, '2021-03-25', 'Highway dhaba near Harike, GT Road', 'DSP Kulwant Singh', 'STF Punjab', 'Heroin', 2100, 1950, 38.0, 19500000, 'LARGE_COMMERCIAL', 'Positive for diacetylmorphine', 'FSL/TT/2021/5678', 'Confirmed heroin, purity 38%', 'IN_STORAGE', 8),
  (v_irfan, '2024-01-18', 'Kotwali area, Amritsar', 'Inspector Rajveer Kaur', 'STF Punjab', 'Heroin', 350, 320, 45.0, 3200000, 'COMMERCIAL', 'Positive for diacetylmorphine', NULL, NULL, 'IN_STORAGE', 3),
  -- Balwinder seizures
  (v_balwinder, '2016-09-03', 'Farm near Indo-Pak border, Fazilka', 'DSP Border Range', 'BSF + Punjab Police', 'Heroin', 5200, 4800, 55.0, 48000000, 'LARGE_COMMERCIAL', 'Positive for diacetylmorphine', 'FSL/FZK/2016/0901', 'Confirmed heroin, purity 55%', 'SAMPLE_RETAINED', 12),
  (v_balwinder, '2018-11-08', 'Underground bunker, Hussainiwala area', 'CI Satnam Singh', 'Punjab Police SSOC', 'Opium', 3500, 3200, NULL, 6400000, 'LARGE_COMMERCIAL', 'Positive for opium alkaloids', 'FSL/FPR/2018/3456', 'Confirmed raw opium', 'DISPOSED', 6),
  (v_balwinder, '2022-04-22', 'Tractor trolley on Fazilka-Bathinda road', 'DSP STF', 'STF Punjab', 'Heroin', 1800, 1650, 48.0, 16500000, 'LARGE_COMMERCIAL', 'Positive for diacetylmorphine', 'FSL/FZK/2022/7890', 'Confirmed heroin, purity 48%', 'IN_STORAGE', 7),
  (v_balwinder, '2024-03-10', 'Village Arniwala, dairy farm', 'Inspector Manpreet Kaur', 'STF + BSF', 'Heroin', 800, 740, 50.0, 7400000, 'COMMERCIAL', 'Positive', NULL, NULL, 'IN_STORAGE', 4),
  -- Rajesh seizures
  (v_rajesh, '2020-10-15', 'Transport office, Katra Sher Singh, Amritsar', 'SI Baljit Singh', 'Punjab Police', 'Heroin', 280, 250, 35.0, 2500000, 'COMMERCIAL', 'Positive', 'FSL/AMR/2020/4567', 'Confirmed heroin', 'SAMPLE_RETAINED', 2),
  (v_rajesh, '2024-02-05', 'Truck cabin at Amritsar bus stand', 'CI Paramjit Singh', 'Punjab Police', 'Pharmaceutical tablets (Tramadol)', 5000, 5000, NULL, 150000, 'LESS_THAN_COMMERCIAL', 'Positive for Tramadol HCl', NULL, NULL, 'IN_STORAGE', 1),
  -- Anil seizures
  (v_anil, '2018-03-18', 'Abohar market area', 'SI Rajinder Kumar', 'Punjab Police', 'Poppy husk', 15000, 14500, NULL, 290000, 'COMMERCIAL', 'Positive for opium alkaloids', 'FSL/FZK/2018/1111', 'Confirmed poppy straw', 'DISPOSED', 3),
  (v_anil, '2020-07-25', 'Dairy farm, outskirts Abohar', 'Inspector Satish Kumar', 'Punjab Police', 'Heroin', 450, 410, 40.0, 4100000, 'COMMERCIAL', 'Positive for diacetylmorphine', 'FSL/FZK/2020/2222', 'Confirmed heroin, purity 40%', 'SAMPLE_RETAINED', 3),
  -- Mohinder seizures
  (v_mohinder, '2019-04-12', 'Bus stand, Basti Danishmandan', 'SI Ashwani Kumar', 'Punjab Police', 'Heroin', 150, 135, 30.0, 1350000, 'COMMERCIAL', 'Positive', 'FSL/JLD/2019/3333', 'Confirmed heroin', 'DISPOSED', 2),
  (v_mohinder, '2023-05-22', 'Railway station, Jalandhar', 'CI Harpreet Kaur', 'Punjab Police', 'Heroin', 220, 195, 36.0, 1950000, 'COMMERCIAL', 'Positive', 'FSL/JLD/2023/4444', 'Confirmed heroin, purity 36%', 'IN_STORAGE', 2),
  -- Pradeep seizure
  (v_pradeep, '2021-11-08', 'Rented room, Sultanpuri, Amritsar', 'SI Maninder Singh', 'Punjab Police', 'Chitta (Heroin)', 80, 72, 25.0, 720000, 'LESS_THAN_COMMERCIAL', 'Positive', 'FSL/AMR/2021/5555', 'Confirmed heroin, low purity', 'DISPOSED', 1),
  -- Deepak seizure
  (v_deepak, '2022-08-15', 'Hardware shop, Nakodar market', 'SI Sukhdev Singh', 'Punjab Police', 'Chitta (Heroin)', 60, 55, 22.0, 550000, 'LESS_THAN_COMMERCIAL', 'Positive', 'FSL/JLD/2022/6666', 'Confirmed heroin', 'DISPOSED', 1),
  -- Lakshmi seizure
  (v_lakshmi, '2022-10-22', 'Truck cabin at Bathinda toll plaza', 'CI Jaskaran Singh', 'Punjab Police', 'Heroin', 180, 165, 35.0, 1650000, 'COMMERCIAL', 'Positive', 'FSL/BTH/2022/7777', 'Confirmed heroin', 'IN_STORAGE', 2),
  -- Sukhwinder seizure
  (v_sukhwinder, '2023-07-18', 'Ferozepur bus stand', 'SI Gurmeet Kaur', 'Punjab Police', 'Heroin', 50, 45, 28.0, 450000, 'LESS_THAN_COMMERCIAL', 'Positive', 'FSL/FPR/2023/8888', 'Confirmed heroin', 'DISPOSED', 1)
  ON CONFLICT DO NOTHING;

  -- ============================================================================
  -- 4. WARRANT RECORDS
  -- ============================================================================

  INSERT INTO warrant_record (subject_id, warrant_type, warrant_number, warrant_date, issuing_court, issuing_authority, is_executed, executed_at, executed_by, pitndps_order_number, pitndps_order_date, detention_period_days, status, notes) VALUES
  -- Irfan warrants
  (v_irfan, 'PITNDPS', 'PIT/TT/2023/045', '2023-04-15', 'District Magistrate Tarn Taran', 'DM Tarn Taran', TRUE, '2023-04-18', 'STF Punjab', 'PIT-NDPS/TT/2023/045', '2023-04-15', 180, 'EXECUTED', 'Detained 6 months at Central Jail Amritsar'),
  (v_irfan, 'NBW', 'NBW/SC-TT/2024/012', '2024-03-01', 'Sessions Court Tarn Taran', 'Sessions Judge', FALSE, NULL, NULL, NULL, NULL, NULL, 'ACTIVE', 'Non-bailable warrant for failure to appear in FIR-89/2023'),
  -- Balwinder warrants
  (v_balwinder, 'PITNDPS', 'PIT/FZK/2022/089', '2022-08-10', 'District Magistrate Fazilka', 'DM Fazilka', TRUE, '2022-08-15', 'Punjab Police', 'PIT-NDPS/FZK/2022/089', '2022-08-10', 365, 'EXECUTED', 'Detained 12 months at Central Jail Ferozepur'),
  (v_balwinder, 'ARREST', 'AW/FZK/2024/034', '2024-03-05', 'Sessions Court Fazilka', 'Sessions Judge', TRUE, '2024-03-10', 'STF Punjab + BSF', NULL, NULL, NULL, 'EXECUTED', 'Executed during FIR-201/2024 operation'),
  (v_balwinder, 'PROCLAIMED_OFFENDER', 'PO/FZK/2023/001', '2023-01-15', 'Sessions Court Fazilka', 'Sessions Judge', FALSE, NULL, NULL, NULL, NULL, NULL, 'WITHDRAWN', 'Withdrawn after High Court bail'),
  -- Paramjit warrant
  (v_paramjit, 'PITNDPS', 'PIT/FZK/2023/112', '2023-12-01', 'District Magistrate Fazilka', 'DM Fazilka', FALSE, NULL, NULL, 'PIT-NDPS/FZK/2023/112', '2023-12-01', 180, 'ACTIVE', 'PIT-NDPS order pending execution'),
  -- Ranjit — production warrant
  (v_ranjit, 'PRODUCTION', 'PW/JLD/2024/005', '2024-02-15', 'Special NDPS Court Jalandhar', 'Special Judge', TRUE, '2024-02-20', 'Punjab Police', NULL, NULL, NULL, 'EXECUTED', 'Production for evidence hearing'),
  -- Mohinder — NBW
  (v_mohinder, 'NBW', 'NBW/JLD/2024/018', '2024-03-15', 'Sessions Court Jalandhar', 'Sessions Judge', FALSE, NULL, NULL, NULL, NULL, NULL, 'ACTIVE', 'Non-bailable warrant for failure to report')
  ON CONFLICT DO NOTHING;

  -- ============================================================================
  -- 5. FAMILY MEMBERS
  -- ============================================================================

  INSERT INTO subject_family_member (subject_id, relative_subject_id, relationship_type, full_name, contact_phone, age, gender, occupation, is_aware_of_activity, is_involved, is_dependent) VALUES
  (v_irfan, NULL, 'FATHER', 'Abdul Rashid Khan', '+91-98140-00001', 68, 'Male', 'Retired shopkeeper', FALSE, FALSE, TRUE),
  (v_irfan, NULL, 'SPOUSE', 'Rubina Begum', '+91-98140-00002', 38, 'Female', 'Homemaker', TRUE, FALSE, TRUE),
  (v_irfan, NULL, 'SON', 'Sahil Khan', NULL, 16, 'Male', 'Student Class 11', FALSE, FALSE, TRUE),
  (v_irfan, NULL, 'DAUGHTER', 'Ayesha Khan', NULL, 12, 'Female', 'Student Class 7', FALSE, FALSE, TRUE),
  (v_balwinder, v_kamaljeet, 'SPOUSE', 'Kamaljeet Kaur', '+91-94170-00010', 44, 'Female', 'Homemaker', TRUE, FALSE, TRUE),
  (v_balwinder, NULL, 'SON', 'Mandeep Singh', '+91-98150-00020', 22, 'Male', 'College student', FALSE, FALSE, FALSE),
  (v_balwinder, NULL, 'BROTHER', 'Surjit Singh', '+91-98150-00021', 52, 'Male', 'Farmer', TRUE, TRUE, FALSE),
  (v_rajesh, v_parminder, 'SPOUSE', 'Parminder Kaur', '+91-98760-00030', 35, 'Female', 'Homemaker', TRUE, FALSE, TRUE),
  (v_rajesh, NULL, 'SON', 'Arjun Singh', NULL, 10, 'Male', 'Student', FALSE, FALSE, TRUE),
  (v_ranjit, NULL, 'SPOUSE', 'Jaswinder Kaur', '+91-98140-00040', 50, 'Female', 'Homemaker', FALSE, FALSE, TRUE),
  (v_ranjit, NULL, 'SON', 'Gurtej Singh Mann', '+91-98140-00041', 28, 'Male', 'Real estate business', TRUE, TRUE, FALSE),
  (v_paramjit, NULL, 'SPOUSE', 'Harjinder Kaur', '+91-94170-00050', 40, 'Female', 'Agricultural work', TRUE, FALSE, TRUE),
  (v_anil, NULL, 'SPOUSE', 'Meena Devi', '+91-98150-00060', 38, 'Female', 'Homemaker', FALSE, FALSE, TRUE),
  (v_mohinder, NULL, 'SPOUSE', 'Kulwinder Kaur', '+91-98140-00070', 36, 'Female', 'Tailoring', FALSE, FALSE, TRUE)
  ON CONFLICT DO NOTHING;

  -- ============================================================================
  -- 6. PROPERTY & ASSETS
  -- ============================================================================

  INSERT INTO property_asset (subject_id, property_type, description, location, estimated_value, ownership_type, is_attached, attachment_order_ref, is_confiscated) VALUES
  (v_irfan, 'HOUSE', 'Two-storey house with basement (suspected stash house)', 'Gali Peer Wali, Tarn Taran', 4500000, 'SOLE', TRUE, 'ATT/TT/2023/045', FALSE),
  (v_irfan, 'LAND', 'Agricultural land 5 acres', 'Village Chohla Sahib, Tarn Taran', 12000000, 'BENAMI', FALSE, NULL, FALSE),
  (v_irfan, 'VEHICLE', 'Toyota Fortuner (PB-04-AX-1234)', 'Registered at Tarn Taran RTO', 2800000, 'SOLE', TRUE, 'ATT/TT/2023/046', FALSE),
  (v_balwinder, 'LAND', 'Farm land 25 acres near border', 'Village Hazara Singh Wala, Fazilka', 50000000, 'JOINT', TRUE, 'ATT/FZK/2022/089', FALSE),
  (v_balwinder, 'HOUSE', 'Pucca house with underground room', 'Village Hazara Singh Wala, Fazilka', 8000000, 'SOLE', TRUE, 'ATT/FZK/2022/090', FALSE),
  (v_balwinder, 'VEHICLE', 'Mahindra Scorpio (PB-07-BQ-5678)', 'Registered at Fazilka RTO', 1500000, 'SOLE', TRUE, 'ATT/FZK/2022/091', FALSE),
  (v_balwinder, 'LAND', 'Plot in Bathinda city', 'Sector 5, Bathinda', 15000000, 'BENAMI', FALSE, NULL, FALSE),
  (v_ranjit, 'HOUSE', 'Bungalow in Model Town', 'Bungalow 22, Model Town, Jalandhar', 35000000, 'SOLE', FALSE, NULL, FALSE),
  (v_ranjit, 'COMMERCIAL', 'Gold trading shop', 'Hall Bazaar, Jalandhar', 25000000, 'SOLE', TRUE, 'ED/JLD/2024/001', FALSE),
  (v_ranjit, 'LAND', 'Agricultural land 10 acres', 'Near Goraya, Jalandhar', 20000000, 'JOINT', FALSE, NULL, FALSE),
  (v_sanjay, 'FLAT', 'Luxury flat in Green Enclave', 'Flat 12B, Green Enclave, Ludhiana', 12000000, 'SOLE', TRUE, 'ED/LDH/2023/005', FALSE),
  (v_sanjay, 'COMMERCIAL', 'Textile export office', 'Industrial Area-B, Ludhiana', 8000000, 'SOLE', TRUE, 'ED/LDH/2023/006', FALSE),
  (v_rajesh, 'HOUSE', 'House in Katra Sher Singh', '127, Katra Sher Singh, Amritsar', 6000000, 'SOLE', FALSE, NULL, FALSE),
  (v_rajesh, 'COMMERCIAL', 'Transport office and 3 trucks', 'GT Road, Amritsar', 4500000, 'SOLE', FALSE, NULL, FALSE),
  (v_anil, 'LAND', 'Dairy farm 3 acres', 'Outskirts Abohar', 6000000, 'SOLE', FALSE, NULL, FALSE)
  ON CONFLICT DO NOTHING;

  -- ============================================================================
  -- 7. PHONES, IDENTITIES, ADDRESSES
  -- ============================================================================

  -- Phone numbers (link via subject_phone_link)
  INSERT INTO phone_number (raw_value, normalized_value, phone_type, is_active, registered_name, messaging_apps)
  SELECT v.raw_value, v.normalized_value, v.phone_type, v.is_active, v.registered_name, v.messaging_apps
  FROM (VALUES
    ('+91-98765-43210', '919876543210', 'MOBILE', TRUE, 'Rajesh Kumar', ARRAY['WhatsApp']),
    ('+91-98140-11111', '919814011111', 'MOBILE', TRUE, 'Irfan Khan', ARRAY['WhatsApp','Signal','Telegram']),
    ('+91-98140-11112', '919814011112', 'MOBILE', TRUE, 'Unknown (prepaid)', ARRAY['WhatsApp']),
    ('+91-94170-22222', '919417022222', 'MOBILE', TRUE, 'Balwinder Singh', ARRAY['WhatsApp']),
    ('+91-94170-22223', '919417022223', 'MOBILE', FALSE, 'Discontinued prepaid', NULL),
    ('+91-98140-33333', '919814033333', 'MOBILE', TRUE, 'Ranjit Mann', ARRAY['WhatsApp','iMessage']),
    ('+91-98140-44444', '919814044444', 'MOBILE', TRUE, 'Mohinder', ARRAY['WhatsApp']),
    ('+91-98150-55555', '919815055555', 'MOBILE', TRUE, 'Anil Yadav', ARRAY['WhatsApp']),
    ('+91-98760-66666', '919876066666', 'MOBILE', TRUE, 'Sanjay P', ARRAY['WhatsApp','Telegram']),
    ('+91-94170-77777', '919417077777', 'MOBILE', TRUE, 'Paramjit', ARRAY['WhatsApp']),
    ('+91-98140-88888', '919814088888', 'MOBILE', TRUE, 'Pradeep S', ARRAY['WhatsApp']),
    ('+91-98140-99999', '919814099999', 'MOBILE', TRUE, 'Deepak V', ARRAY['WhatsApp']),
    ('+91-98760-12345', '919876012345', 'MOBILE', TRUE, 'Gurpreet Sidhu', ARRAY['WhatsApp']),
    ('+91-98150-67890', '919815067890', 'MOBILE', TRUE, 'Lakshmi N', ARRAY['WhatsApp']),
    ('+91-98140-13579', '919814013579', 'MOBILE', TRUE, 'Vikram C', ARRAY['WhatsApp'])
  ) AS v(raw_value, normalized_value, phone_type, is_active, registered_name, messaging_apps)
  ON CONFLICT (normalized_value) DO NOTHING;

  -- Link phones to subjects
  INSERT INTO subject_phone_link (subject_id, phone_id, relationship, confidence, source_system)
  SELECT s.sid, p.phone_id, 'OWNER', 95, 'CCTNS'
  FROM (VALUES
    (v_rajesh, '919876543210'), (v_irfan, '919814011111'), (v_irfan, '919814011112'),
    (v_balwinder, '919417022222'), (v_balwinder, '919417022223'),
    (v_ranjit, '919814033333'), (v_mohinder, '919814044444'), (v_anil, '919815055555'),
    (v_sanjay, '919876066666'), (v_paramjit, '919417077777'),
    (v_pradeep, '919814088888'), (v_deepak, '919814099999'),
    (v_gurpreet, '919876012345'), (v_lakshmi, '919815067890'), (v_vikram, '919814013579')
  ) AS s(sid, norm)
  JOIN phone_number p ON p.normalized_value = s.norm
  ON CONFLICT DO NOTHING;

  -- Identity documents
  INSERT INTO identity_document (document_type, document_value, normalized_value, is_verified)
  SELECT v.doc_type, v.doc_value, v.norm_value, v.verified
  FROM (VALUES
    ('AADHAAR', 'XXXX-XXXX-1234', 'AADHAAR:XXXX1234', TRUE),
    ('PAN', 'ABCPK1234F', 'PAN:ABCPK1234F', TRUE),
    ('AADHAAR', 'XXXX-XXXX-5678', 'AADHAAR:XXXX5678', TRUE),
    ('PASSPORT', 'J12345678', 'PASSPORT:J12345678', FALSE),
    ('AADHAAR', 'XXXX-XXXX-9012', 'AADHAAR:XXXX9012', TRUE),
    ('DRIVING_LICENSE', 'PB0420190012345', 'DL:PB0420190012345', TRUE),
    ('AADHAAR', 'XXXX-XXXX-3456', 'AADHAAR:XXXX3456', TRUE),
    ('PAN', 'BCDRS5678G', 'PAN:BCDRS5678G', TRUE),
    ('AADHAAR', 'XXXX-XXXX-7890', 'AADHAAR:XXXX7890', TRUE),
    ('VOTER_ID', 'PB/04/123/456789', 'VOTER:PB04123456789', TRUE)
  ) AS v(doc_type, doc_value, norm_value, verified)
  ON CONFLICT (document_type, normalized_value) DO NOTHING;

  -- Link identities to subjects
  INSERT INTO subject_identity_link (subject_id, document_pk, confidence, source_system)
  SELECT s.sid, d.document_pk, 100, 'CCTNS'
  FROM (VALUES
    (v_irfan, 'AADHAAR:XXXX1234'), (v_irfan, 'PAN:ABCPK1234F'),
    (v_balwinder, 'AADHAAR:XXXX5678'), (v_balwinder, 'PASSPORT:J12345678'),
    (v_rajesh, 'AADHAAR:XXXX9012'), (v_rajesh, 'DL:PB0420190012345'),
    (v_ranjit, 'AADHAAR:XXXX3456'), (v_ranjit, 'PAN:BCDRS5678G'),
    (v_sanjay, 'AADHAAR:XXXX7890'), (v_paramjit, 'VOTER:PB04123456789')
  ) AS s(sid, norm)
  JOIN identity_document d ON d.normalized_value = s.norm
  ON CONFLICT DO NOTHING;

  -- Addresses
  INSERT INTO address (raw_address, district, state, pincode, address_type, village_town, tehsil)
  SELECT v.addr, v.dist, 'Punjab', v.pin, v.atype, v.vt, v.teh
  FROM (VALUES
    ('House No. 45, Gali Peer Wali, Tarn Taran', 'Tarn Taran', '143401', 'RESIDENTIAL', 'Tarn Taran', 'Tarn Taran'),
    ('Dhaba on GT Road near Harike checkpoint', 'Tarn Taran', '143409', 'OPERATIONAL', 'Harike', 'Patti'),
    ('Village Hazara Singh Wala, Fazilka', 'Fazilka', '152123', 'RESIDENTIAL', 'Hazara Singh Wala', 'Fazilka'),
    ('Farm house near BSF post, Hussainiwala', 'Ferozepur', '152002', 'HIDEOUT', 'Hussainiwala', 'Ferozepur'),
    ('127, Katra Sher Singh, Amritsar', 'Amritsar', '143001', 'RESIDENTIAL', 'Amritsar', 'Amritsar'),
    ('Transport office, GT Road, Amritsar', 'Amritsar', '143001', 'OFFICE', 'Amritsar', 'Amritsar'),
    ('Bungalow 22, Model Town, Jalandhar', 'Jalandhar', '144001', 'RESIDENTIAL', 'Jalandhar', 'Jalandhar'),
    ('Gold shop, Hall Bazaar, Jalandhar', 'Jalandhar', '144001', 'OFFICE', 'Jalandhar', 'Jalandhar'),
    ('Flat 12B, Green Enclave, Ludhiana', 'Ludhiana', '141002', 'RESIDENTIAL', 'Ludhiana', 'Ludhiana'),
    ('Ward No. 15, Abohar', 'Fazilka', '152116', 'RESIDENTIAL', 'Abohar', 'Abohar'),
    ('Dairy farm outskirts Abohar', 'Fazilka', '152116', 'OPERATIONAL', 'Abohar', 'Abohar'),
    ('Village Arniwala, Fazilka', 'Fazilka', '152123', 'RESIDENTIAL', 'Arniwala', 'Fazilka')
  ) AS v(addr, dist, pin, atype, vt, teh)
  WHERE NOT EXISTS (SELECT 1 FROM address WHERE raw_address = v.addr);

  -- Link addresses to subjects
  INSERT INTO subject_address_link (subject_id, address_id, relationship, is_current, source_system)
  SELECT s.sid, a.address_id, s.ltype, TRUE, 'CCTNS'
  FROM (VALUES
    (v_irfan, 'House No. 45, Gali Peer Wali, Tarn Taran', 'RESIDENT'),
    (v_irfan, 'Dhaba on GT Road near Harike checkpoint', 'FREQUENT'),
    (v_balwinder, 'Village Hazara Singh Wala, Fazilka', 'RESIDENT'),
    (v_balwinder, 'Farm house near BSF post, Hussainiwala', 'HIDEOUT'),
    (v_rajesh, '127, Katra Sher Singh, Amritsar', 'RESIDENT'),
    (v_rajesh, 'Transport office, GT Road, Amritsar', 'WORK'),
    (v_ranjit, 'Bungalow 22, Model Town, Jalandhar', 'RESIDENT'),
    (v_ranjit, 'Gold shop, Hall Bazaar, Jalandhar', 'WORK'),
    (v_sanjay, 'Flat 12B, Green Enclave, Ludhiana', 'RESIDENT'),
    (v_anil, 'Ward No. 15, Abohar', 'RESIDENT'),
    (v_anil, 'Dairy farm outskirts Abohar', 'FREQUENT'),
    (v_paramjit, 'Village Arniwala, Fazilka', 'RESIDENT')
  ) AS s(sid, addr, ltype)
  JOIN address a ON a.raw_address = s.addr
  ON CONFLICT DO NOTHING;

  -- ============================================================================
  -- 8. VEHICLES
  -- ============================================================================

  INSERT INTO vehicle (registration_no, normalized_reg, make, model, color, vehicle_type, year_of_manufacture, registered_owner_name, is_under_surveillance)
  SELECT v.reg, v.norm, v.mk, v.mdl, v.clr, v.vtype, v.yr, v.owner, v.surv
  FROM (VALUES
    ('PB-04-AX-1234', 'PB04AX1234', 'Toyota', 'Fortuner', 'White', 'SUV', 2021, 'Mohammed Irfan', TRUE),
    ('PB-04-BN-5678', 'PB04BN5678', 'Maruti', 'Swift', 'Grey', 'CAR', 2019, 'Rajesh Kumar Singh', TRUE),
    ('PB-07-BQ-5678', 'PB07BQ5678', 'Mahindra', 'Scorpio', 'Black', 'SUV', 2020, 'Balwinder Singh', TRUE),
    ('PB-07-CK-9012', 'PB07CK9012', 'Massey Ferguson', 'Tractor 241 DI', 'Red', 'TRACTOR', 2018, 'Gurbachan Singh (father)', FALSE),
    ('PB-08-DM-3456', 'PB08DM3456', 'Honda', 'City', 'Silver', 'CAR', 2022, 'Ranjit Singh Mann', FALSE),
    ('PB-13-EN-7890', 'PB13EN7890', 'Hyundai', 'Creta', 'Blue', 'SUV', 2023, 'Sanjay Patel', FALSE),
    ('PB-07-FK-2345', 'PB07FK2345', 'Tata', 'Ace', 'White', 'TRUCK', 2017, 'Anil Kumar Yadav', TRUE),
    ('PB-08-GL-6789', 'PB08GL6789', 'Bajaj', 'Auto Rickshaw', 'Green/Yellow', 'THREE_WHEELER', 2020, 'Gurpreet Singh Sidhu', FALSE),
    ('PB-11-HM-0123', 'PB11HM0123', 'Ashok Leyland', 'Ecomet 1615', 'White', 'TRUCK', 2019, 'Lakshmi Transport Co.', TRUE)
  ) AS v(reg, norm, mk, mdl, clr, vtype, yr, owner, surv)
  ON CONFLICT (normalized_reg) DO NOTHING;

  -- Link vehicles to subjects
  INSERT INTO subject_vehicle_link (subject_id, vehicle_id, relationship, confidence, source_system)
  SELECT s.sid, v.vehicle_id, 'OWNER', 95, 'RTO'
  FROM (VALUES
    (v_irfan, 'PB04AX1234'), (v_rajesh, 'PB04BN5678'),
    (v_balwinder, 'PB07BQ5678'), (v_balwinder, 'PB07CK9012'),
    (v_ranjit, 'PB08DM3456'), (v_sanjay, 'PB13EN7890'),
    (v_anil, 'PB07FK2345'), (v_gurpreet, 'PB08GL6789'),
    (v_lakshmi, 'PB11HM0123')
  ) AS s(sid, norm)
  JOIN vehicle v ON v.normalized_reg = s.norm
  ON CONFLICT DO NOTHING;

  -- ============================================================================
  -- 9. DEVICES
  -- ============================================================================

  INSERT INTO device (imei, normalized_imei, device_model, manufacturer, device_type, operating_system, forensic_extraction_status)
  SELECT v.imei, v.nimei, v.model, v.mfr, v.dtype, v.os, v.fstatus
  FROM (VALUES
    ('351234567890123', '351234567890123', 'iPhone 13', 'Apple', 'SMARTPHONE', 'iOS 17', 'COMPLETED'),
    ('351234567890124', '351234567890124', 'Samsung Galaxy S22', 'Samsung', 'SMARTPHONE', 'Android 14', 'COMPLETED'),
    ('351234567890125', '351234567890125', 'Redmi Note 12', 'Xiaomi', 'SMARTPHONE', 'Android 13', 'IN_PROGRESS'),
    ('351234567890126', '351234567890126', 'iPhone 14 Pro', 'Apple', 'SMARTPHONE', 'iOS 17', 'NOT_STARTED'),
    ('351234567890127', '351234567890127', 'Realme C55', 'Realme', 'SMARTPHONE', 'Android 13', 'COMPLETED'),
    ('351234567890128', '351234567890128', 'Samsung Galaxy A14', 'Samsung', 'SMARTPHONE', 'Android 13', 'NOT_STARTED'),
    ('351234567890129', '351234567890129', 'Vivo Y56', 'Vivo', 'SMARTPHONE', 'Android 13', 'NOT_STARTED')
  ) AS v(imei, nimei, model, mfr, dtype, os, fstatus)
  ON CONFLICT (normalized_imei) DO NOTHING;

  INSERT INTO subject_device_link (subject_id, device_id, relationship, confidence, source_system)
  SELECT s.sid, d.device_id, 'OWNER', 90, 'CDR_ANALYSIS'
  FROM (VALUES
    (v_irfan, '351234567890123'), (v_irfan, '351234567890124'),
    (v_balwinder, '351234567890125'), (v_ranjit, '351234567890126'),
    (v_mohinder, '351234567890127'), (v_pradeep, '351234567890128'),
    (v_gurpreet, '351234567890129')
  ) AS s(sid, nimei)
  JOIN device d ON d.normalized_imei = s.nimei
  ON CONFLICT DO NOTHING;

  -- ============================================================================
  -- 10. SOCIAL ACCOUNTS
  -- ============================================================================

  INSERT INTO social_account (platform, handle, normalized_handle, display_name, is_private, activity_status, flagged_content_count)
  SELECT v.plat, v.handle, v.norm, v.dname, v.priv, v.status, v.flags
  FROM (VALUES
    ('Facebook', 'irfan.khan.tt', 'facebook:irfan.khan.tt', 'Irfan Khan', TRUE, 'ACTIVE', 3),
    ('Instagram', 'irfan_trader82', 'instagram:irfan_trader82', 'Irfan', TRUE, 'ACTIVE', 5),
    ('Telegram', '@irfan_deals', 'telegram:irfan_deals', 'IK Deals', TRUE, 'ACTIVE', 12),
    ('Facebook', 'binder.singh.fzk', 'facebook:binder.singh.fzk', 'Binder Singh', FALSE, 'ACTIVE', 1),
    ('Instagram', 'rajesh_transport', 'instagram:rajesh_transport', 'Rajesh Transport', FALSE, 'ACTIVE', 0),
    ('Facebook', 'sanjay.patel.ldh', 'facebook:sanjay.patel.ldh', 'Sanjay Patel', FALSE, 'ACTIVE', 0),
    ('Instagram', 'ranjit_mann_jld', 'instagram:ranjit_mann_jld', 'Ranjit Mann', TRUE, 'ACTIVE', 2)
  ) AS v(plat, handle, norm, dname, priv, status, flags)
  ON CONFLICT (platform, normalized_handle) DO NOTHING;

  INSERT INTO subject_social_link (subject_id, social_id, relationship, confidence, source_system)
  SELECT s.sid, sa.social_id, 'OWNER', 85, 'OSINT'
  FROM (VALUES
    (v_irfan, 'facebook:irfan.khan.tt'), (v_irfan, 'instagram:irfan_trader82'), (v_irfan, 'telegram:irfan_deals'),
    (v_balwinder, 'facebook:binder.singh.fzk'),
    (v_rajesh, 'instagram:rajesh_transport'),
    (v_sanjay, 'facebook:sanjay.patel.ldh'),
    (v_ranjit, 'instagram:ranjit_mann_jld')
  ) AS s(sid, norm)
  JOIN social_account sa ON sa.normalized_handle = s.norm
  ON CONFLICT DO NOTHING;

  -- ============================================================================
  -- 11. LOCATION SIGHTINGS
  -- ============================================================================

  INSERT INTO location_sighting (subject_id, latitude, longitude, location_description, sighting_type, observed_at, confidence, evidence_reference) VALUES
  (v_irfan, 31.4505, 74.8632, 'Near Attari border checkpoint', 'FIELD_OBSERVATION', NOW() - INTERVAL '5 days', 90, 'Patrol report PR/TT/2026/0305'),
  (v_irfan, 31.4500, 75.0100, 'Harike toll plaza', 'ANPR', NOW() - INTERVAL '3 days', 95, 'ANPR camera feed #TT-07'),
  (v_irfan, 31.6340, 74.8723, 'Amritsar railway station area', 'CCTV', NOW() - INTERVAL '1 day', 85, 'CCTV-AMR-RS-CAM-12'),
  (v_balwinder, 30.4000, 74.0100, 'Farm near border post, Fazilka', 'FIELD_OBSERVATION', NOW() - INTERVAL '7 days', 92, 'Patrol report PR/FZK/2026/0304'),
  (v_balwinder, 30.3600, 74.2500, 'Abohar-Fazilka highway', 'ANPR', NOW() - INTERVAL '4 days', 95, 'ANPR camera feed #FZK-03'),
  (v_balwinder, 30.2100, 74.9500, 'Bathinda grain market area', 'INFORMANT_TIP', NOW() - INTERVAL '2 days', 70, 'Source report SR/BTH/2026/012'),
  (v_rajesh, 31.6300, 74.8700, 'GT Road near Amritsar', 'ANPR', NOW() - INTERVAL '2 days', 95, 'ANPR camera feed #AMR-15'),
  (v_rajesh, 31.4505, 74.8632, 'Tarn Taran market area', 'CCTV', NOW() - INTERVAL '1 day', 80, 'CCTV-TT-MKT-04'),
  (v_ranjit, 31.3260, 75.5762, 'Jalandhar Model Town market', 'CCTV', NOW() - INTERVAL '3 days', 85, 'CCTV-JLD-MT-08'),
  (v_mohinder, 30.9010, 75.8573, 'Ludhiana bus stand', 'CCTV', NOW() - INTERVAL '1 day', 75, 'CCTV-LDH-BS-11'),
  (v_paramjit, 30.4000, 74.0100, 'Near Fazilka border post', 'FIELD_OBSERVATION', NOW() - INTERVAL '6 days', 88, 'Patrol report PR/FZK/2026/0305'),
  (v_sanjay, 30.9010, 75.8573, 'Industrial Area-B, Ludhiana', 'FIELD_OBSERVATION', NOW() - INTERVAL '4 days', 82, 'Surveillance log SL/LDH/2026/018'),
  (v_anil, 30.1500, 74.2000, 'Abohar dairy market', 'INFORMANT_TIP', NOW() - INTERVAL '5 days', 65, 'Source report SR/FZK/2026/015'),
  (v_lakshmi, 30.2100, 74.9500, 'Bathinda bypass toll', 'ANPR', NOW() - INTERVAL '3 days', 95, 'ANPR camera feed #BTH-02')
  ON CONFLICT DO NOTHING;

  -- ============================================================================
  -- 12. HAWALA CONTACTS
  -- ============================================================================

  INSERT INTO hawala_contact (subject_id, contact_name, contact_phone, contact_location, hawala_route, estimated_volume, is_active, notes) VALUES
  (v_irfan, 'Khalid Mehmood (Pakistan)', NULL, 'Lahore, Pakistan', 'Lahore → Amritsar via Dubai', 5000000, TRUE, 'Primary Pakistan-side hawala operator. Never met directly — communication via intermediaries.'),
  (v_irfan, 'Rakesh Hawala', '+91-XXXXX-10101', 'Chandni Chowk, Delhi', 'Amritsar → Delhi → Ludhiana circuit', 3000000, TRUE, 'Delhi-based hawala operator handling drug money conversions.'),
  (v_balwinder, 'Ali Raza (Pakistan)', NULL, 'Karachi, Pakistan', 'Karachi → Fazilka border', 8000000, TRUE, 'Coordinates smuggling payments from Pakistan side.'),
  (v_balwinder, 'Bunty Hawala', '+91-XXXXX-20202', 'Bathinda, Punjab', 'Fazilka → Bathinda → Delhi', 2500000, TRUE, 'Local hawala agent converting drug money to real estate.'),
  (v_ranjit, 'Sunil Gupta', '+91-XXXXX-30303', 'Ludhiana, Punjab', 'Jalandhar → Ludhiana → Mumbai', 4000000, TRUE, 'Converts drug proceeds to gold via Ludhiana gold market.')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Crime history seed data inserted successfully.';
END $$;
