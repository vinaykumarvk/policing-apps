-- ═══════════════════════════════════════════════════════════════════════════
-- Seed 16 PUBLISHED legal mapping rules for BNS, NDPS, IT Act
-- Each rule has a JSON DSL rule_expression for the evaluator engine
-- ═══════════════════════════════════════════════════════════════════════════

-- BNS 111 — Organised crime
INSERT INTO legal_mapping_rule (rule_code, law_name, provision_code, severity_weight, approval_status, effective_from, version_no, rule_expression)
VALUES ('BNS-111', 'Bharatiya Nyaya Sanhita', '111', 9.0, 'PUBLISHED', '2024-07-01',  1,
  '{"operator":"AND","conditions":[{"field":"category","op":"in","values":["NARCOTICS","DRUG_TRADE","ORGANIZED_CRIME"]},{"field":"threat_score","op":"gte","value":70},{"field":"keywords","op":"contains_any","values":["syndicate","cartel","gang","drug ring","smuggling ring","criminal network","organized crime"]}]}'::jsonb
) ON CONFLICT (rule_code) DO NOTHING;

-- BNS 318 — Cheating / fraud
INSERT INTO legal_mapping_rule (rule_code, law_name, provision_code, severity_weight, approval_status, effective_from, version_no, rule_expression)
VALUES ('BNS-318', 'Bharatiya Nyaya Sanhita', '318', 5.0, 'PUBLISHED', '2024-07-01', 1,
  '{"operator":"AND","conditions":[{"field":"category","op":"in","values":["FRAUD","CYBER_CRIME"]},{"field":"keywords","op":"contains_any","values":["fraud","cheating","scam","fake","online fraud","cyber fraud"]}]}'::jsonb
) ON CONFLICT (rule_code) DO NOTHING;

-- BNS 196 — Hate speech / promoting enmity
INSERT INTO legal_mapping_rule (rule_code, law_name, provision_code, severity_weight, approval_status, effective_from, version_no, rule_expression)
VALUES ('BNS-196', 'Bharatiya Nyaya Sanhita', '196', 7.0, 'PUBLISHED', '2024-07-01', 1,
  '{"operator":"AND","conditions":[{"field":"category","op":"in","values":["HATE_SPEECH","COMMUNAL"]},{"field":"keywords","op":"contains_any","values":["hate","communal","enmity","religion","incitement","sectarian","communal violence"]}]}'::jsonb
) ON CONFLICT (rule_code) DO NOTHING;

-- BNS 353 — Public mischief / fake news
INSERT INTO legal_mapping_rule (rule_code, law_name, provision_code, severity_weight, approval_status, effective_from, version_no, rule_expression)
VALUES ('BNS-353', 'Bharatiya Nyaya Sanhita', '353', 6.0, 'PUBLISHED', '2024-07-01', 1,
  '{"operator":"AND","conditions":[{"field":"category","op":"in","values":["MISINFORMATION","FAKE_NEWS","HATE_SPEECH"]},{"field":"keywords","op":"contains_any","values":["fake news","rumour","misinformation","disinformation","public mischief","alarming news","panic"]}]}'::jsonb
) ON CONFLICT (rule_code) DO NOTHING;

-- BNS 351 — Criminal intimidation
INSERT INTO legal_mapping_rule (rule_code, law_name, provision_code, severity_weight, approval_status, effective_from, version_no, rule_expression)
VALUES ('BNS-351', 'Bharatiya Nyaya Sanhita', '351', 6.0, 'PUBLISHED', '2024-07-01', 1,
  '{"operator":"OR","conditions":[{"field":"category","op":"in","values":["HARASSMENT","THREAT"]},{"field":"keywords","op":"contains_any","values":["threat","intimidation","blackmail","death threat","extortion threat"]}]}'::jsonb
) ON CONFLICT (rule_code) DO NOTHING;

-- BNS 356 — Defamation
INSERT INTO legal_mapping_rule (rule_code, law_name, provision_code, severity_weight, approval_status, effective_from, version_no, rule_expression)
VALUES ('BNS-356', 'Bharatiya Nyaya Sanhita', '356', 3.0, 'PUBLISHED', '2024-07-01', 1,
  '{"operator":"AND","conditions":[{"field":"category","op":"in","values":["HARASSMENT","DEFAMATION"]},{"field":"keywords","op":"contains_any","values":["defamation","reputation","libel","slander","false accusation","character assassination"]}]}'::jsonb
) ON CONFLICT (rule_code) DO NOTHING;

-- BNS 299 — Outraging religious feelings
INSERT INTO legal_mapping_rule (rule_code, law_name, provision_code, severity_weight, approval_status, effective_from, version_no, rule_expression)
VALUES ('BNS-299', 'Bharatiya Nyaya Sanhita', '299', 6.0, 'PUBLISHED', '2024-07-01', 1,
  '{"operator":"AND","conditions":[{"field":"category","op":"in","values":["HATE_SPEECH","COMMUNAL"]},{"field":"keywords","op":"contains_any","values":["blasphemy","religious outrage","desecration","sentiments"]}]}'::jsonb
) ON CONFLICT (rule_code) DO NOTHING;

-- BNS 74 — Assault on woman
INSERT INTO legal_mapping_rule (rule_code, law_name, provision_code, severity_weight, approval_status, effective_from, version_no, rule_expression)
VALUES ('BNS-74', 'Bharatiya Nyaya Sanhita', '74', 7.0, 'PUBLISHED', '2024-07-01', 1,
  '{"operator":"AND","conditions":[{"field":"category","op":"in","values":["HARASSMENT","CSAM","SEXUAL_HARASSMENT"]},{"field":"keywords","op":"contains_any","values":["harassment","assault","woman","modesty","sexual harassment","molestation"]}]}'::jsonb
) ON CONFLICT (rule_code) DO NOTHING;

-- BNS 61 — Criminal conspiracy
INSERT INTO legal_mapping_rule (rule_code, law_name, provision_code, severity_weight, approval_status, effective_from, version_no, rule_expression)
VALUES ('BNS-61', 'Bharatiya Nyaya Sanhita', '61', 5.0, 'PUBLISHED', '2024-07-01', 1,
  '{"operator":"AND","conditions":[{"field":"category","op":"in","values":["NARCOTICS","ORGANIZED_CRIME","TERRORISM"]},{"field":"threat_score","op":"gte","value":60},{"field":"keywords","op":"contains_any","values":["conspiracy","planning","collusion","co-conspirator"]}]}'::jsonb
) ON CONFLICT (rule_code) DO NOTHING;

-- NDPS 20 — Cultivation / production
INSERT INTO legal_mapping_rule (rule_code, law_name, provision_code, severity_weight, approval_status, effective_from, version_no, rule_expression)
VALUES ('NDPS-20', 'NDPS Act', '20', 8.0, 'PUBLISHED', '1985-11-14', 1,
  '{"operator":"AND","conditions":[{"field":"category","op":"in","values":["NARCOTICS","DRUG_TRADE"]},{"field":"keywords","op":"contains_any","values":["cannabis","ganja","marijuana","hemp","bhang","cultivation","growing"]}]}'::jsonb
) ON CONFLICT (rule_code) DO NOTHING;

-- NDPS 21 — Manufacture of drugs
INSERT INTO legal_mapping_rule (rule_code, law_name, provision_code, severity_weight, approval_status, effective_from, version_no, rule_expression)
VALUES ('NDPS-21', 'NDPS Act', '21', 8.0, 'PUBLISHED', '1985-11-14', 1,
  '{"operator":"AND","conditions":[{"field":"category","op":"in","values":["NARCOTICS","DRUG_TRADE"]},{"field":"keywords","op":"contains_any","values":["manufacture","lab","production","synthesis","processing","heroin","chitta","smack"]}]}'::jsonb
) ON CONFLICT (rule_code) DO NOTHING;

-- NDPS 22 — Sale / purchase of drugs
INSERT INTO legal_mapping_rule (rule_code, law_name, provision_code, severity_weight, approval_status, effective_from, version_no, rule_expression)
VALUES ('NDPS-22', 'NDPS Act', '22', 8.0, 'PUBLISHED', '1985-11-14', 1,
  '{"operator":"AND","conditions":[{"field":"category","op":"in","values":["NARCOTICS","DRUG_TRADE"]},{"field":"keywords","op":"contains_any","values":["sale","sell","buy","purchase","dealer","peddler","supplier","maal","stuff"]}]}'::jsonb
) ON CONFLICT (rule_code) DO NOTHING;

-- NDPS 27A — Financing drug trafficking
INSERT INTO legal_mapping_rule (rule_code, law_name, provision_code, severity_weight, approval_status, effective_from, version_no, rule_expression)
VALUES ('NDPS-27A', 'NDPS Act', '27A', 9.0, 'PUBLISHED', '1985-11-14', 1,
  '{"operator":"AND","conditions":[{"field":"category","op":"in","values":["NARCOTICS","DRUG_TRADE"]},{"field":"threat_score","op":"gte","value":60},{"field":"keywords","op":"contains_any","values":["financing","drug money","hawala","money laundering","harbouring"]}]}'::jsonb
) ON CONFLICT (rule_code) DO NOTHING;

-- NDPS 29 — Abetment and conspiracy
INSERT INTO legal_mapping_rule (rule_code, law_name, provision_code, severity_weight, approval_status, effective_from, version_no, rule_expression)
VALUES ('NDPS-29', 'NDPS Act', '29', 7.0, 'PUBLISHED', '1985-11-14', 1,
  '{"operator":"AND","conditions":[{"field":"category","op":"in","values":["NARCOTICS","DRUG_TRADE"]},{"field":"keywords","op":"contains_any","values":["abetment","conspiracy","aiding","drug conspiracy","abetting"]}]}'::jsonb
) ON CONFLICT (rule_code) DO NOTHING;

-- IT Act 66 — Computer-related offences
INSERT INTO legal_mapping_rule (rule_code, law_name, provision_code, severity_weight, approval_status, effective_from, version_no, rule_expression)
VALUES ('IT-66', 'IT Act', '66', 5.0, 'PUBLISHED', '2000-10-17', 1,
  '{"operator":"AND","conditions":[{"field":"category","op":"in","values":["CYBER_CRIME","HACKING","FRAUD"]},{"field":"keywords","op":"contains_any","values":["hacking","unauthorized access","computer","data theft","phishing","malware"]}]}'::jsonb
) ON CONFLICT (rule_code) DO NOTHING;

-- IT Act 67 — Publishing obscene material electronically
INSERT INTO legal_mapping_rule (rule_code, law_name, provision_code, severity_weight, approval_status, effective_from, version_no, rule_expression)
VALUES ('IT-67', 'IT Act', '67', 7.0, 'PUBLISHED', '2000-10-17', 1,
  '{"operator":"OR","conditions":[{"field":"category","op":"in","values":["CSAM","PORNOGRAPHY","OBSCENE"]},{"field":"keywords","op":"contains_any","values":["obscene","pornography","child abuse","CSAM","explicit","nude"]}]}'::jsonb
) ON CONFLICT (rule_code) DO NOTHING;
