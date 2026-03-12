-- Seed data: Bank accounts, UPI accounts, subject links, financial transactions
-- Run: psql $DOPAMS_DATABASE_URL -f scripts/seed-transactions.sql
-- Prerequisite: seed-dashboard.sql (subject_profile rows must exist)

DO $$
DECLARE
  -- Subject IDs (looked up by full_name)
  v_irfan      UUID;
  v_balwinder  UUID;
  v_rajesh     UUID;
  v_sanjay     UUID;
  v_anil       UUID;
  v_ranjit     UUID;
  v_mohinder   UUID;
  v_deepak     UUID;
  v_pradeep    UUID;
  v_gurpreet   UUID;
  v_vikram     UUID;
  v_paramjit   UUID;

  -- Bank account IDs
  v_ba_irfan_sbi     UUID;
  v_ba_irfan_pnb     UUID;
  v_ba_balwinder_sbi UUID;
  v_ba_balwinder_axis UUID;
  v_ba_rajesh_pnb    UUID;
  v_ba_sanjay_hdfc   UUID;
  v_ba_anil_sbi      UUID;
  v_ba_ranjit_pnb    UUID;
  v_ba_mohinder_sbi  UUID;
  v_ba_deepak_psb    UUID;
  v_ba_shared_biz    UUID;  -- shared business account (Irfan + Rajesh)
  v_ba_ext_hawala    UUID;  -- external hawala operator
  v_ba_ext_supplier  UUID;  -- external supplier

  -- UPI account IDs
  v_upi_irfan1    UUID;
  v_upi_irfan2    UUID;
  v_upi_balwinder UUID;
  v_upi_rajesh    UUID;
  v_upi_pradeep   UUID;
  v_upi_gurpreet  UUID;
  v_upi_vikram    UUID;
  v_upi_paramjit  UUID;
  v_upi_ext_supplier UUID;
  v_upi_ext_dhaba    UUID;

BEGIN
  -- ═══════════════════════════════════════
  -- RESOLVE SUBJECT IDs
  -- ═══════════════════════════════════════
  SELECT subject_id INTO v_irfan FROM subject_profile WHERE full_name = 'Mohammed Irfan' AND is_merged = FALSE LIMIT 1;
  SELECT subject_id INTO v_balwinder FROM subject_profile WHERE full_name = 'Balwinder Singh' AND is_merged = FALSE LIMIT 1;
  SELECT subject_id INTO v_rajesh FROM subject_profile WHERE full_name = 'Rajesh Kumar Singh' AND is_merged = FALSE LIMIT 1;
  SELECT subject_id INTO v_sanjay FROM subject_profile WHERE full_name = 'Sanjay Patel' AND is_merged = FALSE LIMIT 1;
  SELECT subject_id INTO v_anil FROM subject_profile WHERE full_name = 'Anil Kumar Yadav' AND is_merged = FALSE LIMIT 1;
  SELECT subject_id INTO v_ranjit FROM subject_profile WHERE full_name = 'Ranjit Singh Mann' AND is_merged = FALSE LIMIT 1;
  SELECT subject_id INTO v_mohinder FROM subject_profile WHERE full_name = 'Mohinder Pal' AND is_merged = FALSE LIMIT 1;
  SELECT subject_id INTO v_deepak FROM subject_profile WHERE full_name = 'Deepak Verma' AND is_merged = FALSE LIMIT 1;
  SELECT subject_id INTO v_pradeep FROM subject_profile WHERE full_name = 'Pradeep Sharma' AND is_merged = FALSE LIMIT 1;
  SELECT subject_id INTO v_gurpreet FROM subject_profile WHERE full_name = 'Gurpreet Singh Sidhu' AND is_merged = FALSE LIMIT 1;
  SELECT subject_id INTO v_vikram FROM subject_profile WHERE full_name = 'Vikram Chauhan' AND is_merged = FALSE LIMIT 1;
  SELECT subject_id INTO v_paramjit FROM subject_profile WHERE full_name = 'Paramjit Singh Brar' AND is_merged = FALSE LIMIT 1;

  IF v_irfan IS NULL OR v_balwinder IS NULL OR v_rajesh IS NULL THEN
    RAISE NOTICE 'Required subjects not found. Run seed-dashboard.sql first.';
    RETURN;
  END IF;

  -- ═══════════════════════════════════════
  -- BANK ACCOUNTS (~13 accounts)
  -- ═══════════════════════════════════════
  INSERT INTO bank_account (account_id, account_number, ifsc_code, normalized_key, bank_name)
  VALUES
    (gen_random_uuid(), '30219876543', 'SBIN0001234', 'SBIN0001234:30219876543', 'State Bank of India'),
    (gen_random_uuid(), '60104532198', 'PUNB0098700', 'PUNB0098700:60104532198', 'Punjab National Bank'),
    (gen_random_uuid(), '52019988776', 'SBIN0005678', 'SBIN0005678:52019988776', 'State Bank of India'),
    (gen_random_uuid(), '91700654321', 'UTIB0002345', 'UTIB0002345:91700654321', 'Axis Bank'),
    (gen_random_uuid(), '60108765432', 'PUNB0076500', 'PUNB0076500:60108765432', 'Punjab National Bank'),
    (gen_random_uuid(), '50100987654', 'HDFC0003456', 'HDFC0003456:50100987654', 'HDFC Bank'),
    (gen_random_uuid(), '52010112233', 'SBIN0004567', 'SBIN0004567:52010112233', 'State Bank of India'),
    (gen_random_uuid(), '60107654321', 'PUNB0065400', 'PUNB0065400:60107654321', 'Punjab National Bank'),
    (gen_random_uuid(), '30218765432', 'SBIN0007890', 'SBIN0007890:30218765432', 'State Bank of India'),
    (gen_random_uuid(), '11008765432', 'PSIB0000123', 'PSIB0000123:11008765432', 'Punjab & Sind Bank'),
    (gen_random_uuid(), '30216543210', 'SBIN0009012', 'SBIN0009012:30216543210', 'State Bank of India'),
    (gen_random_uuid(), '99901234567', 'KKBK0005678', 'KKBK0005678:99901234567', 'Kotak Mahindra Bank'),
    (gen_random_uuid(), '99902345678', 'ICIC0006789', 'ICIC0006789:99902345678', 'ICICI Bank')
  ON CONFLICT (normalized_key) DO NOTHING;

  -- Re-fetch all account IDs by normalized_key
  SELECT account_id INTO v_ba_irfan_sbi FROM bank_account WHERE normalized_key = 'SBIN0001234:30219876543';
  SELECT account_id INTO v_ba_irfan_pnb FROM bank_account WHERE normalized_key = 'PUNB0098700:60104532198';
  SELECT account_id INTO v_ba_balwinder_sbi FROM bank_account WHERE normalized_key = 'SBIN0005678:52019988776';
  SELECT account_id INTO v_ba_balwinder_axis FROM bank_account WHERE normalized_key = 'UTIB0002345:91700654321';
  SELECT account_id INTO v_ba_rajesh_pnb FROM bank_account WHERE normalized_key = 'PUNB0076500:60108765432';
  SELECT account_id INTO v_ba_sanjay_hdfc FROM bank_account WHERE normalized_key = 'HDFC0003456:50100987654';
  SELECT account_id INTO v_ba_anil_sbi FROM bank_account WHERE normalized_key = 'SBIN0004567:52010112233';
  SELECT account_id INTO v_ba_ranjit_pnb FROM bank_account WHERE normalized_key = 'PUNB0065400:60107654321';
  SELECT account_id INTO v_ba_mohinder_sbi FROM bank_account WHERE normalized_key = 'SBIN0007890:30218765432';
  SELECT account_id INTO v_ba_deepak_psb FROM bank_account WHERE normalized_key = 'PSIB0000123:11008765432';
  SELECT account_id INTO v_ba_shared_biz FROM bank_account WHERE normalized_key = 'SBIN0009012:30216543210';
  SELECT account_id INTO v_ba_ext_hawala FROM bank_account WHERE normalized_key = 'KKBK0005678:99901234567';
  SELECT account_id INTO v_ba_ext_supplier FROM bank_account WHERE normalized_key = 'ICIC0006789:99902345678';

  -- ═══════════════════════════════════════
  -- UPI ACCOUNTS (~10 VPAs)
  -- ═══════════════════════════════════════
  INSERT INTO upi_account (upi_id, vpa, provider_app, is_active, transaction_volume)
  VALUES
    (gen_random_uuid(), 'irfan.trader@okaxis', 'Google Pay', TRUE, 85),
    (gen_random_uuid(), 'irfan82@ybl', 'PhonePe', TRUE, 42),
    (gen_random_uuid(), 'binder.singh@paytm', 'Paytm', TRUE, 67),
    (gen_random_uuid(), 'rajesh.transport@upi', 'BHIM', TRUE, 53),
    (gen_random_uuid(), 'pradip90@ybl', 'PhonePe', TRUE, 31),
    (gen_random_uuid(), 'guri95@okaxis', 'Google Pay', TRUE, 22),
    (gen_random_uuid(), 'vicky.mechanic@paytm', 'Paytm', TRUE, 18),
    (gen_random_uuid(), 'brar.paramjit@ybl', 'PhonePe', TRUE, 44),
    (gen_random_uuid(), 'supplier.border@upi', 'BHIM', TRUE, 120),
    (gen_random_uuid(), 'dhaba.highway@paytm', 'Paytm', TRUE, 95);

  SELECT upi_id INTO v_upi_irfan1 FROM upi_account WHERE vpa = 'irfan.trader@okaxis';
  SELECT upi_id INTO v_upi_irfan2 FROM upi_account WHERE vpa = 'irfan82@ybl';
  SELECT upi_id INTO v_upi_balwinder FROM upi_account WHERE vpa = 'binder.singh@paytm';
  SELECT upi_id INTO v_upi_rajesh FROM upi_account WHERE vpa = 'rajesh.transport@upi';
  SELECT upi_id INTO v_upi_pradeep FROM upi_account WHERE vpa = 'pradip90@ybl';
  SELECT upi_id INTO v_upi_gurpreet FROM upi_account WHERE vpa = 'guri95@okaxis';
  SELECT upi_id INTO v_upi_vikram FROM upi_account WHERE vpa = 'vicky.mechanic@paytm';
  SELECT upi_id INTO v_upi_paramjit FROM upi_account WHERE vpa = 'brar.paramjit@ybl';
  SELECT upi_id INTO v_upi_ext_supplier FROM upi_account WHERE vpa = 'supplier.border@upi';
  SELECT upi_id INTO v_upi_ext_dhaba FROM upi_account WHERE vpa = 'dhaba.highway@paytm';

  -- ═══════════════════════════════════════
  -- SUBJECT-ACCOUNT LINKS (~15)
  -- ═══════════════════════════════════════
  INSERT INTO subject_account_link (subject_id, account_id, relationship, confidence, source_system) VALUES
    (v_irfan, v_ba_irfan_sbi, 'HOLDER', 100, 'bank_records'),
    (v_irfan, v_ba_irfan_pnb, 'HOLDER', 100, 'bank_records'),
    (v_irfan, v_ba_shared_biz, 'HOLDER', 90, 'investigation'),
    (v_balwinder, v_ba_balwinder_sbi, 'HOLDER', 100, 'bank_records'),
    (v_balwinder, v_ba_balwinder_axis, 'HOLDER', 100, 'bank_records'),
    (v_rajesh, v_ba_rajesh_pnb, 'HOLDER', 100, 'bank_records'),
    (v_rajesh, v_ba_shared_biz, 'BENEFICIARY', 85, 'investigation'),
    (v_sanjay, v_ba_sanjay_hdfc, 'HOLDER', 100, 'bank_records'),
    (v_anil, v_ba_anil_sbi, 'HOLDER', 100, 'bank_records'),
    (v_ranjit, v_ba_ranjit_pnb, 'HOLDER', 100, 'bank_records'),
    (v_mohinder, v_ba_mohinder_sbi, 'HOLDER', 100, 'bank_records'),
    (v_deepak, v_ba_deepak_psb, 'HOLDER', 100, 'bank_records'),
    (v_paramjit, v_ba_ext_supplier, 'BENEFICIARY', 70, 'investigation'),
    (v_balwinder, v_ba_ext_supplier, 'BENEFICIARY', 65, 'investigation')
  ON CONFLICT (subject_id, account_id, relationship) DO NOTHING;

  -- ═══════════════════════════════════════
  -- SUBJECT-UPI LINKS (~10)
  -- ═══════════════════════════════════════
  INSERT INTO subject_upi_link (subject_id, upi_id, relationship, confidence, source_system) VALUES
    (v_irfan, v_upi_irfan1, 'OWNER', 100, 'upi_records'),
    (v_irfan, v_upi_irfan2, 'OWNER', 100, 'upi_records'),
    (v_balwinder, v_upi_balwinder, 'OWNER', 100, 'upi_records'),
    (v_rajesh, v_upi_rajesh, 'OWNER', 100, 'upi_records'),
    (v_pradeep, v_upi_pradeep, 'OWNER', 95, 'upi_records'),
    (v_gurpreet, v_upi_gurpreet, 'OWNER', 95, 'upi_records'),
    (v_vikram, v_upi_vikram, 'OWNER', 90, 'upi_records'),
    (v_paramjit, v_upi_paramjit, 'OWNER', 100, 'upi_records'),
    (v_irfan, v_upi_ext_supplier, 'SUSPECTED', 55, 'investigation'),
    (v_balwinder, v_upi_ext_dhaba, 'SUSPECTED', 50, 'investigation')
  ON CONFLICT (subject_id, upi_id) DO NOTHING;

  -- ═══════════════════════════════════════
  -- FINANCIAL TRANSACTIONS (~80 records over 6 months)
  -- ═══════════════════════════════════════

  -- ── UPI Transactions (txn_type = 'UPI') ──

  -- Irfan → Rajesh: 12 txns (Rs 5,000–10,000 pattern)
  INSERT INTO financial_transaction (subject_id, txn_type, amount, counterparty, occurred_at, sender_upi_id, receiver_upi_id, is_suspicious, metadata_jsonb) VALUES
    (v_irfan, 'UPI', 5000, 'Rajesh Kumar Singh', NOW() - INTERVAL '170 days', v_upi_irfan1, v_upi_rajesh, FALSE, '{}'),
    (v_irfan, 'UPI', 7500, 'Rajesh Kumar Singh', NOW() - INTERVAL '155 days', v_upi_irfan1, v_upi_rajesh, FALSE, '{}'),
    (v_irfan, 'UPI', 10000, 'Rajesh Kumar Singh', NOW() - INTERVAL '140 days', v_upi_irfan1, v_upi_rajesh, TRUE, '{"flag":"round_amount"}'),
    (v_irfan, 'UPI', 8000, 'Rajesh Kumar Singh', NOW() - INTERVAL '125 days', v_upi_irfan2, v_upi_rajesh, FALSE, '{}'),
    (v_irfan, 'UPI', 5500, 'Rajesh Kumar Singh', NOW() - INTERVAL '110 days', v_upi_irfan1, v_upi_rajesh, FALSE, '{}'),
    (v_irfan, 'UPI', 9000, 'Rajesh Kumar Singh', NOW() - INTERVAL '95 days', v_upi_irfan1, v_upi_rajesh, FALSE, '{}'),
    (v_irfan, 'UPI', 6000, 'Rajesh Kumar Singh', NOW() - INTERVAL '80 days', v_upi_irfan2, v_upi_rajesh, FALSE, '{}'),
    (v_irfan, 'UPI', 10000, 'Rajesh Kumar Singh', NOW() - INTERVAL '65 days', v_upi_irfan1, v_upi_rajesh, TRUE, '{"flag":"round_amount"}'),
    (v_irfan, 'UPI', 7000, 'Rajesh Kumar Singh', NOW() - INTERVAL '50 days', v_upi_irfan1, v_upi_rajesh, FALSE, '{}'),
    (v_irfan, 'UPI', 8500, 'Rajesh Kumar Singh', NOW() - INTERVAL '35 days', v_upi_irfan1, v_upi_rajesh, FALSE, '{}'),
    (v_irfan, 'UPI', 5000, 'Rajesh Kumar Singh', NOW() - INTERVAL '20 days', v_upi_irfan2, v_upi_rajesh, FALSE, '{}'),
    (v_irfan, 'UPI', 9500, 'Rajesh Kumar Singh', NOW() - INTERVAL '5 days', v_upi_irfan1, v_upi_rajesh, TRUE, '{"flag":"frequency_spike"}');

  -- Irfan → Pradeep: 8 txns (Rs 1,000–3,000)
  INSERT INTO financial_transaction (subject_id, txn_type, amount, counterparty, occurred_at, sender_upi_id, receiver_upi_id, is_suspicious, metadata_jsonb) VALUES
    (v_irfan, 'UPI', 1500, 'Pradeep Sharma', NOW() - INTERVAL '160 days', v_upi_irfan1, v_upi_pradeep, FALSE, '{}'),
    (v_irfan, 'UPI', 2000, 'Pradeep Sharma', NOW() - INTERVAL '138 days', v_upi_irfan1, v_upi_pradeep, FALSE, '{}'),
    (v_irfan, 'UPI', 3000, 'Pradeep Sharma', NOW() - INTERVAL '118 days', v_upi_irfan2, v_upi_pradeep, FALSE, '{}'),
    (v_irfan, 'UPI', 1000, 'Pradeep Sharma', NOW() - INTERVAL '98 days', v_upi_irfan1, v_upi_pradeep, FALSE, '{}'),
    (v_irfan, 'UPI', 2500, 'Pradeep Sharma', NOW() - INTERVAL '78 days', v_upi_irfan1, v_upi_pradeep, FALSE, '{}'),
    (v_irfan, 'UPI', 1800, 'Pradeep Sharma', NOW() - INTERVAL '55 days', v_upi_irfan2, v_upi_pradeep, FALSE, '{}'),
    (v_irfan, 'UPI', 2200, 'Pradeep Sharma', NOW() - INTERVAL '30 days', v_upi_irfan1, v_upi_pradeep, FALSE, '{}'),
    (v_irfan, 'UPI', 2800, 'Pradeep Sharma', NOW() - INTERVAL '8 days', v_upi_irfan1, v_upi_pradeep, TRUE, '{"flag":"new_counterparty_spike"}');

  -- Balwinder → Paramjit: 10 txns (Rs 2,000–8,000)
  INSERT INTO financial_transaction (subject_id, txn_type, amount, counterparty, occurred_at, sender_upi_id, receiver_upi_id, is_suspicious, metadata_jsonb) VALUES
    (v_balwinder, 'UPI', 3000, 'Paramjit Singh Brar', NOW() - INTERVAL '165 days', v_upi_balwinder, v_upi_paramjit, FALSE, '{}'),
    (v_balwinder, 'UPI', 5000, 'Paramjit Singh Brar', NOW() - INTERVAL '148 days', v_upi_balwinder, v_upi_paramjit, FALSE, '{}'),
    (v_balwinder, 'UPI', 8000, 'Paramjit Singh Brar', NOW() - INTERVAL '130 days', v_upi_balwinder, v_upi_paramjit, TRUE, '{"flag":"high_frequency"}'),
    (v_balwinder, 'UPI', 2000, 'Paramjit Singh Brar', NOW() - INTERVAL '112 days', v_upi_balwinder, v_upi_paramjit, FALSE, '{}'),
    (v_balwinder, 'UPI', 6000, 'Paramjit Singh Brar', NOW() - INTERVAL '95 days', v_upi_balwinder, v_upi_paramjit, FALSE, '{}'),
    (v_balwinder, 'UPI', 4500, 'Paramjit Singh Brar', NOW() - INTERVAL '78 days', v_upi_balwinder, v_upi_paramjit, FALSE, '{}'),
    (v_balwinder, 'UPI', 7000, 'Paramjit Singh Brar', NOW() - INTERVAL '60 days', v_upi_balwinder, v_upi_paramjit, FALSE, '{}'),
    (v_balwinder, 'UPI', 3500, 'Paramjit Singh Brar', NOW() - INTERVAL '42 days', v_upi_balwinder, v_upi_paramjit, FALSE, '{}'),
    (v_balwinder, 'UPI', 5500, 'Paramjit Singh Brar', NOW() - INTERVAL '22 days', v_upi_balwinder, v_upi_paramjit, FALSE, '{}'),
    (v_balwinder, 'UPI', 6500, 'Paramjit Singh Brar', NOW() - INTERVAL '4 days', v_upi_balwinder, v_upi_paramjit, TRUE, '{"flag":"velocity_increase"}');

  -- Rajesh → Gurpreet: 6 txns
  INSERT INTO financial_transaction (subject_id, txn_type, amount, counterparty, occurred_at, sender_upi_id, receiver_upi_id, is_suspicious, metadata_jsonb) VALUES
    (v_rajesh, 'UPI', 4000, 'Gurpreet Singh Sidhu', NOW() - INTERVAL '150 days', v_upi_rajesh, v_upi_gurpreet, FALSE, '{}'),
    (v_rajesh, 'UPI', 3500, 'Gurpreet Singh Sidhu', NOW() - INTERVAL '120 days', v_upi_rajesh, v_upi_gurpreet, FALSE, '{}'),
    (v_rajesh, 'UPI', 5000, 'Gurpreet Singh Sidhu', NOW() - INTERVAL '90 days', v_upi_rajesh, v_upi_gurpreet, FALSE, '{}'),
    (v_rajesh, 'UPI', 2500, 'Gurpreet Singh Sidhu', NOW() - INTERVAL '60 days', v_upi_rajesh, v_upi_gurpreet, FALSE, '{}'),
    (v_rajesh, 'UPI', 6000, 'Gurpreet Singh Sidhu', NOW() - INTERVAL '30 days', v_upi_rajesh, v_upi_gurpreet, FALSE, '{}'),
    (v_rajesh, 'UPI', 4500, 'Gurpreet Singh Sidhu', NOW() - INTERVAL '10 days', v_upi_rajesh, v_upi_gurpreet, FALSE, '{}');

  -- Cross-cluster: Rajesh → Balwinder: 4 txns (connects two hubs)
  INSERT INTO financial_transaction (subject_id, txn_type, amount, counterparty, occurred_at, sender_upi_id, receiver_upi_id, is_suspicious, metadata_jsonb) VALUES
    (v_rajesh, 'UPI', 15000, 'Balwinder Singh', NOW() - INTERVAL '140 days', v_upi_rajesh, v_upi_balwinder, TRUE, '{"flag":"cross_cluster"}'),
    (v_rajesh, 'UPI', 12000, 'Balwinder Singh', NOW() - INTERVAL '100 days', v_upi_rajesh, v_upi_balwinder, FALSE, '{}'),
    (v_rajesh, 'UPI', 18000, 'Balwinder Singh', NOW() - INTERVAL '55 days', v_upi_rajesh, v_upi_balwinder, TRUE, '{"flag":"high_amount"}'),
    (v_rajesh, 'UPI', 10000, 'Balwinder Singh', NOW() - INTERVAL '15 days', v_upi_rajesh, v_upi_balwinder, FALSE, '{}');

  -- Vikram → Gurpreet: 3 txns (small)
  INSERT INTO financial_transaction (subject_id, txn_type, amount, counterparty, occurred_at, sender_upi_id, receiver_upi_id, is_suspicious, metadata_jsonb) VALUES
    (v_vikram, 'UPI', 1500, 'Gurpreet Singh Sidhu', NOW() - INTERVAL '90 days', v_upi_vikram, v_upi_gurpreet, FALSE, '{}'),
    (v_vikram, 'UPI', 2000, 'Gurpreet Singh Sidhu', NOW() - INTERVAL '45 days', v_upi_vikram, v_upi_gurpreet, FALSE, '{}'),
    (v_vikram, 'UPI', 800, 'Gurpreet Singh Sidhu', NOW() - INTERVAL '12 days', v_upi_vikram, v_upi_gurpreet, FALSE, '{}');

  -- External VPA: Irfan → supplier.border
  INSERT INTO financial_transaction (subject_id, txn_type, amount, counterparty, occurred_at, sender_upi_id, receiver_upi_id, is_suspicious, metadata_jsonb) VALUES
    (v_irfan, 'UPI', 25000, 'Border Supplier', NOW() - INTERVAL '130 days', v_upi_irfan1, v_upi_ext_supplier, TRUE, '{"flag":"external_counterparty"}'),
    (v_irfan, 'UPI', 20000, 'Border Supplier', NOW() - INTERVAL '75 days', v_upi_irfan1, v_upi_ext_supplier, TRUE, '{"flag":"external_counterparty"}'),
    (v_irfan, 'UPI', 22000, 'Border Supplier', NOW() - INTERVAL '18 days', v_upi_irfan2, v_upi_ext_supplier, TRUE, '{"flag":"external_counterparty"}');

  -- External VPA: Balwinder → dhaba.highway
  INSERT INTO financial_transaction (subject_id, txn_type, amount, counterparty, occurred_at, sender_upi_id, receiver_upi_id, is_suspicious, metadata_jsonb) VALUES
    (v_balwinder, 'UPI', 8000, 'Highway Dhaba', NOW() - INTERVAL '105 days', v_upi_balwinder, v_upi_ext_dhaba, FALSE, '{}'),
    (v_balwinder, 'UPI', 12000, 'Highway Dhaba', NOW() - INTERVAL '50 days', v_upi_balwinder, v_upi_ext_dhaba, FALSE, '{}');

  -- ── Bank Transfers (NEFT/RTGS) ──

  -- Irfan → Sanjay: 5 RTGS (large amounts — business front laundering)
  INSERT INTO financial_transaction (subject_id, txn_type, amount, counterparty, occurred_at, sender_account_id, receiver_account_id, is_suspicious, metadata_jsonb) VALUES
    (v_irfan, 'RTGS', 500000, 'Sanjay Patel', NOW() - INTERVAL '160 days', v_ba_irfan_sbi, v_ba_sanjay_hdfc, TRUE, '{"flag":"structuring_suspected"}'),
    (v_irfan, 'RTGS', 750000, 'Sanjay Patel', NOW() - INTERVAL '128 days', v_ba_irfan_sbi, v_ba_sanjay_hdfc, FALSE, '{}'),
    (v_irfan, 'RTGS', 1200000, 'Sanjay Patel', NOW() - INTERVAL '92 days', v_ba_irfan_pnb, v_ba_sanjay_hdfc, TRUE, '{"flag":"large_single_txn"}'),
    (v_irfan, 'RTGS', 850000, 'Sanjay Patel', NOW() - INTERVAL '55 days', v_ba_irfan_sbi, v_ba_sanjay_hdfc, FALSE, '{}'),
    (v_irfan, 'RTGS', 1500000, 'Sanjay Patel', NOW() - INTERVAL '12 days', v_ba_irfan_sbi, v_ba_sanjay_hdfc, TRUE, '{"flag":"large_single_txn"}');

  -- Balwinder → Anil: 4 NEFT (regular amounts)
  INSERT INTO financial_transaction (subject_id, txn_type, amount, counterparty, occurred_at, sender_account_id, receiver_account_id, is_suspicious, metadata_jsonb) VALUES
    (v_balwinder, 'NEFT', 150000, 'Anil Kumar Yadav', NOW() - INTERVAL '145 days', v_ba_balwinder_sbi, v_ba_anil_sbi, FALSE, '{}'),
    (v_balwinder, 'NEFT', 200000, 'Anil Kumar Yadav', NOW() - INTERVAL '108 days', v_ba_balwinder_sbi, v_ba_anil_sbi, FALSE, '{}'),
    (v_balwinder, 'NEFT', 175000, 'Anil Kumar Yadav', NOW() - INTERVAL '70 days', v_ba_balwinder_axis, v_ba_anil_sbi, FALSE, '{}'),
    (v_balwinder, 'NEFT', 250000, 'Anil Kumar Yadav', NOW() - INTERVAL '25 days', v_ba_balwinder_sbi, v_ba_anil_sbi, FALSE, '{}');

  -- Ranjit → Irfan: 3 NEFT (financing)
  INSERT INTO financial_transaction (subject_id, txn_type, amount, counterparty, occurred_at, sender_account_id, receiver_account_id, is_suspicious, metadata_jsonb) VALUES
    (v_ranjit, 'NEFT', 300000, 'Mohammed Irfan', NOW() - INTERVAL '150 days', v_ba_ranjit_pnb, v_ba_irfan_sbi, FALSE, '{}'),
    (v_ranjit, 'NEFT', 450000, 'Mohammed Irfan', NOW() - INTERVAL '85 days', v_ba_ranjit_pnb, v_ba_irfan_pnb, TRUE, '{"flag":"financing_pattern"}'),
    (v_ranjit, 'NEFT', 350000, 'Mohammed Irfan', NOW() - INTERVAL '20 days', v_ba_ranjit_pnb, v_ba_irfan_sbi, FALSE, '{}');

  -- External hawala → Irfan: 3 large RTGS
  INSERT INTO financial_transaction (subject_id, txn_type, amount, counterparty, occurred_at, sender_account_id, receiver_account_id, is_suspicious, metadata_jsonb) VALUES
    (v_irfan, 'RTGS', 800000, 'Unknown (Hawala)', NOW() - INTERVAL '155 days', v_ba_ext_hawala, v_ba_irfan_sbi, TRUE, '{"flag":"hawala_suspected"}'),
    (v_irfan, 'RTGS', 1100000, 'Unknown (Hawala)', NOW() - INTERVAL '95 days', v_ba_ext_hawala, v_ba_irfan_pnb, TRUE, '{"flag":"hawala_suspected"}'),
    (v_irfan, 'RTGS', 950000, 'Unknown (Hawala)', NOW() - INTERVAL '28 days', v_ba_ext_hawala, v_ba_irfan_sbi, TRUE, '{"flag":"hawala_suspected"}');

  -- Structuring: Mohinder → multiple accounts just under Rs 10L
  INSERT INTO financial_transaction (subject_id, txn_type, amount, counterparty, occurred_at, sender_account_id, receiver_account_id, is_suspicious, metadata_jsonb) VALUES
    (v_mohinder, 'NEFT', 990000, 'Sanjay Patel', NOW() - INTERVAL '142 days', v_ba_mohinder_sbi, v_ba_sanjay_hdfc, TRUE, '{"flag":"structuring"}'),
    (v_mohinder, 'NEFT', 980000, 'Anil Kumar Yadav', NOW() - INTERVAL '135 days', v_ba_mohinder_sbi, v_ba_anil_sbi, TRUE, '{"flag":"structuring"}'),
    (v_mohinder, 'NEFT', 950000, 'Deepak Verma', NOW() - INTERVAL '120 days', v_ba_mohinder_sbi, v_ba_deepak_psb, TRUE, '{"flag":"structuring"}'),
    (v_mohinder, 'NEFT', 970000, 'Rajesh Kumar Singh', NOW() - INTERVAL '100 days', v_ba_mohinder_sbi, v_ba_rajesh_pnb, TRUE, '{"flag":"structuring"}'),
    (v_mohinder, 'NEFT', 995000, 'Balwinder Singh', NOW() - INTERVAL '82 days', v_ba_mohinder_sbi, v_ba_balwinder_sbi, TRUE, '{"flag":"structuring"}');

  -- Deepak → Ranjit: 2 NEFT
  INSERT INTO financial_transaction (subject_id, txn_type, amount, counterparty, occurred_at, sender_account_id, receiver_account_id, is_suspicious, metadata_jsonb) VALUES
    (v_deepak, 'NEFT', 120000, 'Ranjit Singh Mann', NOW() - INTERVAL '110 days', v_ba_deepak_psb, v_ba_ranjit_pnb, FALSE, '{}'),
    (v_deepak, 'NEFT', 85000, 'Ranjit Singh Mann', NOW() - INTERVAL '40 days', v_ba_deepak_psb, v_ba_ranjit_pnb, FALSE, '{}');

  -- Sanjay → External supplier: 2 NEFT
  INSERT INTO financial_transaction (subject_id, txn_type, amount, counterparty, occurred_at, sender_account_id, receiver_account_id, is_suspicious, metadata_jsonb) VALUES
    (v_sanjay, 'NEFT', 400000, 'External Supplier Co', NOW() - INTERVAL '115 days', v_ba_sanjay_hdfc, v_ba_ext_supplier, FALSE, '{}'),
    (v_sanjay, 'NEFT', 550000, 'External Supplier Co', NOW() - INTERVAL '45 days', v_ba_sanjay_hdfc, v_ba_ext_supplier, FALSE, '{}');

  -- Balwinder → Ranjit: 2 NEFT
  INSERT INTO financial_transaction (subject_id, txn_type, amount, counterparty, occurred_at, sender_account_id, receiver_account_id, is_suspicious, metadata_jsonb) VALUES
    (v_balwinder, 'NEFT', 180000, 'Ranjit Singh Mann', NOW() - INTERVAL '130 days', v_ba_balwinder_axis, v_ba_ranjit_pnb, FALSE, '{}'),
    (v_balwinder, 'NEFT', 220000, 'Ranjit Singh Mann', NOW() - INTERVAL '60 days', v_ba_balwinder_sbi, v_ba_ranjit_pnb, FALSE, '{}');

  RAISE NOTICE 'Transaction seed data inserted successfully.';
END;
$$;
