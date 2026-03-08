-- ═══════════════════════════════════════════════════════════════════════════
-- Bharat Nyaya Sanhita (BNS) 2023 — replaces Indian Penal Code (IPC) 1860
-- Effective: 1 July 2024
-- CNR-04: "Support Bharatiya Nyaya Sanhita mapping at minimum"
-- ═══════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- PART 1: BNS equivalents of the 8 existing IPC sections
-- ────────────────────────────────────────────────────────────────

-- BNS 318 ← IPC 420
INSERT INTO statute_library (act_name, section, description, keywords, penalty_summary, effective_date, version)
VALUES (
  'Bharatiya Nyaya Sanhita', '318',
  'Cheating and dishonestly inducing delivery of property',
  ARRAY['fraud', 'cheating', 'scam', 'fake', 'online fraud', 'cyber fraud', 'financial crime'],
  'Imprisonment up to 7 years and fine',
  '2024-07-01', 1
) ON CONFLICT DO NOTHING;

-- BNS 74 ← IPC 354
INSERT INTO statute_library (act_name, section, description, keywords, penalty_summary, effective_date, version)
VALUES (
  'Bharatiya Nyaya Sanhita', '74',
  'Assault or criminal force to woman with intent to outrage her modesty',
  ARRAY['harassment', 'assault', 'woman', 'modesty', 'sexual harassment', 'molestation'],
  'Imprisonment 1-5 years and fine',
  '2024-07-01', 1
) ON CONFLICT DO NOTHING;

-- BNS 351 ← IPC 506
INSERT INTO statute_library (act_name, section, description, keywords, penalty_summary, effective_date, version)
VALUES (
  'Bharatiya Nyaya Sanhita', '351',
  'Criminal intimidation',
  ARRAY['threat', 'intimidation', 'criminal', 'blackmail', 'extortion threat', 'death threat'],
  'Imprisonment up to 2 years, or fine, or both; up to 7 years if threat of death/grievous hurt',
  '2024-07-01', 1
) ON CONFLICT DO NOTHING;

-- BNS 79 ← IPC 509
INSERT INTO statute_library (act_name, section, description, keywords, penalty_summary, effective_date, version)
VALUES (
  'Bharatiya Nyaya Sanhita', '79',
  'Word, gesture or act intended to insult the modesty of a woman',
  ARRAY['harassment', 'insult', 'woman', 'modesty', 'stalking', 'eve-teasing'],
  'Imprisonment up to 3 years and fine',
  '2024-07-01', 1
) ON CONFLICT DO NOTHING;

-- BNS 196 ← IPC 153A
INSERT INTO statute_library (act_name, section, description, keywords, penalty_summary, effective_date, version)
VALUES (
  'Bharatiya Nyaya Sanhita', '196',
  'Promoting enmity between different groups on grounds of religion, race, place of birth, etc.',
  ARRAY['hate', 'communal', 'enmity', 'religion', 'hate speech', 'incitement', 'communal violence', 'sectarian'],
  'Imprisonment up to 3 years, or fine, or both; up to 5 years in place of worship',
  '2024-07-01', 1
) ON CONFLICT DO NOTHING;

-- BNS 299 ← IPC 295A
INSERT INTO statute_library (act_name, section, description, keywords, penalty_summary, effective_date, version)
VALUES (
  'Bharatiya Nyaya Sanhita', '299',
  'Deliberate and malicious acts intended to outrage religious feelings of any class',
  ARRAY['religion', 'blasphemy', 'sentiments', 'religious outrage', 'desecration'],
  'Imprisonment up to 3 years, or fine, or both',
  '2024-07-01', 1
) ON CONFLICT DO NOTHING;

-- BNS 356 ← IPC 499 + 500 (defamation merged into single section)
INSERT INTO statute_library (act_name, section, description, keywords, penalty_summary, effective_date, version)
VALUES (
  'Bharatiya Nyaya Sanhita', '356',
  'Defamation',
  ARRAY['defamation', 'reputation', 'libel', 'slander', 'false accusation', 'character assassination'],
  'Simple imprisonment up to 2 years, or fine, or both',
  '2024-07-01', 1
) ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- PART 2: Additional BNS sections for narcotics & social media
-- ────────────────────────────────────────────────────────────────

-- BNS 111 — Organised crime (new; no direct IPC equivalent)
INSERT INTO statute_library (act_name, section, description, keywords, penalty_summary, effective_date, version)
VALUES (
  'Bharatiya Nyaya Sanhita', '111',
  'Organised crime — continuing unlawful activity by syndicate or gang',
  ARRAY['organised crime', 'organized crime', 'syndicate', 'gang', 'cartel', 'drug ring', 'smuggling ring', 'criminal network', 'mafia'],
  'Death or life imprisonment and fine up to Rs 10 lakh; if member: 5+ years and fine up to Rs 5 lakh',
  '2024-07-01', 1
) ON CONFLICT DO NOTHING;

-- BNS 112 — Petty organised crime (new)
INSERT INTO statute_library (act_name, section, description, keywords, penalty_summary, effective_date, version)
VALUES (
  'Bharatiya Nyaya Sanhita', '112',
  'Petty organised crime — snatching, organised pick-pocketing, selling of public exam papers, etc.',
  ARRAY['petty crime', 'snatching', 'pick-pocket', 'theft ring', 'street crime'],
  'Imprisonment 1-7 years and fine',
  '2024-07-01', 1
) ON CONFLICT DO NOTHING;

-- BNS 61 — Criminal conspiracy
INSERT INTO statute_library (act_name, section, description, keywords, penalty_summary, effective_date, version)
VALUES (
  'Bharatiya Nyaya Sanhita', '61',
  'Criminal conspiracy — agreement to do or cause an illegal act',
  ARRAY['conspiracy', 'criminal conspiracy', 'planning', 'collusion', 'co-conspirator'],
  'Same punishment as offence conspired; if no specific punishment: up to 6 months, or fine, or both',
  '2024-07-01', 1
) ON CONFLICT DO NOTHING;

-- BNS 308 — Extortion
INSERT INTO statute_library (act_name, section, description, keywords, penalty_summary, effective_date, version)
VALUES (
  'Bharatiya Nyaya Sanhita', '308',
  'Extortion — putting person in fear of injury to dishonestly obtain property',
  ARRAY['extortion', 'blackmail', 'ransom', 'hafta', 'protection money', 'threat for money'],
  'Imprisonment up to 3 years, or fine, or both; up to 7 years if threat of death/grievous hurt',
  '2024-07-01', 1
) ON CONFLICT DO NOTHING;

-- BNS 316 — Criminal breach of trust
INSERT INTO statute_library (act_name, section, description, keywords, penalty_summary, effective_date, version)
VALUES (
  'Bharatiya Nyaya Sanhita', '316',
  'Criminal breach of trust — dishonest misappropriation or conversion of entrusted property',
  ARRAY['breach of trust', 'misappropriation', 'embezzlement', 'corruption', 'misuse of funds'],
  'Imprisonment up to 7 years and fine',
  '2024-07-01', 1
) ON CONFLICT DO NOTHING;

-- BNS 336 — Forgery
INSERT INTO statute_library (act_name, section, description, keywords, penalty_summary, effective_date, version)
VALUES (
  'Bharatiya Nyaya Sanhita', '336',
  'Forgery — making a false document with intent to cause damage or injury',
  ARRAY['forgery', 'forged', 'fake document', 'counterfeit', 'falsification'],
  'Imprisonment up to 2 years, or fine, or both',
  '2024-07-01', 1
) ON CONFLICT DO NOTHING;

-- BNS 352 — Intentional insult with intent to provoke breach of peace
INSERT INTO statute_library (act_name, section, description, keywords, penalty_summary, effective_date, version)
VALUES (
  'Bharatiya Nyaya Sanhita', '352',
  'Intentional insult with intent to provoke breach of the peace',
  ARRAY['insult', 'provocation', 'public order', 'breach of peace', 'abusive', 'inflammatory'],
  'Imprisonment up to 2 years, or fine, or both',
  '2024-07-01', 1
) ON CONFLICT DO NOTHING;

-- BNS 353 — Statements conducive to public mischief
INSERT INTO statute_library (act_name, section, description, keywords, penalty_summary, effective_date, version)
VALUES (
  'Bharatiya Nyaya Sanhita', '353',
  'Statements conducing to public mischief — spreading rumours or alarming news',
  ARRAY['rumour', 'fake news', 'misinformation', 'disinformation', 'public mischief', 'alarming news', 'panic'],
  'Imprisonment up to 3 years and fine; up to 5 years if on social media',
  '2024-07-01', 1
) ON CONFLICT DO NOTHING;

-- BNS 197 — Imputations prejudicial to national integration
INSERT INTO statute_library (act_name, section, description, keywords, penalty_summary, effective_date, version)
VALUES (
  'Bharatiya Nyaya Sanhita', '197',
  'Imputations, assertions prejudicial to national integration',
  ARRAY['national integration', 'separatism', 'anti-national', 'divisive', 'sedition', 'secession'],
  'Imprisonment up to 3 years, or fine, or both',
  '2024-07-01', 1
) ON CONFLICT DO NOTHING;

-- BNS 48 — Abetment of offence
INSERT INTO statute_library (act_name, section, description, keywords, penalty_summary, effective_date, version)
VALUES (
  'Bharatiya Nyaya Sanhita', '48',
  'Abetment of a thing — instigating, conspiring, or intentionally aiding',
  ARRAY['abetment', 'aiding', 'instigating', 'accessory', 'abetting'],
  'Same as principal offence unless otherwise provided',
  '2024-07-01', 1
) ON CONFLICT DO NOTHING;

-- BNS 303 — Theft
INSERT INTO statute_library (act_name, section, description, keywords, penalty_summary, effective_date, version)
VALUES (
  'Bharatiya Nyaya Sanhita', '303',
  'Theft — dishonestly taking movable property out of possession without consent',
  ARRAY['theft', 'stealing', 'larceny', 'robbery', 'shoplifting'],
  'Imprisonment up to 3 years, or fine, or both',
  '2024-07-01', 1
) ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- PART 3: Additional NDPS sections for narcotics coverage
-- ────────────────────────────────────────────────────────────────

-- NDPS 23 — Import/export of narcotics
INSERT INTO statute_library (act_name, section, description, keywords, penalty_summary, effective_date, version)
VALUES (
  'NDPS Act', '23',
  'Punishment for illegal import/export of narcotic drugs and psychotropic substances',
  ARRAY['import', 'export', 'smuggling', 'trafficking', 'cross-border', 'customs'],
  'Rigorous imprisonment 10-20 years and fine Rs 1-2 lakh; commercial quantity: up to 20 years',
  '1985-11-14', 1
) ON CONFLICT DO NOTHING;

-- NDPS 25 — Allowing premises for narcotics
INSERT INTO statute_library (act_name, section, description, keywords, penalty_summary, effective_date, version)
VALUES (
  'NDPS Act', '25',
  'Punishment for allowing premises to be used for narcotics offences',
  ARRAY['premises', 'den', 'drug house', 'opium den', 'adda', 'hideout'],
  'Rigorous imprisonment up to 10 years and fine up to Rs 1 lakh',
  '1985-11-14', 1
) ON CONFLICT DO NOTHING;

-- NDPS 27A — Financing illicit drug trafficking
INSERT INTO statute_library (act_name, section, description, keywords, penalty_summary, effective_date, version)
VALUES (
  'NDPS Act', '27A',
  'Punishment for financing illicit traffic and harbouring offenders',
  ARRAY['financing', 'drug money', 'hawala', 'money laundering', 'harbouring', 'drug financing'],
  'Rigorous imprisonment 10-20 years and fine Rs 1-2 lakh',
  '1985-11-14', 1
) ON CONFLICT DO NOTHING;

-- NDPS 29 — Abetment and conspiracy under NDPS
INSERT INTO statute_library (act_name, section, description, keywords, penalty_summary, effective_date, version)
VALUES (
  'NDPS Act', '29',
  'Punishment for abetment and criminal conspiracy in NDPS offences',
  ARRAY['abetment', 'conspiracy', 'drug conspiracy', 'aiding narcotics'],
  'Same as principal offence',
  '1985-11-14', 1
) ON CONFLICT DO NOTHING;

-- NDPS 8/18 — Cultivation and production
INSERT INTO statute_library (act_name, section, description, keywords, penalty_summary, effective_date, version)
VALUES (
  'NDPS Act', '18',
  'Punishment for contravention in relation to opium poppy and opium',
  ARRAY['opium', 'poppy', 'cultivation', 'production', 'afeem'],
  'Rigorous imprisonment up to 10 years and fine up to Rs 1 lakh; commercial quantity: 10-20 years',
  '1985-11-14', 1
) ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- PART 4: Link IPC → BNS via superseded_by
-- (Update each IPC row to point to its BNS replacement)
-- ────────────────────────────────────────────────────────────────

-- IPC 420 → BNS 318
UPDATE statute_library SET superseded_by = (
  SELECT statute_id FROM statute_library WHERE act_name = 'Bharatiya Nyaya Sanhita' AND section = '318' LIMIT 1
) WHERE act_name = 'Indian Penal Code' AND section = '420' AND superseded_by IS NULL;

-- IPC 354 → BNS 74
UPDATE statute_library SET superseded_by = (
  SELECT statute_id FROM statute_library WHERE act_name = 'Bharatiya Nyaya Sanhita' AND section = '74' LIMIT 1
) WHERE act_name = 'Indian Penal Code' AND section = '354' AND superseded_by IS NULL;

-- IPC 506 → BNS 351
UPDATE statute_library SET superseded_by = (
  SELECT statute_id FROM statute_library WHERE act_name = 'Bharatiya Nyaya Sanhita' AND section = '351' LIMIT 1
) WHERE act_name = 'Indian Penal Code' AND section = '506' AND superseded_by IS NULL;

-- IPC 509 → BNS 79
UPDATE statute_library SET superseded_by = (
  SELECT statute_id FROM statute_library WHERE act_name = 'Bharatiya Nyaya Sanhita' AND section = '79' LIMIT 1
) WHERE act_name = 'Indian Penal Code' AND section = '509' AND superseded_by IS NULL;

-- IPC 153A → BNS 196
UPDATE statute_library SET superseded_by = (
  SELECT statute_id FROM statute_library WHERE act_name = 'Bharatiya Nyaya Sanhita' AND section = '196' LIMIT 1
) WHERE act_name = 'Indian Penal Code' AND section = '153A' AND superseded_by IS NULL;

-- IPC 295A → BNS 299
UPDATE statute_library SET superseded_by = (
  SELECT statute_id FROM statute_library WHERE act_name = 'Bharatiya Nyaya Sanhita' AND section = '299' LIMIT 1
) WHERE act_name = 'Indian Penal Code' AND section = '295A' AND superseded_by IS NULL;

-- IPC 499 → BNS 356
UPDATE statute_library SET superseded_by = (
  SELECT statute_id FROM statute_library WHERE act_name = 'Bharatiya Nyaya Sanhita' AND section = '356' LIMIT 1
) WHERE act_name = 'Indian Penal Code' AND section = '499' AND superseded_by IS NULL;

-- IPC 500 → BNS 356 (merged into same BNS section)
UPDATE statute_library SET superseded_by = (
  SELECT statute_id FROM statute_library WHERE act_name = 'Bharatiya Nyaya Sanhita' AND section = '356' LIMIT 1
) WHERE act_name = 'Indian Penal Code' AND section = '500' AND superseded_by IS NULL;
