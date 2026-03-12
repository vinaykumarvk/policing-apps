-- Dashboard seed data for DOPAMS
-- Run: psql $DOPAMS_DATABASE_URL -f scripts/seed-dashboard.sql

-- Use actual IDs from the database
DO $$
DECLARE
  v_officer_id UUID;
  v_supervisor_id UUID;
  v_admin_id UUID;
  v_hq_id UUID;
  v_dist1_id UUID;
  v_dist2_id UUID;
  v_subj UUID;
  v_case UUID;
BEGIN
  SELECT user_id INTO v_officer_id FROM user_account WHERE username = 'officer1';
  SELECT user_id INTO v_supervisor_id FROM user_account WHERE username = 'supervisor1';
  SELECT user_id INTO v_admin_id FROM user_account WHERE username = 'admin';
  SELECT unit_id INTO v_hq_id FROM organization_unit WHERE code = 'HQ';
  SELECT unit_id INTO v_dist1_id FROM organization_unit WHERE code = 'DIST-1';
  SELECT unit_id INTO v_dist2_id FROM organization_unit WHERE code = 'DIST-2';

  -- ═══════════════════════════════════════
  -- SUBJECT PROFILES (20 subjects)
  -- ═══════════════════════════════════════

  INSERT INTO subject_profile (full_name, aliases, date_of_birth, gender, risk_score, state_id, unit_id, created_by, is_active,
    mobile_numbers, occupation, monitoring_status, threat_level, total_arrests, created_at)
  VALUES
    ('Rajesh Kumar Singh', '["Raju", "RK"]', '1985-03-15', 'MALE', 87.5, 'ACTIVE', v_dist1_id, v_officer_id, TRUE,
     '["9876543210","9123456789"]', 'Transporter', 'ACTIVE', 'HIGH', 3, NOW() - INTERVAL '45 days'),
    ('Pradeep Sharma', '["Pradip"]', '1990-07-22', 'MALE', 72.0, 'ACTIVE', v_dist1_id, v_officer_id, TRUE,
     '["8765432109"]', 'Unemployed', 'ACTIVE', 'HIGH', 2, NOW() - INTERVAL '40 days'),
    ('Sunita Devi', '["Suni"]', '1988-11-05', 'FEMALE', 45.0, 'ACTIVE', v_dist2_id, v_officer_id, TRUE,
     '["7654321098"]', 'Vendor', 'PERIODIC', 'MEDIUM', 1, NOW() - INTERVAL '38 days'),
    ('Mohammed Irfan', '["Irfan bhai"]', '1982-01-20', 'MALE', 92.3, 'ACTIVE', v_dist2_id, v_officer_id, TRUE,
     '["9988776655","8877665544"]', 'Trader', 'ACTIVE', 'CRITICAL', 5, NOW() - INTERVAL '60 days'),
    ('Gurpreet Singh Sidhu', '["Sidhu", "Guri"]', '1995-05-10', 'MALE', 65.0, 'ACTIVE', v_dist1_id, v_officer_id, TRUE,
     '["9112233445"]', 'Driver', 'ACTIVE', 'MEDIUM', 1, NOW() - INTERVAL '30 days'),
    ('Anil Kumar Yadav', '["Anilu"]', '1978-09-18', 'MALE', 81.0, 'ACTIVE', v_hq_id, v_officer_id, TRUE,
     '["9001122334"]', 'Retired', 'ACTIVE', 'HIGH', 4, NOW() - INTERVAL '55 days'),
    ('Parminder Kaur', '[]', '1992-12-25', 'FEMALE', 38.0, 'ACTIVE', v_dist1_id, v_officer_id, TRUE,
     '["7001234567"]', 'Housewife', 'NONE', 'LOW', 0, NOW() - INTERVAL '25 days'),
    ('Vikram Chauhan', '["Vicky"]', '1987-04-30', 'MALE', 55.0, 'ACTIVE', v_dist2_id, v_supervisor_id, TRUE,
     '["9223344556"]', 'Mechanic', 'PERIODIC', 'MEDIUM', 1, NOW() - INTERVAL '20 days'),
    ('Deepak Verma', '["Deepu"]', '1991-08-14', 'MALE', 69.0, 'ACTIVE', v_dist1_id, v_officer_id, TRUE,
     '["8334455667"]', 'Student', 'ACTIVE', 'MEDIUM', 2, NOW() - INTERVAL '15 days'),
    ('Ranjit Singh Mann', '["Manna"]', '1980-02-28', 'MALE', 88.0, 'ACTIVE', v_dist2_id, v_officer_id, TRUE,
     '["9445566778"]', 'Farmer', 'ACTIVE', 'HIGH', 3, NOW() - INTERVAL '50 days'),
    ('Harpreet Kaur Dhillon', '[]', '1993-06-12', 'FEMALE', 42.0, 'DRAFT', v_dist1_id, v_officer_id, TRUE,
     '["8556677889"]', 'Teacher', 'NONE', 'LOW', 0, NOW() - INTERVAL '10 days'),
    ('Sanjay Patel', '["Sanju"]', '1986-10-08', 'MALE', 76.5, 'ACTIVE', v_hq_id, v_supervisor_id, TRUE,
     '["9667788990"]', 'Businessman', 'ACTIVE', 'HIGH', 2, NOW() - INTERVAL '35 days'),
    ('Lakshmi Narayan', '[]', '1975-03-22', 'MALE', 58.0, 'ACTIVE', v_dist2_id, v_officer_id, TRUE,
     '["7778899001"]', 'Shopkeeper', 'PERIODIC', 'MEDIUM', 1, NOW() - INTERVAL '42 days'),
    ('Balwinder Singh', '["Binder"]', '1983-07-19', 'MALE', 95.0, 'ACTIVE', v_dist1_id, v_officer_id, TRUE,
     '["9889900112"]', 'Unemployed', 'ACTIVE', 'CRITICAL', 6, NOW() - INTERVAL '70 days'),
    ('Kamaljeet Kaur', '[]', '1994-01-05', 'FEMALE', 33.0, 'DRAFT', v_dist2_id, v_officer_id, TRUE,
     '["8990011223"]', 'Nurse', 'NONE', 'LOW', 0, NOW() - INTERVAL '5 days'),
    ('Ajay Thakur', '["AJ"]', '1989-11-30', 'MALE', 62.0, 'ACTIVE', v_dist1_id, v_officer_id, TRUE,
     '["7001122334"]', 'Labourer', 'PERIODIC', 'MEDIUM', 1, NOW() - INTERVAL '28 days'),
    ('Mohinder Pal', '["Mohi"]', '1977-05-15', 'MALE', 84.0, 'ACTIVE', v_hq_id, v_officer_id, TRUE,
     '["9112233446"]', 'Contractor', 'ACTIVE', 'HIGH', 4, NOW() - INTERVAL '65 days'),
    ('Neha Gupta', '[]', '1996-09-20', 'FEMALE', 28.0, 'DRAFT', v_dist1_id, v_officer_id, TRUE,
     '["8223344557"]', 'Student', 'NONE', 'LOW', 0, NOW() - INTERVAL '3 days'),
    ('Paramjit Singh Brar', '["Brar"]', '1981-12-10', 'MALE', 79.0, 'ACTIVE', v_dist2_id, v_officer_id, TRUE,
     '["9334455668"]', 'Ex-Armyman', 'ACTIVE', 'HIGH', 3, NOW() - INTERVAL '48 days'),
    ('Sukhwinder Kaur', '["Sukhi"]', '1990-04-18', 'FEMALE', 51.0, 'ACTIVE', v_dist1_id, v_supervisor_id, TRUE,
     '["8445566779"]', 'Social Worker', 'PERIODIC', 'MEDIUM', 1, NOW() - INTERVAL '22 days');

  -- ═══════════════════════════════════════
  -- CASES (15 cases across districts)
  -- ═══════════════════════════════════════

  INSERT INTO dopams_case (case_number, title, description, case_type, priority, state_id, unit_id, assigned_to, created_by, created_at, updated_at)
  VALUES
    ('DOP-C-2026-000001', 'Chitta supply chain — Amritsar sector', 'Large-scale heroin distribution network identified via CDR analysis', 'DRUG_TRAFFICKING', 'CRITICAL', 'OPEN', v_dist1_id, v_officer_id, v_admin_id, NOW() - INTERVAL '30 days', NOW() - INTERVAL '2 days'),
    ('DOP-C-2026-000002', 'Cannabis cultivation — Hoshiarpur belt', 'Multiple farmlands identified with cannabis cultivation', 'DRUG_CULTIVATION', 'HIGH', 'OPEN', v_dist2_id, v_officer_id, v_admin_id, NOW() - INTERVAL '25 days', NOW() - INTERVAL '5 days'),
    ('DOP-C-2026-000003', 'Pharmaceutical diversion ring', 'Tramadol and codeine diversion from pharma supply chain', 'DRUG_DIVERSION', 'HIGH', 'INVESTIGATION', v_dist1_id, v_officer_id, v_supervisor_id, NOW() - INTERVAL '20 days', NOW() - INTERVAL '1 day'),
    ('DOP-C-2026-000004', 'Inter-state smuggling via GT Road', 'Heroin smuggling network using commercial vehicles', 'DRUG_TRAFFICKING', 'CRITICAL', 'INVESTIGATION', v_hq_id, v_supervisor_id, v_admin_id, NOW() - INTERVAL '18 days', NOW() - INTERVAL '3 days'),
    ('DOP-C-2026-000005', 'Dark web drug marketplace', 'Crypto-enabled drug sales targeting Punjab youth', 'CYBER_NARCOTICS', 'HIGH', 'OPEN', v_hq_id, v_officer_id, v_admin_id, NOW() - INTERVAL '15 days', NOW() - INTERVAL '4 days'),
    ('DOP-C-2026-000006', 'School zone peddling — Ludhiana', 'Multiple reports of drug peddling near schools', 'DRUG_PEDDLING', 'CRITICAL', 'INVESTIGATION', v_dist1_id, v_officer_id, v_supervisor_id, NOW() - INTERVAL '12 days', NOW() - INTERVAL '1 day'),
    ('DOP-C-2026-000007', 'Financial trail — hawala network', 'Suspicious hawala transactions linked to drug money', 'MONEY_LAUNDERING', 'HIGH', 'OPEN', v_dist2_id, v_supervisor_id, v_admin_id, NOW() - INTERVAL '10 days', NOW() - INTERVAL '6 days'),
    ('DOP-C-2026-000008', 'Cross-border drone drops', 'Drone-based heroin drops along border fence', 'DRUG_TRAFFICKING', 'CRITICAL', 'INVESTIGATION', v_dist2_id, v_officer_id, v_admin_id, NOW() - INTERVAL '8 days', NOW() - INTERVAL '1 day'),
    ('DOP-C-2026-000009', 'Social media drug solicitation', 'Instagram/Telegram channels selling drugs', 'CYBER_NARCOTICS', 'MEDIUM', 'OPEN', v_hq_id, v_officer_id, v_supervisor_id, NOW() - INTERVAL '7 days', NOW() - INTERVAL '3 days'),
    ('DOP-C-2026-000010', 'NDPS Act violation — repeat offender', 'Balwinder Singh repeat NDPS violations', 'NDPS_VIOLATION', 'HIGH', 'CHARGESHEET', v_dist1_id, v_officer_id, v_admin_id, NOW() - INTERVAL '45 days', NOW() - INTERVAL '10 days'),
    ('DOP-C-2026-000011', 'Synthetic drug lab — Jalandhar', 'Suspected methamphetamine production facility', 'DRUG_MANUFACTURING', 'CRITICAL', 'INVESTIGATION', v_dist1_id, v_supervisor_id, v_admin_id, NOW() - INTERVAL '5 days', NOW()),
    ('DOP-C-2026-000012', 'Truck seizure — 5kg heroin', 'Heroin seized from commercial truck at Wagah checkpoint', 'DRUG_SEIZURE', 'HIGH', 'CLOSED', v_dist2_id, v_officer_id, v_admin_id, NOW() - INTERVAL '60 days', NOW() - INTERVAL '20 days'),
    ('DOP-C-2026-000013', 'Youth rehabilitation referrals', 'Monitoring addicts referred from de-addiction centers', 'REHABILITATION', 'MEDIUM', 'OPEN', v_dist1_id, v_officer_id, v_supervisor_id, NOW() - INTERVAL '14 days', NOW() - INTERVAL '7 days'),
    ('DOP-C-2026-000014', 'Opium poppy seizure — Fazilka', 'Illegal opium cultivation detected via satellite imagery', 'DRUG_CULTIVATION', 'HIGH', 'INVESTIGATION', v_dist2_id, v_supervisor_id, v_admin_id, NOW() - INTERVAL '3 days', NOW()),
    ('DOP-C-2026-000015', 'Prescription fraud network', 'Forged prescriptions for controlled substances', 'DRUG_DIVERSION', 'MEDIUM', 'OPEN', v_hq_id, v_officer_id, v_admin_id, NOW() - INTERVAL '2 days', NOW());

  -- ═══════════════════════════════════════
  -- ALERTS (40 alerts, varied severities, states, types, time-spread)
  -- ═══════════════════════════════════════

  INSERT INTO alert (alert_type, severity, title, description, state_id, unit_id, assigned_to, created_at, due_at)
  VALUES
    -- CRITICAL alerts
    ('SUSPICIOUS_TRANSACTION', 'CRITICAL', 'Large cash deposit — Rajesh Kumar Singh', 'Rs. 15L deposited in 3 accounts within 24h', 'NEW', v_dist1_id, v_officer_id, NOW() - INTERVAL '2 hours', NOW() + INTERVAL '4 hours'),
    ('GEOFENCE_BREACH', 'CRITICAL', 'Subject entered restricted border zone', 'Mohammed Irfan crossed border geofence at 0300h', 'ACKNOWLEDGED', v_dist2_id, v_supervisor_id, NOW() - INTERVAL '6 hours', NOW() + INTERVAL '2 hours'),
    ('CDR_ANOMALY', 'CRITICAL', 'Burst communication detected', '47 calls in 2 hours between 3 known subjects', 'ESCALATED', v_dist1_id, v_supervisor_id, NOW() - INTERVAL '1 day', NOW() - INTERVAL '12 hours'),
    ('SEIZURE_INTELLIGENCE', 'CRITICAL', 'Tip-off: Drug consignment arriving via rail', 'HUMINT source reports 10kg heroin shipment', 'NEW', v_hq_id, v_officer_id, NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '6 hours'),
    ('SOCIAL_MEDIA_FLAG', 'CRITICAL', 'Dark web marketplace listing detected', 'New bulk heroin listing linked to Punjab network', 'IN_REVIEW', v_hq_id, v_officer_id, NOW() - INTERVAL '3 hours', NOW() + INTERVAL '8 hours'),

    -- HIGH alerts
    ('CDR_ANOMALY', 'HIGH', 'New phone number activated by subject', 'Pradeep Sharma activated new SIM card', 'NEW', v_dist1_id, v_officer_id, NOW() - INTERVAL '4 hours', NOW() + INTERVAL '12 hours'),
    ('FINANCIAL_ALERT', 'HIGH', 'Suspicious UPI transfers — circular pattern', 'Rs. 3.5L circulated through 5 UPI IDs', 'ACKNOWLEDGED', v_dist2_id, v_officer_id, NOW() - INTERVAL '8 hours', NOW() + INTERVAL '16 hours'),
    ('SURVEILLANCE_HIT', 'HIGH', 'Subject spotted at known drug hotspot', 'CCTV match: Vikram Chauhan at Maqboolpura', 'NEW', v_dist2_id, v_supervisor_id, NOW() - INTERVAL '5 hours', NOW() + INTERVAL '10 hours'),
    ('INFORMANT_TIP', 'HIGH', 'Toll-free tip: Drug party in farmhouse', 'Caller reports drug party at Jalandhar farmhouse', 'ACKNOWLEDGED', v_dist1_id, v_officer_id, NOW() - INTERVAL '3 hours', NOW() + INTERVAL '6 hours'),
    ('COURT_ORDER', 'HIGH', 'Bail granted to key accused', 'Ranjit Singh Mann granted bail by Sessions Court', 'NEW', v_dist2_id, v_supervisor_id, NOW() - INTERVAL '1 day', NOW() + INTERVAL '24 hours'),
    ('CDR_ANOMALY', 'HIGH', 'Cross-border call spike detected', '23 calls to Pakistan numbers in 48 hours', 'ESCALATED', v_dist2_id, v_officer_id, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),
    ('DRUG_SEIZURE', 'HIGH', 'Heroin recovered from vehicle', '2.5kg heroin found in modified fuel tank', 'RESOLVED', v_dist1_id, v_officer_id, NOW() - INTERVAL '10 days', NOW() - INTERVAL '8 days'),
    ('SOCIAL_MEDIA_FLAG', 'HIGH', 'Coded drug solicitation on Telegram', 'Channel using emoji codes for drug types', 'IN_REVIEW', v_hq_id, v_officer_id, NOW() - INTERVAL '1 day', NOW() + INTERVAL '20 hours'),

    -- MEDIUM alerts
    ('ROUTINE_CHECK', 'MEDIUM', 'Monthly monitoring check due — Sunita Devi', 'Periodic contact and location verification', 'NEW', v_dist2_id, v_officer_id, NOW() - INTERVAL '1 day', NOW() + INTERVAL '3 days'),
    ('CDR_ANOMALY', 'MEDIUM', 'Unusual late-night calls', 'Deepak Verma made 12 calls between 1-4 AM', 'ACKNOWLEDGED', v_dist1_id, v_officer_id, NOW() - INTERVAL '2 days', NOW() + INTERVAL '2 days'),
    ('FINANCIAL_ALERT', 'MEDIUM', 'Multiple small withdrawals pattern', 'Structuring suspected — 8 ATM withdrawals of Rs. 49K each', 'NEW', v_hq_id, v_supervisor_id, NOW() - INTERVAL '3 days', NOW() + INTERVAL '4 days'),
    ('INFORMANT_TIP', 'MEDIUM', 'Informant reports new peddler in area', 'Unknown male selling near bus stand', 'ACKNOWLEDGED', v_dist1_id, v_officer_id, NOW() - INTERVAL '4 days', NOW() + INTERVAL '3 days'),
    ('SURVEILLANCE_HIT', 'MEDIUM', 'Subject meeting with unknown person', 'Ajay Thakur observed meeting at dhaba', 'NEW', v_dist1_id, v_officer_id, NOW() - INTERVAL '1 day', NOW() + INTERVAL '2 days'),
    ('ROUTINE_CHECK', 'MEDIUM', 'Rehabilitation follow-up due', 'Quarterly check for de-addiction referral group', 'NEW', v_dist1_id, v_officer_id, NOW() - INTERVAL '5 days', NOW() + INTERVAL '2 days'),
    ('CDR_ANOMALY', 'MEDIUM', 'New contact identified in CDR', 'Sukhwinder Kaur called unknown number 15 times', 'ACKNOWLEDGED', v_dist1_id, v_officer_id, NOW() - INTERVAL '2 days', NOW() + INTERVAL '5 days'),
    ('SOCIAL_MEDIA_FLAG', 'MEDIUM', 'Suspicious Instagram post', 'Subject posted photo with drug paraphernalia', 'NEW', v_dist2_id, v_officer_id, NOW() - INTERVAL '6 hours', NOW() + INTERVAL '48 hours'),
    ('FINANCIAL_ALERT', 'MEDIUM', 'New bank account opened', 'Sanjay Patel opened account in different state', 'RESOLVED', v_dist2_id, v_officer_id, NOW() - INTERVAL '15 days', NOW() - INTERVAL '10 days'),

    -- LOW alerts
    ('ROUTINE_CHECK', 'LOW', 'Address verification pending', 'Parminder Kaur new address needs verification', 'NEW', v_dist1_id, v_officer_id, NOW() - INTERVAL '7 days', NOW() + INTERVAL '7 days'),
    ('DATA_QUALITY', 'LOW', 'Duplicate subject profile detected', 'Possible duplicate of Lakshmi Narayan', 'NEW', v_dist2_id, v_officer_id, NOW() - INTERVAL '3 days', NOW() + INTERVAL '14 days'),
    ('ROUTINE_CHECK', 'LOW', 'Employment verification update', 'Neha Gupta employment status needs refresh', 'ACKNOWLEDGED', v_dist1_id, v_officer_id, NOW() - INTERVAL '5 days', NOW() + INTERVAL '10 days'),

    -- Historical/closed alerts for trends
    ('DRUG_SEIZURE', 'CRITICAL', 'Major seizure — 10kg heroin', 'Interstate highway checkpoint seizure', 'CLOSED', v_hq_id, v_officer_id, NOW() - INTERVAL '25 days', NOW() - INTERVAL '20 days'),
    ('GEOFENCE_BREACH', 'HIGH', 'Border zone entry — resolved', 'False alarm — authorized personnel', 'RESOLVED', v_dist2_id, v_supervisor_id, NOW() - INTERVAL '20 days', NOW() - INTERVAL '18 days'),
    ('CDR_ANOMALY', 'HIGH', 'Communication burst — investigated', 'Burst was related to family emergency', 'CLOSED', v_dist1_id, v_officer_id, NOW() - INTERVAL '18 days', NOW() - INTERVAL '15 days'),
    ('SUSPICIOUS_TRANSACTION', 'CRITICAL', 'Hawala transaction intercepted', 'Rs. 25L hawala linked to Irfan network', 'CLOSED', v_dist2_id, v_supervisor_id, NOW() - INTERVAL '22 days', NOW() - INTERVAL '15 days'),
    ('INFORMANT_TIP', 'HIGH', 'Tip verified — case opened', 'Led to DOP-C-2026-000006', 'CLOSED', v_dist1_id, v_officer_id, NOW() - INTERVAL '15 days', NOW() - INTERVAL '12 days'),
    ('FINANCIAL_ALERT', 'MEDIUM', 'Benami property flagged', 'Land purchase in different name', 'RESOLVED', v_hq_id, v_supervisor_id, NOW() - INTERVAL '28 days', NOW() - INTERVAL '20 days'),
    ('CDR_ANOMALY', 'MEDIUM', 'IMEI change detected', 'Subject changed phone — new IMEI logged', 'RESOLVED', v_dist1_id, v_officer_id, NOW() - INTERVAL '14 days', NOW() - INTERVAL '10 days'),
    ('SOCIAL_MEDIA_FLAG', 'HIGH', 'Facebook group promoting drugs', 'Coded messages in regional language group', 'CLOSED', v_hq_id, v_officer_id, NOW() - INTERVAL '12 days', NOW() - INTERVAL '8 days'),
    ('SURVEILLANCE_HIT', 'MEDIUM', 'Vehicle spotted near border', 'Registered to known associate', 'RESOLVED', v_dist2_id, v_officer_id, NOW() - INTERVAL '16 days', NOW() - INTERVAL '12 days'),
    ('DRUG_SEIZURE', 'HIGH', 'Cannabis plants destroyed', '500 plants destroyed in Hoshiarpur operation', 'CLOSED', v_dist2_id, v_officer_id, NOW() - INTERVAL '30 days', NOW() - INTERVAL '28 days'),

    -- More recent alerts for trend data
    ('SUSPICIOUS_TRANSACTION', 'HIGH', 'Crypto purchase flagged', 'Large Bitcoin purchase by monitored subject', 'NEW', v_hq_id, v_officer_id, NOW() - INTERVAL '12 hours', NOW() + INTERVAL '24 hours'),
    ('CDR_ANOMALY', 'MEDIUM', 'Tower dump match', 'Subject phone found in tower dump near seizure site', 'ACKNOWLEDGED', v_dist1_id, v_officer_id, NOW() - INTERVAL '1 day', NOW() + INTERVAL '3 days'),
    ('GEOFENCE_BREACH', 'HIGH', 'Subject left district jurisdiction', 'Paramjit Singh Brar crossed into Rajasthan', 'NEW', v_dist2_id, v_supervisor_id, NOW() - INTERVAL '3 hours', NOW() + INTERVAL '12 hours'),
    ('INFORMANT_TIP', 'CRITICAL', 'High-value target sighting', 'Top supplier spotted at Chandigarh hotel', 'NEW', v_hq_id, v_supervisor_id, NOW() - INTERVAL '1 hour', NOW() + INTERVAL '3 hours'),
    ('DRUG_SEIZURE', 'CRITICAL', '3kg ice (methamphetamine) seized', 'Seized from apartment in Mohali', 'ACKNOWLEDGED', v_dist1_id, v_officer_id, NOW() - INTERVAL '5 hours', NOW() + INTERVAL '6 hours');

  -- ═══════════════════════════════════════
  -- LEADS (25 leads across districts)
  -- ═══════════════════════════════════════

  INSERT INTO lead (source_type, summary, details, priority, state_id, unit_id, assigned_to, created_by, created_at, updated_at)
  VALUES
    ('TOLL_FREE', 'Drug peddling near Government School', 'Caller reports daily drug sales near school gate between 2-4 PM', 'CRITICAL', 'NEW', v_dist1_id, v_officer_id, v_admin_id, NOW() - INTERVAL '1 day', NOW()),
    ('INFORMANT', 'Heroin stored in cold storage facility', 'Reliable informant reports 5kg heroin hidden in vegetable cold storage', 'CRITICAL', 'ASSIGNED', v_dist2_id, v_officer_id, v_admin_id, NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day'),
    ('CDR_ANALYSIS', 'Communication cluster indicates new network', 'CDR analysis reveals 8-node communication cluster with border calls', 'HIGH', 'INVESTIGATION', v_hq_id, v_supervisor_id, v_admin_id, NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days'),
    ('FINANCIAL', 'Suspicious property purchases by drug convict', 'Ex-convict purchased 3 properties worth Rs. 2Cr in family names', 'HIGH', 'ASSIGNED', v_dist1_id, v_officer_id, v_admin_id, NOW() - INTERVAL '7 days', NOW() - INTERVAL '3 days'),
    ('SOCIAL_MEDIA', 'Instagram account selling drugs openly', 'Account with 5K followers posting drug price lists', 'HIGH', 'NEW', v_hq_id, v_officer_id, v_admin_id, NOW() - INTERVAL '2 days', NOW()),
    ('TOLL_FREE', 'Abandoned vehicle with suspicious packages', 'Caller reports suspicious vehicle near railway crossing', 'MEDIUM', 'INVESTIGATION', v_dist2_id, v_officer_id, v_admin_id, NOW() - INTERVAL '4 days', NOW() - INTERVAL '1 day'),
    ('PATROL', 'Unusual activity at warehouse', 'Beat patrol reports vehicles arriving/departing at odd hours', 'MEDIUM', 'ASSIGNED', v_dist1_id, v_officer_id, v_admin_id, NOW() - INTERVAL '6 days', NOW() - INTERVAL '2 days'),
    ('INFORMANT', 'New supplier from Rajasthan identified', 'Source reports new opium supplier operating from Fazilka border', 'HIGH', 'NEW', v_dist2_id, v_supervisor_id, v_admin_id, NOW() - INTERVAL '1 day', NOW()),
    ('CDR_ANALYSIS', 'Phone number linked to 3 seizure cases', 'Same unregistered number found in CDR of 3 separate seizure cases', 'CRITICAL', 'INVESTIGATION', v_hq_id, v_officer_id, v_admin_id, NOW() - INTERVAL '10 days', NOW() - INTERVAL '3 days'),
    ('SOCIAL_MEDIA', 'Telegram channel with 2K members — drug code words', 'Channel uses emoji codes matching DEA drug emoji patterns', 'MEDIUM', 'NEW', v_hq_id, v_officer_id, v_admin_id, NOW() - INTERVAL '3 days', NOW()),
    ('FINANCIAL', 'Crypto wallet linked to drug marketplace', 'Bitcoin wallet address found on seized phone matches dark web vendor', 'HIGH', 'ASSIGNED', v_hq_id, v_supervisor_id, v_admin_id, NOW() - INTERVAL '8 days', NOW() - INTERVAL '2 days'),
    ('TOLL_FREE', 'Drug party at farmhouse — urgent', 'Anonymous tip about ongoing drug party with minors', 'CRITICAL', 'CLOSED', v_dist1_id, v_officer_id, v_admin_id, NOW() - INTERVAL '15 days', NOW() - INTERVAL '14 days'),
    ('INFORMANT', 'Corrupt official facilitating transport', 'Source alleges RTO official clearing drug vehicles', 'HIGH', 'INVESTIGATION', v_dist2_id, v_supervisor_id, v_admin_id, NOW() - INTERVAL '12 days', NOW() - INTERVAL '5 days'),
    ('PATROL', 'Needle marks on multiple youth', 'SHO reports increase in injection drug use in colony', 'MEDIUM', 'ASSIGNED', v_dist1_id, v_officer_id, v_admin_id, NOW() - INTERVAL '9 days', NOW() - INTERVAL '4 days'),
    ('CDR_ANALYSIS', 'Subject reactivated dormant SIM', 'Previously deactivated SIM of convicted trafficker back online', 'HIGH', 'NEW', v_dist1_id, v_officer_id, v_admin_id, NOW() - INTERVAL '2 days', NOW()),
    ('TOLL_FREE', 'Drug peddling in bus stand area', 'Multiple callers report same location over 3 days', 'MEDIUM', 'CONVERTED', v_dist2_id, v_officer_id, v_admin_id, NOW() - INTERVAL '20 days', NOW() - INTERVAL '15 days'),
    ('SOCIAL_MEDIA', 'YouTube video glorifying drug use', 'Punjabi music video with explicit drug references — 50K views', 'LOW', 'NEW', v_hq_id, v_officer_id, v_admin_id, NOW() - INTERVAL '4 days', NOW()),
    ('INFORMANT', 'Drone spotted near border at night', 'Source reports drone activity near Attari sector — possible drug drops', 'CRITICAL', 'ASSIGNED', v_dist2_id, v_supervisor_id, v_admin_id, NOW() - INTERVAL '1 day', NOW()),
    ('FINANCIAL', 'Hawala operator identified', 'FIU report flags hawala operator linked to drug money', 'HIGH', 'NEW', v_dist1_id, v_supervisor_id, v_admin_id, NOW() - INTERVAL '3 days', NOW()),
    ('PATROL', 'Discarded drug packaging found', 'Empty heroin packets found near railway tracks', 'LOW', 'CLOSED', v_dist1_id, v_officer_id, v_admin_id, NOW() - INTERVAL '25 days', NOW() - INTERVAL '22 days'),
    ('CDR_ANALYSIS', 'International call pattern — drug network', 'Regular calls to Afghanistan numbers by monitored subjects', 'HIGH', 'INVESTIGATION', v_hq_id, v_officer_id, v_admin_id, NOW() - INTERVAL '6 days', NOW() - INTERVAL '2 days'),
    ('TOLL_FREE', 'De-addiction center reports patient absconding', 'Patient under mandatory rehab left without discharge', 'MEDIUM', 'ASSIGNED', v_dist2_id, v_officer_id, v_admin_id, NOW() - INTERVAL '2 days', NOW()),
    ('INFORMANT', 'Lab equipment purchased in bulk', 'Source reports purchase of lab-grade chemicals from Ludhiana market', 'HIGH', 'NEW', v_dist1_id, v_officer_id, v_admin_id, NOW() - INTERVAL '12 hours', NOW()),
    ('SOCIAL_MEDIA', 'WhatsApp group sharing drug delivery contacts', 'Group with 300+ members sharing peddler phone numbers', 'HIGH', 'NEW', v_dist1_id, v_officer_id, v_admin_id, NOW() - INTERVAL '6 hours', NOW()),
    ('FINANCIAL', 'Structuring detected — multiple accounts', 'Same-day deposits under Rs. 50K in 6 different banks', 'MEDIUM', 'ASSIGNED', v_hq_id, v_supervisor_id, v_admin_id, NOW() - INTERVAL '4 days', NOW() - INTERVAL '1 day');

  RAISE NOTICE 'Dashboard seed data created successfully';
END $$;
