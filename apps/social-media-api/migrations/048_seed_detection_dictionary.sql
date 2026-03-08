-- 048: Seed detection dictionary with properly labeled keywords, slangs, and emojis
-- Reclassify existing entries and add comprehensive narcotics detection terms

-- ============================================================
-- 1. Reclassify existing entries that are keywords (not slang)
-- ============================================================
-- "setting" and "jugaad" are common Hindi words used as code, keep as SLANG
-- All original 10 entries are slang terms — no reclassification needed

-- ============================================================
-- 2. Add KEYWORD entries (plain-language narcotics/crime keywords)
-- ============================================================
INSERT INTO slang_dictionary (term, normalized_form, language, category, risk_weight, term_type, romanized_form) VALUES
  -- English narcotics keywords
  ('drugs', 'drugs', 'en', 'NARCOTICS', 1.0, 'KEYWORD', 'drugs'),
  ('cocaine', 'cocaine', 'en', 'NARCOTICS', 2.0, 'KEYWORD', 'cocaine'),
  ('heroin', 'heroin', 'en', 'NARCOTICS', 2.0, 'KEYWORD', 'heroin'),
  ('methamphetamine', 'methamphetamine', 'en', 'NARCOTICS', 2.0, 'KEYWORD', 'methamphetamine'),
  ('fentanyl', 'fentanyl', 'en', 'NARCOTICS', 2.5, 'KEYWORD', 'fentanyl'),
  ('cannabis', 'cannabis', 'en', 'NARCOTICS', 1.0, 'KEYWORD', 'cannabis'),
  ('marijuana', 'marijuana', 'en', 'NARCOTICS', 1.0, 'KEYWORD', 'marijuana'),
  ('opium', 'opium', 'en', 'NARCOTICS', 1.8, 'KEYWORD', 'opium'),
  ('ecstasy', 'ecstasy', 'en', 'NARCOTICS', 1.5, 'KEYWORD', 'ecstasy'),
  ('MDMA', 'MDMA', 'en', 'NARCOTICS', 1.5, 'KEYWORD', 'MDMA'),
  ('LSD', 'LSD', 'en', 'NARCOTICS', 1.5, 'KEYWORD', 'LSD'),
  ('ketamine', 'ketamine', 'en', 'NARCOTICS', 1.5, 'KEYWORD', 'ketamine'),
  ('amphetamine', 'amphetamine', 'en', 'NARCOTICS', 1.8, 'KEYWORD', 'amphetamine'),
  ('morphine', 'morphine', 'en', 'NARCOTICS', 1.8, 'KEYWORD', 'morphine'),
  ('codeine', 'codeine', 'en', 'NARCOTICS', 1.2, 'KEYWORD', 'codeine'),
  ('trafficking', 'drug trafficking', 'en', 'NARCOTICS', 2.5, 'KEYWORD', 'trafficking'),
  ('smuggling', 'drug smuggling', 'en', 'NARCOTICS', 2.5, 'KEYWORD', 'smuggling'),
  ('dealer', 'drug dealer', 'en', 'NARCOTICS', 2.0, 'KEYWORD', 'dealer'),
  ('overdose', 'drug overdose', 'en', 'NARCOTICS', 2.0, 'KEYWORD', 'overdose'),
  ('stash', 'drug stash', 'en', 'NARCOTICS', 1.5, 'KEYWORD', 'stash'),
  ('cartel', 'drug cartel', 'en', 'ORGANIZED_CRIME', 2.5, 'KEYWORD', 'cartel'),
  ('syndicate', 'crime syndicate', 'en', 'ORGANIZED_CRIME', 2.5, 'KEYWORD', 'syndicate'),
  ('ransom', 'ransom demand', 'en', 'EXTORTION', 2.0, 'KEYWORD', 'ransom'),
  ('extortion', 'extortion', 'en', 'EXTORTION', 2.0, 'KEYWORD', 'extortion'),
  ('blackmail', 'blackmail', 'en', 'EXTORTION', 2.0, 'KEYWORD', 'blackmail'),
  ('firearm', 'firearm', 'en', 'WEAPONS', 2.0, 'KEYWORD', 'firearm'),
  ('pistol', 'pistol', 'en', 'WEAPONS', 2.0, 'KEYWORD', 'pistol'),
  ('rifle', 'rifle', 'en', 'WEAPONS', 2.0, 'KEYWORD', 'rifle'),
  ('ammunition', 'ammunition', 'en', 'WEAPONS', 2.0, 'KEYWORD', 'ammunition'),
  ('explosive', 'explosive', 'en', 'WEAPONS', 2.5, 'KEYWORD', 'explosive'),
  -- Hindi narcotics keywords
  ('गांजा', 'cannabis', 'hi', 'NARCOTICS', 1.5, 'KEYWORD', 'ganja'),
  ('अफीम', 'opium', 'hi', 'NARCOTICS', 1.8, 'KEYWORD', 'afeem'),
  ('भांग', 'cannabis edible', 'hi', 'NARCOTICS', 1.2, 'KEYWORD', 'bhang'),
  ('स्मैक', 'heroin', 'hi', 'NARCOTICS', 2.0, 'KEYWORD', 'smack'),
  ('तस्करी', 'smuggling', 'hi', 'NARCOTICS', 2.5, 'KEYWORD', 'taskari'),
  ('तस्कर', 'smuggler', 'hi', 'NARCOTICS', 2.5, 'KEYWORD', 'taskar'),
  -- Punjabi narcotics keywords
  ('ਅਫੀਮ', 'opium', 'pa', 'NARCOTICS', 1.8, 'KEYWORD', 'afeem'),
  ('ਭੁੱਕੀ', 'poppy husk', 'pa', 'NARCOTICS', 1.5, 'KEYWORD', 'bhukki'),
  ('ਤਸਕਰੀ', 'smuggling', 'pa', 'NARCOTICS', 2.5, 'KEYWORD', 'taskari'),
  ('ਨਸ਼ਾ', 'intoxicant', 'pa', 'NARCOTICS', 1.5, 'KEYWORD', 'nasha')
ON CONFLICT (term, language) DO NOTHING;

-- ============================================================
-- 3. Add more SLANG entries (coded/street terms)
-- ============================================================
INSERT INTO slang_dictionary (term, normalized_form, language, category, risk_weight, term_type, romanized_form) VALUES
  -- English drug slang
  ('snow', 'cocaine', 'en', 'NARCOTICS', 1.5, 'SLANG', 'snow'),
  ('blow', 'cocaine', 'en', 'NARCOTICS', 1.5, 'SLANG', 'blow'),
  ('coke', 'cocaine', 'en', 'NARCOTICS', 1.5, 'SLANG', 'coke'),
  ('crack', 'crack cocaine', 'en', 'NARCOTICS', 2.0, 'SLANG', 'crack'),
  ('ice', 'crystal meth', 'en', 'NARCOTICS', 2.0, 'SLANG', 'ice'),
  ('crystal', 'crystal meth', 'en', 'NARCOTICS', 2.0, 'SLANG', 'crystal'),
  ('speed', 'amphetamine', 'en', 'NARCOTICS', 1.5, 'SLANG', 'speed'),
  ('molly', 'MDMA', 'en', 'NARCOTICS', 1.5, 'SLANG', 'molly'),
  ('acid', 'LSD', 'en', 'NARCOTICS', 1.5, 'SLANG', 'acid'),
  ('shrooms', 'psilocybin mushrooms', 'en', 'NARCOTICS', 1.0, 'SLANG', 'shrooms'),
  ('weed', 'marijuana', 'en', 'NARCOTICS', 1.0, 'SLANG', 'weed'),
  ('pot', 'marijuana', 'en', 'NARCOTICS', 1.0, 'SLANG', 'pot'),
  ('dope', 'heroin/drugs', 'en', 'NARCOTICS', 1.5, 'SLANG', 'dope'),
  ('smack', 'heroin', 'en', 'NARCOTICS', 2.0, 'SLANG', 'smack'),
  ('brown sugar', 'heroin', 'en', 'NARCOTICS', 2.0, 'SLANG', 'brown sugar'),
  ('lean', 'codeine syrup', 'en', 'NARCOTICS', 1.5, 'SLANG', 'lean'),
  ('purple drank', 'codeine syrup', 'en', 'NARCOTICS', 1.5, 'SLANG', 'purple drank'),
  ('plug', 'drug supplier', 'en', 'NARCOTICS', 2.0, 'SLANG', 'plug'),
  ('re-up', 'resupply drugs', 'en', 'NARCOTICS', 2.0, 'SLANG', 're-up'),
  ('trap', 'drug dealing location', 'en', 'NARCOTICS', 2.0, 'SLANG', 'trap'),
  ('trap house', 'drug den', 'en', 'NARCOTICS', 2.0, 'SLANG', 'trap house'),
  ('stash house', 'drug storage', 'en', 'NARCOTICS', 2.0, 'SLANG', 'stash house'),
  ('8ball', '3.5g of cocaine/meth', 'en', 'NARCOTICS', 2.0, 'SLANG', '8ball'),
  ('ounce', 'drug quantity', 'en', 'NARCOTICS', 1.5, 'SLANG', 'ounce'),
  ('kilo', 'kilogram of drugs', 'en', 'NARCOTICS', 2.5, 'SLANG', 'kilo'),
  ('brick', '1kg drug package', 'en', 'NARCOTICS', 2.5, 'SLANG', 'brick'),
  -- Hindi drug slang
  ('गोली', 'pill/tablet', 'hi', 'NARCOTICS', 1.5, 'SLANG', 'goli'),
  ('पाउडर', 'powder drug', 'hi', 'NARCOTICS', 1.5, 'SLANG', 'powder'),
  ('माल भेजो', 'send the drugs', 'hi', 'NARCOTICS', 2.5, 'SLANG', 'maal bhejo'),
  ('पार्सल', 'drug shipment', 'hi', 'NARCOTICS', 2.0, 'SLANG', 'parcel'),
  ('सामान', 'goods/drugs', 'hi', 'NARCOTICS', 1.5, 'SLANG', 'saamaan'),
  ('पैसा वसूली', 'extortion collection', 'hi', 'EXTORTION', 2.0, 'SLANG', 'paisa vasooli'),
  -- Punjabi drug slang
  ('ਚਿੱਟਾ', 'heroin', 'pa', 'NARCOTICS', 2.0, 'SLANG', 'chitta'),
  ('ਫੁੱਕੀ', 'drug puff/dose', 'pa', 'NARCOTICS', 1.8, 'SLANG', 'phukki'),
  ('ਸੁਲਫ਼ਾ', 'cannabis resin', 'pa', 'NARCOTICS', 1.5, 'SLANG', 'sulfa'),
  ('ਡੋਡਾ', 'poppy husk extract', 'pa', 'NARCOTICS', 1.8, 'SLANG', 'doda'),
  ('ਪੋਸਤ', 'poppy', 'pa', 'NARCOTICS', 1.5, 'SLANG', 'post')
ON CONFLICT (term, language) DO NOTHING;

-- ============================================================
-- 4. Add more emoji drug codes (India-specific + missing DEA)
-- ============================================================
INSERT INTO emoji_drug_code (emoji, drug_category, risk_weight, signal_type, description) VALUES
  -- Additional substance emojis
  ('🌀', 'PSYCHEDELICS', 1.0, 'SUBSTANCE', 'Spiral — psychedelic/trip'),
  ('🪬', 'PSYCHEDELICS', 0.5, 'SUBSTANCE', 'Hamsa — spiritual high/DMT'),
  ('🧪', 'DRUGS_GENERAL', 1.5, 'SUBSTANCE', 'Test tube — drug lab/cooking'),
  ('💉', 'HEROIN', 2.0, 'SUBSTANCE', 'Syringe — injection drug use'),
  ('🫧', 'METH', 1.0, 'SUBSTANCE', 'Bubbles — meth pipe/smoking'),
  ('🍀', 'CANNABIS', 1.0, 'SUBSTANCE', 'Four-leaf clover — marijuana'),
  ('🥦', 'CANNABIS', 1.5, 'SUBSTANCE', 'Broccoli — marijuana buds'),
  ('🌳', 'CANNABIS', 1.0, 'SUBSTANCE', 'Deciduous tree — marijuana'),
  ('🍪', 'CANNABIS', 1.0, 'SUBSTANCE', 'Cookie — cannabis edibles'),
  ('🧁', 'CANNABIS', 1.0, 'SUBSTANCE', 'Cupcake — cannabis edibles'),
  ('🟤', 'HEROIN', 1.5, 'SUBSTANCE', 'Brown circle — brown sugar/heroin'),
  ('🐴', 'KETAMINE', 1.5, 'SUBSTANCE', 'Horse — ketamine (horse tranquilizer)'),
  ('👃', 'COCAINE', 1.5, 'SUBSTANCE', 'Nose — snorting/cocaine use'),
  ('🫁', 'DRUGS_GENERAL', 1.0, 'SUBSTANCE', 'Lungs — smoking drugs'),
  ('💨', 'CANNABIS', 1.0, 'SUBSTANCE', 'Dash — smoke/vaping'),
  ('🧂', 'METH', 1.0, 'SUBSTANCE', 'Salt — meth crystals'),
  ('🐲', 'HEROIN', 1.5, 'SUBSTANCE', 'Dragon face — chasing the dragon'),
  -- Additional transaction emojis
  ('🤝', 'TRANSACTION', 1.5, 'TRANSACTION', 'Handshake — drug deal agreed'),
  ('📱', 'TRANSACTION', 1.0, 'TRANSACTION', 'Mobile phone — contact for deal'),
  ('📍', 'TRANSACTION', 1.0, 'TRANSACTION', 'Pin — drop location/meetup'),
  ('🅿️', 'TRANSACTION', 1.5, 'TRANSACTION', 'P button — plug/pusher'),
  ('💰', 'TRANSACTION', 1.5, 'TRANSACTION', 'Money bag — payment/cash'),
  ('🎒', 'TRANSACTION', 1.5, 'TRANSACTION', 'Backpack — carrying drugs'),
  ('🚗', 'TRANSACTION', 1.0, 'TRANSACTION', 'Car — mobile dealing/delivery'),
  ('⏰', 'TRANSACTION', 0.5, 'TRANSACTION', 'Alarm clock — time to re-up'),
  -- Additional quality emojis
  ('✅', 'QUALITY', 1.0, 'QUALITY', 'Check mark — verified/tested'),
  ('🏆', 'QUALITY', 1.0, 'QUALITY', 'Trophy — top-shelf quality'),
  ('👑', 'QUALITY', 1.0, 'QUALITY', 'Crown — premium grade'),
  ('🧨', 'QUALITY', 1.5, 'QUALITY', 'Firecracker — explosive potency'),
  ('⚡', 'QUALITY', 1.0, 'QUALITY', 'Lightning — fast-acting/powerful')
ON CONFLICT (emoji) DO NOTHING;
