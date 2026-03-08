-- 049: Comprehensive Telugu detection dictionary
-- Covers narcotics, illicit liquor (Telangana-specific), weapons, violence,
-- organized crime, extortion, fraud — with romanized forms for all entries.

-- ============================================================
-- A. Narcotics Keywords (term_type = 'KEYWORD')
-- ============================================================
INSERT INTO slang_dictionary (term, normalized_form, language, category, risk_weight, term_type, romanized_form) VALUES
  ('గంజాయి', 'cannabis', 'te', 'NARCOTICS', 1.5, 'KEYWORD', 'ganjayi'),
  ('అఫీము', 'opium', 'te', 'NARCOTICS', 1.8, 'KEYWORD', 'afeemu'),
  ('నల్ల మందు', 'opium', 'te', 'NARCOTICS', 1.8, 'KEYWORD', 'nalla mandu'),
  ('హెరాయిన్', 'heroin', 'te', 'NARCOTICS', 2.0, 'KEYWORD', 'heroin'),
  ('కొకైన్', 'cocaine', 'te', 'NARCOTICS', 2.0, 'KEYWORD', 'kokain'),
  ('మాదకద్రవ్యాలు', 'narcotics', 'te', 'NARCOTICS', 1.5, 'KEYWORD', 'madakadravyalu'),
  ('మత్తు పదార్థాలు', 'intoxicants', 'te', 'NARCOTICS', 1.5, 'KEYWORD', 'mattu padarthalu'),
  ('డ్రగ్స్', 'drugs', 'te', 'NARCOTICS', 1.5, 'KEYWORD', 'drugs'),
  ('స్మాక్', 'heroin', 'te', 'NARCOTICS', 2.0, 'KEYWORD', 'smack'),
  ('బ్రౌన్ షుగర్', 'heroin', 'te', 'NARCOTICS', 2.0, 'KEYWORD', 'brown sugar'),
  ('మెత్', 'methamphetamine', 'te', 'NARCOTICS', 2.0, 'KEYWORD', 'meth'),
  ('చరస్', 'hashish', 'te', 'NARCOTICS', 1.5, 'KEYWORD', 'charas'),
  ('హషీష్', 'hashish', 'te', 'NARCOTICS', 1.5, 'KEYWORD', 'hashish')
ON CONFLICT (term, language) DO NOTHING;

-- ============================================================
-- B. Illicit Liquor Keywords (Telangana-specific)
-- ============================================================
INSERT INTO slang_dictionary (term, normalized_form, language, category, risk_weight, term_type, romanized_form) VALUES
  ('నాటుసారా', 'illicit liquor', 'te', 'ILLICIT_LIQUOR', 2.0, 'KEYWORD', 'naatusaara'),
  ('కల్లు', 'toddy', 'te', 'ILLICIT_LIQUOR', 1.2, 'KEYWORD', 'kallu'),
  ('సారాయి', 'country liquor', 'te', 'ILLICIT_LIQUOR', 1.5, 'KEYWORD', 'saarayi'),
  ('బెల్ట్ షాపు', 'illicit liquor shop', 'te', 'ILLICIT_LIQUOR', 2.0, 'KEYWORD', 'belt shop'),
  ('కల్తీ సారా', 'adulterated liquor', 'te', 'ILLICIT_LIQUOR', 2.5, 'KEYWORD', 'kaltee saara'),
  ('ఇల్లీగల్ లిక్కర్', 'illegal liquor', 'te', 'ILLICIT_LIQUOR', 2.0, 'KEYWORD', 'illegal liquor'),
  ('తాటి కల్లు', 'palm toddy', 'te', 'ILLICIT_LIQUOR', 1.2, 'KEYWORD', 'taati kallu'),
  ('కల్తీ మందు', 'adulterated liquor', 'te', 'ILLICIT_LIQUOR', 2.5, 'KEYWORD', 'kaltee mandu')
ON CONFLICT (term, language) DO NOTHING;

-- ============================================================
-- C. Narcotics Slang (term_type = 'SLANG')
-- ============================================================
INSERT INTO slang_dictionary (term, normalized_form, language, category, risk_weight, term_type, romanized_form) VALUES
  ('మందు', 'drug', 'te', 'NARCOTICS', 1.5, 'SLANG', 'mandu'),
  ('పొడి', 'powder drug', 'te', 'NARCOTICS', 1.5, 'SLANG', 'podi'),
  ('గుళ్ళు', 'pills', 'te', 'NARCOTICS', 1.5, 'SLANG', 'gullu'),
  ('గడ్డి', 'cannabis', 'te', 'NARCOTICS', 1.2, 'SLANG', 'gaddi'),
  ('సరుకు', 'contraband', 'te', 'NARCOTICS', 2.0, 'SLANG', 'saruku'),
  ('మాల్', 'drugs', 'te', 'NARCOTICS', 2.0, 'SLANG', 'maal'),
  ('స్టఫ్', 'drugs', 'te', 'NARCOTICS', 1.5, 'SLANG', 'stuff'),
  ('గాంజ', 'cannabis', 'te', 'NARCOTICS', 1.5, 'SLANG', 'gaanja'),
  ('టిక్కె', 'small drug dose', 'te', 'NARCOTICS', 1.8, 'SLANG', 'tikke'),
  ('పౌడర్', 'powder drug', 'te', 'NARCOTICS', 1.5, 'SLANG', 'poudar'),
  ('డోస్', 'drug dose', 'te', 'NARCOTICS', 1.5, 'SLANG', 'dose'),
  ('గంజి', 'cannabis', 'te', 'NARCOTICS', 1.5, 'SLANG', 'ganji'),
  ('పేపర్', 'LSD blotter', 'te', 'NARCOTICS', 1.5, 'SLANG', 'paper')
ON CONFLICT (term, language) DO NOTHING;

-- ============================================================
-- D. Trafficking & Distribution Keywords
-- ============================================================
INSERT INTO slang_dictionary (term, normalized_form, language, category, risk_weight, term_type, romanized_form) VALUES
  ('తస్కరీ', 'smuggling', 'te', 'NARCOTICS', 2.5, 'KEYWORD', 'taskari'),
  ('స్మగ్లింగ్', 'drug smuggling', 'te', 'NARCOTICS', 2.5, 'KEYWORD', 'smuggling'),
  ('డీలర్', 'drug dealer', 'te', 'NARCOTICS', 2.0, 'KEYWORD', 'dealer'),
  ('సప్లయ్', 'drug supply', 'te', 'NARCOTICS', 2.0, 'KEYWORD', 'supply'),
  ('రవాణా', 'trafficking', 'te', 'NARCOTICS', 2.0, 'KEYWORD', 'ravaana'),
  ('దొంగ రవాణా', 'illegal transport', 'te', 'NARCOTICS', 2.5, 'KEYWORD', 'donga ravaana')
ON CONFLICT (term, language) DO NOTHING;

-- ============================================================
-- E. Violence & Weapons Keywords
-- ============================================================
INSERT INTO slang_dictionary (term, normalized_form, language, category, risk_weight, term_type, romanized_form) VALUES
  ('తుపాకి', 'firearm', 'te', 'WEAPONS', 2.0, 'KEYWORD', 'tupaaki'),
  ('పిస్తోలు', 'pistol', 'te', 'WEAPONS', 2.0, 'KEYWORD', 'pistolu'),
  ('బాంబు', 'bomb', 'te', 'WEAPONS', 2.5, 'KEYWORD', 'bambu'),
  ('కత్తి', 'knife', 'te', 'WEAPONS', 1.5, 'KEYWORD', 'katti'),
  ('తూటాలు', 'bullets', 'te', 'WEAPONS', 2.0, 'KEYWORD', 'tootaalu'),
  ('మందుగుండు', 'ammunition', 'te', 'WEAPONS', 2.0, 'KEYWORD', 'mandugunda'),
  ('హత్య', 'murder', 'te', 'VIOLENCE', 2.5, 'KEYWORD', 'hatya'),
  ('దాడి', 'attack', 'te', 'VIOLENCE', 2.0, 'KEYWORD', 'daadi'),
  ('హింస', 'violence', 'te', 'VIOLENCE', 2.0, 'KEYWORD', 'himsa'),
  ('కొట్టడం', 'assault', 'te', 'VIOLENCE', 1.8, 'KEYWORD', 'kottadam'),
  ('చంపడం', 'killing', 'te', 'VIOLENCE', 2.5, 'KEYWORD', 'champadam')
ON CONFLICT (term, language) DO NOTHING;

-- ============================================================
-- F. Organized Crime & Extortion Keywords
-- ============================================================
INSERT INTO slang_dictionary (term, normalized_form, language, category, risk_weight, term_type, romanized_form) VALUES
  ('ముఠా', 'gang', 'te', 'ORGANIZED_CRIME', 2.0, 'KEYWORD', 'mutha'),
  ('గ్యాంగ్', 'criminal gang', 'te', 'ORGANIZED_CRIME', 2.0, 'KEYWORD', 'gang'),
  ('రౌడీ', 'gangster', 'te', 'ORGANIZED_CRIME', 2.0, 'KEYWORD', 'rowdy'),
  ('సూపారీ', 'contract killing', 'te', 'ORGANIZED_CRIME', 2.5, 'KEYWORD', 'supaari'),
  ('దందా', 'illegal business', 'te', 'ORGANIZED_CRIME', 2.0, 'KEYWORD', 'danda'),
  ('వసూలు', 'extortion collection', 'te', 'EXTORTION', 2.0, 'KEYWORD', 'vasoolu'),
  ('బ్లాక్‌మెయిల్', 'blackmail', 'te', 'EXTORTION', 2.0, 'KEYWORD', 'blackmail'),
  ('బెదిరింపు', 'threat', 'te', 'EXTORTION', 2.0, 'KEYWORD', 'bedirumpu'),
  ('ఫిరౌతి', 'ransom', 'te', 'EXTORTION', 2.5, 'KEYWORD', 'firauti'),
  ('హఫ్తా', 'weekly extortion', 'te', 'EXTORTION', 2.0, 'KEYWORD', 'hafta'),
  ('మోసం', 'fraud', 'te', 'FRAUD', 1.8, 'KEYWORD', 'mosam'),
  ('ఆన్‌లైన్ మోసం', 'online fraud', 'te', 'FRAUD', 2.0, 'KEYWORD', 'online mosam')
ON CONFLICT (term, language) DO NOTHING;

-- ============================================================
-- G. Transaction Slang
-- ============================================================
INSERT INTO slang_dictionary (term, normalized_form, language, category, risk_weight, term_type, romanized_form) VALUES
  ('సరుకు వచ్చింది', 'supply arrived', 'te', 'NARCOTICS', 2.0, 'SLANG', 'saruku vachchindi'),
  ('మాల్ రెడీ', 'drugs ready', 'te', 'NARCOTICS', 2.0, 'SLANG', 'maal ready'),
  ('డెలివరీ', 'drug delivery', 'te', 'NARCOTICS', 2.0, 'SLANG', 'delivery'),
  ('పార్సెల్', 'drug shipment', 'te', 'NARCOTICS', 2.0, 'SLANG', 'parcel')
ON CONFLICT (term, language) DO NOTHING;
