/**
 * Seed script for Social Media API.
 * Run: npx tsx scripts/seed.ts (from apps/social-media-api)
 */
import { query, pool } from "../src/db";
import { hashPassword } from "../src/auth";

// ── Telangana divisions ──
const TGCSB_DIVISIONS = [
  { name: "Cyberabad Commissionerate Cyber Cell", unitType: "CYBER_CELL", tierLevel: "DISTRICT" },
  { name: "Hyderabad City Cyber Crime Station", unitType: "CYBER_CELL", tierLevel: "DISTRICT" },
  { name: "Rachakonda Commissionerate Cyber Cell", unitType: "CYBER_CELL", tierLevel: "DISTRICT" },
  { name: "Warangal Range Cyber Cell", unitType: "CYBER_CELL", tierLevel: "DISTRICT" },
  { name: "Karimnagar Range Cyber Cell", unitType: "CYBER_CELL", tierLevel: "DISTRICT" },
  { name: "Nizamabad Range Cyber Cell", unitType: "CYBER_CELL", tierLevel: "DISTRICT" },
  { name: "Khammam Range Cyber Cell", unitType: "CYBER_CELL", tierLevel: "DISTRICT" },
  { name: "Mahabubnagar Range Cyber Cell", unitType: "CYBER_CELL", tierLevel: "DISTRICT" },
];

// ── Category taxonomy ──
const CATEGORIES = [
  { name: "DRUGS_TRAFFICKING", description: "Drug trafficking and narcotics distribution" },
  { name: "DRUGS_CONSUMPTION", description: "Drug use and consumption references" },
  { name: "CYBER_FRAUD", description: "Online financial fraud and scams" },
  { name: "HATE_SPEECH", description: "Communal hatred and incitement" },
  { name: "HARASSMENT", description: "Cyberbullying and online harassment" },
  { name: "CSAM", description: "Child sexual abuse material" },
  { name: "TERRORISM", description: "Terrorist propaganda and recruitment" },
  { name: "FAKE_NEWS", description: "Misinformation and disinformation" },
  { name: "DEFAMATION", description: "Online defamation and character assassination" },
  { name: "EXTORTION", description: "Online extortion and blackmail" },
  { name: "GAMBLING", description: "Illegal online gambling promotion" },
  { name: "IDENTITY_THEFT", description: "Identity theft and impersonation" },
  { name: "GENERAL", description: "General monitoring — does not fit specific threat categories" },
];

// ── Category keyword mapping for content items ──
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  DRUGS_TRAFFICKING: ["drug", "narcotic", "ganja", "cocaine", "mdma", "heroin", "meth", "dealer", "trafficking", "smuggling", "maal", "stuff", "delivery"],
  DRUGS_CONSUMPTION: ["weed", "stoned", "high", "420", "joint", "smoke", "cannabis"],
  CYBER_FRAUD: ["fraud", "scam", "phishing", "fake loan", "otp fraud", "sextortion", "crypto scam", "job fraud", "cheating", "ponzi"],
  HATE_SPEECH: ["communal", "riot", "hatred", "incitement", "enmity", "sectarian", "religious hatred", "provocative"],
  HARASSMENT: ["bully", "harassment", "threat", "stalk", "troll", "exposed", "defam", "morphed"],
  CSAM: ["child abuse", "csam", "minor", "exploitation", "cp links"],
  TERRORISM: ["jihad", "terror", "bomb", "isis", "propaganda", "recruitment", "radicali"],
  FAKE_NEWS: ["fake news", "rumour", "misinformation", "disinformation", "hoax", "misleading"],
  DEFAMATION: ["defamation", "libel", "slander", "false accusation", "character assassination"],
  EXTORTION: ["extortion", "blackmail", "ransom", "sextortion", "threatening"],
  GAMBLING: ["gambling", "betting", "casino", "satta", "matka", "wager"],
  IDENTITY_THEFT: ["identity theft", "impersonation", "fake profile", "catfish", "stolen identity"],
};

// ── Watchlist seeds ──
const WATCHLISTS = [
  {
    name: "Drug Network Monitoring — Telangana",
    description: "Monitor drug trafficking networks across Telangana state via social media channels",
    keywords: ["ganja", "MDMA", "cocaine", "meth", "dark web delivery", "telegram dealer", "emoji code drugs", "chitta", "smack"],
    platforms: ["telegram", "instagram", "whatsapp"],
  },
  {
    name: "Communal Tension Tracker",
    description: "Track communal tension indicators and hate speech across social media platforms",
    keywords: ["communal violence", "riots", "temple attack", "mosque incident", "religious hatred", "provocative speech", "stone pelting"],
    platforms: ["twitter", "facebook", "youtube"],
  },
  {
    name: "Cyber Fraud Ring Detection",
    description: "Detect organized cyber fraud rings operating in Telangana",
    keywords: ["fake loan app", "OTP fraud", "sextortion", "crypto scam", "job fraud", "phishing", "KYC fraud", "UPI fraud"],
    platforms: ["twitter", "instagram", "facebook", "whatsapp"],
  },
  {
    name: "CSAM Detection Keywords",
    description: "Keywords for detection of child sexual abuse material distribution",
    keywords: ["child abuse", "CP links", "minor exploitation", "CSAM hash", "NCMEC tipline"],
    platforms: ["telegram", "twitter"],
  },
  {
    name: "Extremist Content Monitoring",
    description: "Monitor extremist and terrorist propaganda and recruitment content",
    keywords: ["jihad recruitment", "terror financing", "bomb making", "ISIS propaganda", "radicalization", "lone wolf"],
    platforms: ["telegram", "youtube", "twitter"],
  },
];

// ── Monitoring profiles — realistic handles from known drug/crime networks ──
const MONITORING_PROFILES = [
  // UNODC Early Warning Advisory sourced profiles
  { platform: "telegram", entryType: "GROUP", handle: "t.me/darknet_deals_india", priority: "HIGH", source: "UNODC",
    sourceRef: "UNODC-EWA-2025-IND-0034", suspectName: "Unknown (network)", notes: "UNODC Early Warning Advisory: synthetic opioid distribution network targeting South Asia. Fentanyl analogues. Cross-referenced with INCB precursor watch." },
  { platform: "instagram", entryType: "PROFILE", handle: "@afghan_heroin_route", priority: "HIGH", source: "UNODC",
    sourceRef: "UNODC-WDR-2025-AF-112", suspectName: "Unknown", notes: "UNODC World Drug Report 2025: Golden Crescent route — Afghan heroin supply chain using social media for distribution coordination." },
  { platform: "telegram", entryType: "GROUP", handle: "t.me/nps_research_chems", priority: "HIGH", source: "UNODC",
    sourceRef: "UNODC-EWA-2025-NPS-0087", suspectName: "Unknown (vendor network)", notes: "UNODC NPS Early Warning: Novel psychoactive substances marketed as 'research chemicals'. Active shipping to India." },
  { platform: "twitter", entryType: "PROFILE", handle: "@crypto_pharma_direct", priority: "NORMAL", source: "UNODC",
    sourceRef: "UNODC-EWA-2024-CRYPTO-019", suspectName: "Unknown", notes: "UNODC crypto-narcotics monitoring: cryptocurrency-based drug marketplace operator with India delivery network." },

  // EUROPOL sourced profiles (via INTERPOL I-24/7 sharing)
  { platform: "telegram", entryType: "GROUP", handle: "t.me/encrochat_successors", priority: "HIGH", source: "EUROPOL",
    sourceRef: "EUROPOL-EDNA-2025-0451", suspectName: "Unknown (encrypted network)", notes: "Europol EDNA: successor channel to dismantled EncroChat network. Indian nodes identified in Hyderabad and Mumbai. MDMA and cocaine supply." },
  { platform: "instagram", entryType: "PROFILE", handle: "@dutch_pill_press_export", priority: "HIGH", source: "EUROPOL",
    sourceRef: "EUROPOL-EMCDDA-2025-NL-078", suspectName: "Unknown", notes: "Europol-EMCDDA joint alert: Dutch ecstasy production network using Instagram for wholesale distribution to Asian markets." },
  { platform: "facebook", entryType: "PAGE", handle: "HerbalHighsEurope", priority: "NORMAL", source: "EUROPOL",
    sourceRef: "EUROPOL-EDNA-2024-1203", suspectName: "Unknown", notes: "Europol Drug Networks Analysis: NPS vendor page shipping 'legal highs' to India via international post. Customs seizures reported." },
  { platform: "x", entryType: "PROFILE", handle: "@darkweb_market_updates", priority: "NORMAL", source: "EUROPOL",
    sourceRef: "EUROPOL-SIRIUS-2025-0089", suspectName: "Unknown", notes: "Europol SIRIUS project: account promoting dark web marketplaces. Posts links to .onion markets with India-shipping vendors." },

  // INTERPOL sourced profiles
  { platform: "telegram", entryType: "GROUP", handle: "t.me/golden_triangle_supply", priority: "HIGH", source: "INTERPOL",
    sourceRef: "INTERPOL-IONICS-2025-MM-034", suspectName: "Unknown (syndicate)", notes: "INTERPOL Project IONICS: methamphetamine supply chain from Golden Triangle (Myanmar-Laos-Thailand) with distribution in India via Mizoram-Manipur corridor." },
  { platform: "instagram", entryType: "PROFILE", handle: "@silk_road_revival_2025", priority: "HIGH", source: "INTERPOL",
    sourceRef: "INTERPOL-DNMR-2025-0156", suspectName: "Unknown", notes: "INTERPOL Dark Net Monitoring Report: account promoting successor Silk Road marketplace. Indian vendor section active with 50+ listings." },
  { platform: "whatsapp", entryType: "GROUP", handle: "+91-9XXXXXXXXX (Syndicate Alpha)", priority: "HIGH", source: "INTERPOL",
    sourceRef: "INTERPOL-IOC-2025-IN-0023", suspectName: "Confidential (INTERPOL Red Notice)", notes: "INTERPOL IOC sharing: WhatsApp group coordinating cross-border heroin trafficking. India-Pakistan-Afghanistan route. Red Notice suspect as admin." },
  { platform: "youtube", entryType: "PROFILE", handle: "@clandestine_chemistry_101", priority: "NORMAL", source: "INTERPOL",
    sourceRef: "INTERPOL-PRECURSOR-2025-0045", suspectName: "Unknown", notes: "INTERPOL Precursor Control: YouTube channel with methamphetamine synthesis tutorials. 25,000+ subscribers. Content sourced from seized lab documentation." },

  // NCB (Narcotics Control Bureau India) sourced profiles
  { platform: "instagram", entryType: "PROFILE", handle: "@goa_rave_scene_2026", priority: "HIGH", source: "NCB",
    sourceRef: "NCB-OP-PRAHAR-2025-GOA-012", suspectName: "Suspected: Daniel Fernandes", notes: "NCB Operation Prahar: Instagram account promoting rave parties with drug supply. Linked to Goa-Hyderabad MDMA pipeline. NDPS Sec 22(c)." },
  { platform: "telegram", entryType: "GROUP", handle: "t.me/chitta_punjab_supply", priority: "HIGH", source: "NCB",
    sourceRef: "NCB-OP-SAMANVAY-2025-PB-087", suspectName: "Unknown (Chitta network)", notes: "NCB Operation Samanvay: Telegram group coordinating 'chitta' (heroin) supply from Punjab to Southern states including Telangana. NDPS Sec 21(c)." },
  { platform: "facebook", entryType: "PROFILE", handle: "kashmiri.charas.premium", priority: "HIGH", source: "NCB",
    sourceRef: "NCB-ZONAL-HYD-2025-0034", suspectName: "Suspected: Farooq Ahmad Dar", notes: "NCB Hyderabad Zonal Unit: Facebook profile advertising Kashmir-origin charas. Inter-state trafficking via road transport. NDPS Sec 20(b)(ii)(C)." },
  { platform: "whatsapp", entryType: "GROUP", handle: "+91-8XXXXXXXXX (AOB Network)", priority: "HIGH", source: "NCB",
    sourceRef: "NCB-AOB-2025-TS-0019", suspectName: "Multiple suspects", notes: "NCB intelligence: WhatsApp coordination group for Andhra-Odisha Border ganja trafficking. 200+ kg monthly volume to Hyderabad. NDPS Sec 20." },
  { platform: "instagram", entryType: "PROFILE", handle: "@party_powder_hyd", priority: "HIGH", source: "NCB",
    sourceRef: "NCB-ZONAL-HYD-2025-0056", suspectName: "Suspected: Rahul Mehta", notes: "NCB Hyderabad Zonal Unit: cocaine and MDMA distribution targeting Hyderabad nightlife. Film industry connections. NDPS Sec 22, 25A." },

  // DEA (US Drug Enforcement Administration) via mutual legal assistance
  { platform: "telegram", entryType: "GROUP", handle: "t.me/fentanyl_precursors_asia", priority: "HIGH", source: "DEA",
    sourceRef: "DEA-MLAT-2025-IN-0012", suspectName: "Unknown (precursor network)", notes: "DEA MLAT request: Telegram group trading fentanyl precursor chemicals sourced from Chinese manufacturers. Indian pharmaceutical companies as front. NDPS Sec 25A, 29." },
  { platform: "x", entryType: "PROFILE", handle: "@darkweb_vendor_bombay", priority: "HIGH", source: "DEA",
    sourceRef: "DEA-DARKNET-2025-IN-0034", suspectName: "Suspected: 'PharmKing_IN'", notes: "DEA Dark Web Task Force: top-10 Indian vendor on multiple dark web marketplaces. Ships internationally. Primarily prescription opioids and benzodiazepines." },

  // FATF (Financial Action Task Force) — financial intelligence on drug money laundering
  { platform: "telegram", entryType: "GROUP", handle: "t.me/hawala_crypto_exchange", priority: "HIGH", source: "FATF",
    sourceRef: "FATF-MER-2025-IN-STR-0089", suspectName: "Unknown (hawala network)", notes: "FATF Mutual Evaluation Report 2025: Telegram-based hawala-crypto hybrid network laundering drug proceeds. Linked to Telangana and Maharashtra operations. PMLA applicable." },
  { platform: "instagram", entryType: "PROFILE", handle: "@luxury_lifestyle_hyd_crypto", priority: "NORMAL", source: "FATF",
    sourceRef: "FATF-STR-2025-IN-0156", suspectName: "Suspected: Vikram Reddy", notes: "FATF STR analysis: Instagram account displaying unexplained wealth. Crypto wallet analysis indicates drug proceeds laundering. ED/PMLA referral recommended." },

  // NIDAAN (National Integrated Database on Arrested Narco-offenders) — additional profiles
  { platform: "instagram", entryType: "PROFILE", handle: "@malana_cream_hyd_delivery", priority: "HIGH", source: "NIDAAN",
    sourceRef: "NID-2025-TS-00891", suspectName: "Ajay Thakur", notes: "NIDAAN record: Convicted NDPS Sec 20 (2023, Kullu). Released on bail. Active on Instagram advertising charas delivery to Hyderabad. Repeat offender." },
  { platform: "telegram", entryType: "GROUP", handle: "t.me/hyderabad_stuff_420", priority: "HIGH", source: "NIDAAN",
    sourceRef: "NID-2025-TS-01234", suspectName: "Syed Imran Ali", notes: "NIDAAN record: Arrested NDPS Sec 21 (2024, Hyderabad). FIR 342/2024 Cyber Crime PS. Operating Telegram drug channel post-bail." },
  { platform: "facebook", entryType: "PROFILE", handle: "warangal.green.garden.supplies", priority: "HIGH", source: "NIDAAN",
    sourceRef: "NID-2025-TS-00756", suspectName: "Ramesh Yadav", notes: "NIDAAN record: 2 prior convictions NDPS Sec 20 (ganja). Using Facebook marketplace under cover of 'garden supplies' for drug sales in Warangal district." },
  { platform: "instagram", entryType: "PROFILE", handle: "@nizamabad_party_supplies", priority: "HIGH", source: "NIDAAN",
    sourceRef: "NID-2025-TS-01567", suspectName: "Praveen Kumar Goud", notes: "NIDAAN record: FIR 178/2025 Nizamabad PS. MDMA and LSD distribution to college campuses via Instagram. NDPS Sec 22, 27A." },
  { platform: "x", entryType: "PROFILE", handle: "@karimnagar_contraband", priority: "NORMAL", source: "NIDAAN",
    sourceRef: "NID-2024-TS-00623", suspectName: "Mohammed Shahid", notes: "NIDAAN record: Arrested NDPS Sec 20 (2024, Karimnagar). Suspected continued activity via X/Twitter after release." },

  // TEF (Telangana Enforcement Field) tips
  { platform: "instagram", entryType: "PROFILE", handle: "@jubilee_hills_party_scene", priority: "HIGH", source: "TEF",
    sourceRef: "TEF-TS-2025-0312", suspectName: "Unknown", notes: "SHO Jubilee Hills PS field tip: Instagram account linked to party drug supply circuit in Jubilee Hills, Banjara Hills, and Film Nagar areas." },
  { platform: "telegram", entryType: "GROUP", handle: "t.me/secunderabad_cantonment_delivery", priority: "HIGH", source: "TEF",
    sourceRef: "TEF-TS-2025-0445", suspectName: "Suspected: Ex-military personnel", notes: "TEF field intelligence: Telegram group operating drug delivery in Secunderabad Cantonment area. Suspected link to ex-military personnel." },
  { platform: "whatsapp", entryType: "GROUP", handle: "+91-7XXXXXXXXX (Campus Circuit)", priority: "NORMAL", source: "TEF",
    sourceRef: "TEF-TS-2025-0567", suspectName: "Student network", notes: "TEF campus intelligence: WhatsApp group coordinating drug supply to engineering colleges in Medchal-Malkajgiri district." },

  // PRIVATE (Confidential Informant) sources
  { platform: "instagram", entryType: "PROFILE", handle: "@old_city_hyd_supplies", priority: "HIGH", source: "PRIVATE",
    sourceRef: "PRV-CI-2025-0089", suspectName: "Confidential", notes: "CI source (verified): Instagram profile running drug supply in Old City Hyderabad. Brown sugar and ganja. Connected to inter-state network." },
  { platform: "telegram", entryType: "GROUP", handle: "t.me/lb_nagar_delivery_boys", priority: "NORMAL", source: "PRIVATE",
    sourceRef: "PRV-CI-2025-0112", suspectName: "Confidential", notes: "CI source: Telegram group coordinating last-mile drug delivery using bike riders in LB Nagar, Dilsukhnagar, and Kothapet areas." },
];

// ── Jurisdiction locations — Telangana districts ──
const JURISDICTION_LOCATIONS = [
  { district: "Hyderabad", cities: ["Hyderabad"], areas: ["Charminar", "Secunderabad", "Begumpet", "Ameerpet", "Banjara Hills", "Jubilee Hills", "Film Nagar", "Somajiguda", "Abids", "Nampally", "Sultan Bazaar", "Koti", "Old City", "Mehdipatnam"], altSpellings: ["Hyd", "HYD", "హైదరాబాద్"] },
  { district: "Cyberabad", cities: ["Gachibowli", "Madhapur", "Kondapur", "Kukatpally"], areas: ["HITEC City", "Financial District", "Nanakramguda", "Raidurgam", "Manikonda", "Narsingi", "Kokapet", "Tellapur", "Chandanagar", "Lingampally", "Miyapur"], altSpellings: ["Cyberabad Commissionerate", "సైబరాబాద్"] },
  { district: "Rachakonda", cities: ["LB Nagar", "Uppal", "Malkajgiri"], areas: ["Dilsukhnagar", "Kothapet", "Hayathnagar", "Vanasthalipuram", "Nagole", "Boduppal", "Peerzadiguda", "Ghatkesar", "Pocharam", "Medipally"], altSpellings: ["Rachakonda Commissionerate", "రాచకొండ"] },
  { district: "Warangal", cities: ["Warangal", "Hanamkonda", "Kazipet"], areas: ["Fort Warangal", "Hunter Road", "Subedari", "Mulugu Road", "Nakkalagutta", "Balasamudram"], altSpellings: ["WGL", "Warangal Urban", "వరంగల్"] },
  { district: "Karimnagar", cities: ["Karimnagar", "Ramagundam", "Godavarikhani"], areas: ["Mankammathota", "Kothirampur", "Jyothinagar", "Chaitanyapuri"], altSpellings: ["KNR", "కరీంనగర్"] },
  { district: "Nizamabad", cities: ["Nizamabad", "Bodhan", "Armoor"], areas: ["Kanteshwar", "Sarangapur", "Pragathi Nagar"], altSpellings: ["NZB", "నిజామాబాద్"] },
  { district: "Khammam", cities: ["Khammam", "Kothagudem", "Bhadrachalam"], areas: ["Wyra Road", "Ballepalli", "Rotary Nagar", "Gandhi Chowk"], altSpellings: ["KHM", "ఖమ్మం"] },
  { district: "Mahabubnagar", cities: ["Mahabubnagar", "Jadcherla", "Shadnagar"], areas: ["Town Centre", "Bhootpur", "Rajapur"], altSpellings: ["MBN", "Mahbubnagar", "Palamoor", "మహబూబ్‌నగర్"] },
  { district: "Medchal-Malkajgiri", cities: ["Kompally", "Alwal", "Medchal"], areas: ["Bowenpally", "Secunderabad Cantonment", "Trimulgherry", "Dammaiguda", "Yapral"], altSpellings: ["Medchal", "మేడ్చల్"] },
  { district: "Rangareddy", cities: ["Shamshabad", "Chevella", "Ibrahimpatnam"], areas: ["Rajiv Gandhi International Airport", "Shamshabad Industrial Area", "Tukkuguda", "Adibatla", "Maheshwaram"], altSpellings: ["RR District", "Ranga Reddy", "రంగారెడ్డి"] },
  { district: "Nalgonda", cities: ["Nalgonda", "Suryapet", "Miryalaguda"], areas: ["Station Road", "Panagal", "Chityala"], altSpellings: ["NLG", "నల్గొండ"] },
  { district: "Adilabad", cities: ["Adilabad", "Mancherial", "Nirmal"], areas: ["Collectorate Road", "Gandhi Nagar", "Old Bus Stand Area"], altSpellings: ["ADB", "ఆదిలాబాద్"] },
];

// ── Model registry seeds ──
const MODELS = [
  { name: "Content Classifier v3", type: "CLASSIFIER", version: "3.1.0", status: "ACTIVE", accuracy: 0.89, daysAgo: 7 },
  { name: "Drug Imagery Detector", type: "CLASSIFIER", version: "2.0.1", status: "ACTIVE", accuracy: 0.94, daysAgo: 3 },
  { name: "Hate Speech Detector (Hindi)", type: "CLASSIFIER", version: "1.2.0", status: "ACTIVE", accuracy: 0.82, daysAgo: 14 },
  { name: "Threat Score Predictor", type: "RISK_SCORER", version: "4.0.0", status: "ACTIVE", accuracy: 0.91, daysAgo: 5 },
  { name: "Sentiment Analyzer", type: "CLASSIFIER", version: "2.5.0", status: "ACTIVE", accuracy: 0.87, daysAgo: 10 },
  { name: "CSAM Hash Matcher", type: "CLASSIFIER", version: "1.0.0", status: "ACTIVE", accuracy: 0.99, daysAgo: 1 },
  { name: "Entity Extractor (Telugu)", type: "NER", version: "1.1.0", status: "TESTING", accuracy: 0.75, daysAgo: 2 },
  { name: "Content Classifier v2", type: "CLASSIFIER", version: "2.8.0", status: "DEPRECATED", accuracy: 0.81, daysAgo: 60 },
];

// ── Additional legal mapping rules ──
const LEGAL_RULES = [
  { code: "BNS-79", law: "Bharatiya Nyaya Sanhita", provision: "79", weight: 6.0, from: "2024-07-01",
    expr: { operator: "AND", conditions: [
      { field: "category", op: "in", values: ["HARASSMENT", "SEXUAL_HARASSMENT"] },
      { field: "keywords", op: "contains_any", values: ["modesty", "insult", "woman", "obscene gesture", "voyeurism"] },
    ]}},
  { code: "BNS-112", law: "Bharatiya Nyaya Sanhita", provision: "112", weight: 5.0, from: "2024-07-01",
    expr: { operator: "AND", conditions: [
      { field: "category", op: "in", values: ["CYBER_FRAUD"] },
      { field: "threat_score", op: "lt", value: 60 },
      { field: "keywords", op: "contains_any", values: ["petty crime", "small fraud", "organized petty", "chain snatching"] },
    ]}},
  { code: "BNS-308", law: "Bharatiya Nyaya Sanhita", provision: "308", weight: 7.0, from: "2024-07-01",
    expr: { operator: "AND", conditions: [
      { field: "category", op: "in", values: ["EXTORTION"] },
      { field: "keywords", op: "contains_any", values: ["extortion", "blackmail", "ransom", "threat to expose", "pay or else"] },
    ]}},
  { code: "BNS-316", law: "Bharatiya Nyaya Sanhita", provision: "316", weight: 5.0, from: "2024-07-01",
    expr: { operator: "AND", conditions: [
      { field: "category", op: "in", values: ["CYBER_FRAUD"] },
      { field: "keywords", op: "contains_any", values: ["breach of trust", "misappropriation", "embezzlement", "trusted position"] },
    ]}},
  { code: "BNS-336", law: "Bharatiya Nyaya Sanhita", provision: "336", weight: 5.0, from: "2024-07-01",
    expr: { operator: "AND", conditions: [
      { field: "category", op: "in", values: ["IDENTITY_THEFT", "CYBER_FRAUD"] },
      { field: "keywords", op: "contains_any", values: ["forgery", "forged document", "fake certificate", "counterfeit", "fabricated"] },
    ]}},
  { code: "BNS-352", law: "Bharatiya Nyaya Sanhita", provision: "352", weight: 3.0, from: "2024-07-01",
    expr: { operator: "AND", conditions: [
      { field: "category", op: "in", values: ["DEFAMATION", "HARASSMENT"] },
      { field: "keywords", op: "contains_any", values: ["insult", "provoke", "intentional insult", "public humiliation", "degrading"] },
    ]}},
  { code: "BNS-197", law: "Bharatiya Nyaya Sanhita", provision: "197", weight: 7.0, from: "2024-07-01",
    expr: { operator: "AND", conditions: [
      { field: "category", op: "in", values: ["HATE_SPEECH"] },
      { field: "keywords", op: "contains_any", values: ["national integration", "caste hatred", "linguistic hatred", "regional bias", "anti-national"] },
    ]}},
  { code: "BNS-48", law: "Bharatiya Nyaya Sanhita", provision: "48", weight: 5.0, from: "2024-07-01",
    expr: { operator: "AND", conditions: [
      { field: "threat_score", op: "gte", value: 80 },
      { field: "keywords", op: "contains_any", values: ["abetment", "inciting", "aiding", "instigating", "provoking crime"] },
    ]}},
  { code: "BNS-303", law: "Bharatiya Nyaya Sanhita", provision: "303", weight: 5.0, from: "2024-07-01",
    expr: { operator: "AND", conditions: [
      { field: "category", op: "in", values: ["CYBER_FRAUD", "IDENTITY_THEFT"] },
      { field: "keywords", op: "contains_any", values: ["data theft", "stealing data", "stolen credentials", "password theft", "account takeover"] },
    ]}},
  { code: "IT-66C", law: "IT Act", provision: "66C", weight: 6.0, from: "2000-10-17",
    expr: { operator: "AND", conditions: [
      { field: "category", op: "in", values: ["IDENTITY_THEFT"] },
      { field: "keywords", op: "contains_any", values: ["identity theft", "stolen identity", "electronic signature", "password stolen", "impersonation online"] },
    ]}},
  { code: "IT-66D", law: "IT Act", provision: "66D", weight: 6.0, from: "2000-10-17",
    expr: { operator: "AND", conditions: [
      { field: "category", op: "in", values: ["CYBER_FRAUD", "IDENTITY_THEFT"] },
      { field: "keywords", op: "contains_any", values: ["personation", "impersonation", "fake identity", "pretending to be", "catfish"] },
    ]}},
  { code: "IT-66E", law: "IT Act", provision: "66E", weight: 7.0, from: "2000-10-17",
    expr: { operator: "AND", conditions: [
      { field: "category", op: "in", values: ["HARASSMENT", "SEXUAL_HARASSMENT"] },
      { field: "keywords", op: "contains_any", values: ["intimate images", "revenge porn", "privacy violation", "non-consensual", "morphed photos"] },
    ]}},
  { code: "IT-67A", law: "IT Act", provision: "67A", weight: 9.0, from: "2000-10-17",
    expr: { operator: "OR", conditions: [
      { field: "category", op: "in", values: ["CSAM"] },
      { field: "keywords", op: "contains_any", values: ["child pornography", "child exploitation", "CSAM", "POCSO", "minor abuse material"] },
    ]}},
  { code: "IT-67B", law: "IT Act", provision: "67B", weight: 9.0, from: "2000-10-17",
    expr: { operator: "AND", conditions: [
      { field: "category", op: "in", values: ["CSAM"] },
      { field: "keywords", op: "contains_any", values: ["browsing child pornography", "viewing CSAM", "accessing CP", "downloading CP"] },
    ]}},
  { code: "NDPS-20B", law: "NDPS Act", provision: "20(b)", weight: 8.0, from: "1985-11-14",
    expr: { operator: "AND", conditions: [
      { field: "category", op: "in", values: ["DRUGS_TRAFFICKING", "DRUGS_CONSUMPTION"] },
      { field: "keywords", op: "contains_any", values: ["cannabis", "ganja", "marijuana", "hemp", "bhang", "charas", "hashish"] },
    ]}},
];

async function seed() {
  console.log("[SEED] Starting Social Media API seed...");

  // 1. Organization units — base units
  const units = [
    { name: "Headquarters", unitType: "HQ" },
    { name: "District 1", unitType: "DISTRICT" },
    { name: "District 2", unitType: "DISTRICT" },
    { name: "TGCSB Headquarters", unitType: "HQ" },
  ];
  for (const u of units) {
    await query(
      `INSERT INTO organization_unit (unit_id, name, unit_type, is_active)
       SELECT gen_random_uuid(), $1::varchar, $2::varchar, true
       WHERE NOT EXISTS (SELECT 1 FROM organization_unit WHERE name = $1::varchar)`,
      [u.name, u.unitType],
    );
  }
  console.log("[SEED] Base organization units created");

  // Get TGCSB HQ unit_id
  const tgcsbResult = await query(`SELECT unit_id FROM organization_unit WHERE name = 'TGCSB Headquarters' LIMIT 1`);
  const tgcsbUnitId = tgcsbResult.rows[0]?.unit_id || null;

  // 1b. Telangana divisions under TGCSB HQ
  const divisionUnitIds: string[] = [];
  for (const div of TGCSB_DIVISIONS) {
    await query(
      `INSERT INTO organization_unit (unit_id, name, unit_type, tier_level, parent_unit_id, is_active)
       SELECT gen_random_uuid(), $1::varchar, $2::varchar, $3::text, $4::uuid, true
       WHERE NOT EXISTS (SELECT 1 FROM organization_unit WHERE name = $1::varchar)`,
      [div.name, div.unitType, div.tierLevel, tgcsbUnitId],
    );
    // Fetch the unit_id (may already exist)
    const fetched = await query(`SELECT unit_id FROM organization_unit WHERE name = $1 LIMIT 1`, [div.name]);
    if (fetched.rows[0]) divisionUnitIds.push(fetched.rows[0].unit_id);
  }
  console.log(`[SEED] ${divisionUnitIds.length} Telangana divisions ensured`);

  // 2. Roles
  const roles = ["INTELLIGENCE_ANALYST", "CONTROL_ROOM_OPERATOR", "SUPERVISOR", "INVESTIGATOR", "LEGAL_REVIEWER", "EVIDENCE_CUSTODIAN", "PLATFORM_ADMINISTRATOR"];
  for (const rk of roles) {
    await query(
      `INSERT INTO role (role_id, role_key, display_name, description)
       VALUES (gen_random_uuid(), $1, $2, $3)
       ON CONFLICT (role_key) DO NOTHING`,
      [rk, rk, rk],
    );
  }
  console.log("[SEED] Roles ensured");

  // Get HQ unit_id (original)
  const hqResult = await query(`SELECT unit_id FROM organization_unit WHERE name = 'Headquarters' LIMIT 1`);
  const hqUnitId = hqResult.rows[0]?.unit_id || null;

  // 3. Original generic users
  const users = [
    { username: "admin", password: "password", fullName: "Admin User", userType: "OFFICER", roleMappings: ["PLATFORM_ADMINISTRATOR"], unitId: hqUnitId },
    { username: "analyst1", password: "password", fullName: "Analyst One", userType: "OFFICER", roleMappings: ["INTELLIGENCE_ANALYST"], unitId: hqUnitId },
    { username: "supervisor1", password: "password", fullName: "Supervisor One", userType: "OFFICER", roleMappings: ["SUPERVISOR"], unitId: hqUnitId },
  ];

  for (const u of users) {
    const hash = await hashPassword(u.password);
    const result = await query(
      `INSERT INTO user_account (user_id, username, password_hash, full_name, user_type, unit_id, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true)
       ON CONFLICT (username) DO NOTHING
       RETURNING user_id`,
      [u.username, hash, u.fullName, u.userType, u.unitId],
    );

    if (result.rows.length > 0) {
      const userId = result.rows[0].user_id;
      for (const roleKey of u.roleMappings) {
        await query(
          `INSERT INTO user_role (user_id, role_id)
           SELECT $1, role_id FROM role WHERE role_key = $2
           ON CONFLICT DO NOTHING`,
          [userId, roleKey],
        );
      }
      console.log(`[SEED] Created user: ${u.username}`);
    } else {
      console.log(`[SEED] User already exists: ${u.username}`);
    }
  }

  // 3b. Telangana Police (TGCSB) officers
  const tgcsbOfficers = [
    { username: "dg_rao", password: "tgcsb2026", fullName: "K. Venkateswara Rao", designation: "ADGP, Director TGCSB", roleMappings: ["PLATFORM_ADMINISTRATOR"] },
    { username: "dig_deepthi", password: "tgcsb2026", fullName: "G. Chandana Deepthi", designation: "DIG, Cyber Crime Range", roleMappings: ["SUPERVISOR"] },
    { username: "dcp_raghav", password: "tgcsb2026", fullName: "S. Raghavendra Reddy", designation: "DCP Cybercrime, Cyberabad", roleMappings: ["SUPERVISOR"] },
    { username: "dsp_srinivas", password: "tgcsb2026", fullName: "P. Srinivasa Rao", designation: "DSP, Cyber Crime PS", roleMappings: ["INVESTIGATOR"] },
    { username: "acp_sudarshan", password: "tgcsb2026", fullName: "R. Sudarshan", designation: "ACP, Social Media Cell", roleMappings: ["INVESTIGATOR"] },
    { username: "insp_lakshmi", password: "tgcsb2026", fullName: "M. Lakshmi Prasad", designation: "Inspector, Cyber Crime PS", roleMappings: ["INTELLIGENCE_ANALYST"] },
    { username: "si_padma", password: "tgcsb2026", fullName: "N. Padmavathi", designation: "Sub-Inspector, TGCSB HQ", roleMappings: ["INTELLIGENCE_ANALYST"] },
    { username: "si_anuradha", password: "tgcsb2026", fullName: "B. Anuradha Sharma", designation: "Sub-Inspector, Digital Forensics", roleMappings: ["EVIDENCE_CUSTODIAN"] },
  ];

  for (const o of tgcsbOfficers) {
    const hash = await hashPassword(o.password);
    const result = await query(
      `INSERT INTO user_account (user_id, username, password_hash, full_name, user_type, unit_id, designation, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, 'OFFICER', $4, $5, true)
       ON CONFLICT (username) DO UPDATE SET designation = EXCLUDED.designation
       RETURNING user_id`,
      [o.username, hash, o.fullName, tgcsbUnitId, o.designation],
    );

    if (result.rows.length > 0) {
      const userId = result.rows[0].user_id;
      for (const roleKey of o.roleMappings) {
        await query(
          `INSERT INTO user_role (user_id, role_id)
           SELECT $1, role_id FROM role WHERE role_key = $2
           ON CONFLICT DO NOTHING`,
          [userId, roleKey],
        );
      }
      console.log(`[SEED] Created/updated TGCSB officer: ${o.username} (${o.designation})`);
    }
  }

  // 3c. Division officers — 2 per division (1 INVESTIGATOR, 1 INTELLIGENCE_ANALYST)
  const divisionOfficerNames = [
    ["V. Ramesh Kumar", "A. Priya Reddy"],
    ["S. Kiran Babu", "L. Swathi Devi"],
    ["M. Ravi Shankar", "K. Sunitha Rani"],
    ["T. Narasimha Rao", "D. Kavitha"],
    ["G. Venkat Reddy", "P. Anitha Kumari"],
    ["H. Bhaskar Rao", "S. Madhavi Latha"],
    ["R. Srinivas Murthy", "V. Jyothi"],
    ["K. Mahesh Babu", "N. Rajeshwari"],
  ];

  const divisionOfficerIds: string[][] = [];
  for (let i = 0; i < divisionUnitIds.length; i++) {
    const unitId = divisionUnitIds[i];
    const names = divisionOfficerNames[i] || [`Officer ${i * 2 + 1}`, `Officer ${i * 2 + 2}`];
    const officerIds: string[] = [];
    for (let j = 0; j < 2; j++) {
      const uname = `div${i + 1}_officer${j + 1}`;
      const roleKey = j === 0 ? "INVESTIGATOR" : "INTELLIGENCE_ANALYST";
      const designation = j === 0 ? "Inspector" : "Sub-Inspector";
      const hash = await hashPassword("tgcsb2026");
      const res = await query(
        `INSERT INTO user_account (user_id, username, password_hash, full_name, user_type, unit_id, designation, is_active)
         VALUES (gen_random_uuid(), $1, $2, $3, 'OFFICER', $4, $5, true)
         ON CONFLICT (username) DO UPDATE SET unit_id = EXCLUDED.unit_id, designation = EXCLUDED.designation
         RETURNING user_id`,
        [uname, hash, names[j], unitId, designation],
      );
      if (res.rows[0]) {
        officerIds.push(res.rows[0].user_id);
        await query(
          `INSERT INTO user_role (user_id, role_id)
           SELECT $1, role_id FROM role WHERE role_key = $2
           ON CONFLICT DO NOTHING`,
          [res.rows[0].user_id, roleKey],
        );
      }
    }
    divisionOfficerIds.push(officerIds);
  }
  console.log("[SEED] Division officers created");

  // 3d. Stable demo superuser — password always reset on seed
  const demoHash = await hashPassword("demo");
  const demoResult = await query(
    `INSERT INTO user_account (user_id, username, password_hash, full_name, user_type, unit_id, designation, is_active, failed_login_attempts, locked_until)
     VALUES (gen_random_uuid(), 'demo', $1, 'Demo Superuser', 'OFFICER', $2, 'System Administrator', true, 0, NULL)
     ON CONFLICT (username) DO UPDATE SET password_hash = $1, is_active = true, failed_login_attempts = 0, locked_until = NULL, unit_id = $2
     RETURNING user_id`,
    [demoHash, tgcsbUnitId],
  );
  const demoUserId = demoResult.rows[0].user_id;
  for (const rk of roles) {
    await query(
      `INSERT INTO user_role (user_id, role_id)
       SELECT $1, role_id FROM role WHERE role_key = $2
       ON CONFLICT DO NOTHING`,
      [demoUserId, rk],
    );
  }
  console.log("[SEED] Demo superuser created/reset: demo / demo");

  // 4. Source connectors
  for (const c of [
    { platform: "reddit", type: "Polling" },
    { platform: "youtube", type: "Polling" },
    { platform: "twitter", type: "Polling" },
    { platform: "instagram", type: "Polling" },
    { platform: "facebook", type: "Polling" },
    { platform: "apify", type: "Polling" },
    { platform: "telegram", type: "Polling" },
    { platform: "whatsapp", type: "Polling" },
  ]) {
    await query(
      `INSERT INTO source_connector (platform, connector_type, config_jsonb, is_active)
       SELECT $1::varchar, $2::varchar, '{}'::jsonb, true
       WHERE NOT EXISTS (SELECT 1 FROM source_connector WHERE platform = $1::varchar)`,
      [c.platform, c.type],
    );
  }
  console.log("[SEED] Source connectors ensured");

  // 5. Watchlists — replace default with realistic ones
  const adminUserId = (await query(`SELECT user_id FROM user_account WHERE username = 'admin' LIMIT 1`)).rows[0]?.user_id || demoUserId;
  // Remove old default watchlist
  await query(`DELETE FROM watchlist WHERE name = 'Default Monitoring'`);
  for (const w of WATCHLISTS) {
    await query(
      `INSERT INTO watchlist (name, description, keywords, platforms, is_active, created_by)
       SELECT $1::varchar, $2::text, $3::jsonb, $4::jsonb, true, $5::uuid
       WHERE NOT EXISTS (SELECT 1 FROM watchlist WHERE name = $1::varchar)`,
      [w.name, w.description, JSON.stringify(w.keywords), JSON.stringify(w.platforms), adminUserId],
    );
  }
  console.log(`[SEED] ${WATCHLISTS.length} watchlists seeded`);

  // 6. Taxonomy categories
  for (const cat of CATEGORIES) {
    await query(
      `INSERT INTO taxonomy_category (category_id, name, description)
       SELECT gen_random_uuid(), $1::varchar, $2::text
       WHERE NOT EXISTS (SELECT 1 FROM taxonomy_category WHERE name = $1::varchar)`,
      [cat.name, cat.description],
    );
  }
  console.log(`[SEED] ${CATEGORIES.length} taxonomy categories seeded`);

  // 7. Fix invalid workflow states
  await fixInvalidStates();

  // 8. Clean up all existing cases, then seed fresh
  await cleanupAllCases();
  await seedDemoCases(tgcsbUnitId);

  // 9. Backfill case assignments
  await backfillCaseAssignments(tgcsbUnitId);

  // 10. Distribute data across divisions
  await distributeDataAcrossDivisions(divisionUnitIds);

  // 11. Seed ~100 content items with classification_result records
  await seedClassifiedContentItems();

  // 11b. Categorize any remaining content items without category_id
  await categorizeContentItems();

  // 12. Fix alert state distribution (conversion rate)
  await distributeAlertStates();

  // 13. Model registry
  await seedModels();

  // 14. Legal rules
  await seedLegalRules();

  // 15. Propagate content categories to alerts, then fix demo case alert categories
  await query(
    `UPDATE sm_alert a SET category_id = ci.category_id
     FROM content_item ci
     WHERE ci.content_id = a.content_id AND a.category_id IS NULL AND ci.category_id IS NOT NULL`
  );
  // Fix demo case alerts by title keywords
  for (const [cat, patterns] of Object.entries({
    DRUGS_TRAFFICKING: ['%narcotic%','%drug%','%ganja%','%MDMA%','%cocaine%','%charas%','%fentanyl%','%heroin%','%narco%'],
    DRUGS_CONSUMPTION: ['%cannabis oil%'],
    EXTORTION: ['%sextortion%','%extortion%'],
    IDENTITY_THEFT: ['%fake document%','%identity%'],
    GAMBLING: ['%gambling%'],
  } as Record<string, string[]>)) {
    await query(
      `UPDATE sm_alert SET category_id = tc.category_id
       FROM taxonomy_category tc
       WHERE tc.name = $1 AND title ILIKE ANY($2::text[])`,
      [cat, patterns],
    );
  }
  console.log("[SEED] Alert categories propagated and fixed");

  // 16. Monitoring profiles
  await seedMonitoringProfiles();

  console.log("[SEED] Social Media API seed complete!");
}

async function cleanupAllCases() {
  const caseCount = await query(`SELECT COUNT(*)::int AS cnt FROM case_record`);
  if (caseCount.rows[0].cnt === 0) {
    console.log("[SEED] No cases to clean up");
    return;
  }

  console.log(`[SEED] Cleaning up ${caseCount.rows[0].cnt} existing cases and related data...`);

  // Delete related data first (FK order)
  await query(`DELETE FROM access_justification WHERE case_id IS NOT NULL`);
  await query(`DELETE FROM platform_preservation_request WHERE case_id IS NOT NULL`);
  await query(`DELETE FROM report_instance WHERE case_id IS NOT NULL`);
  await query(`DELETE FROM evidence_item WHERE case_id IS NOT NULL`);
  await query(`UPDATE content_item SET linked_case_id = NULL WHERE linked_case_id IS NOT NULL`);
  await query(`DELETE FROM case_task WHERE entity_type = 'sm_case'`);
  await query(`DELETE FROM entity_note WHERE entity_type = 'sm_case'`);
  await query(`DELETE FROM audit_log WHERE entity_type = 'sm_case'`);
  await query(`DELETE FROM case_record`);

  console.log("[SEED] All cases and related data cleaned up");
}

async function seedDemoCases(unitId: string | null) {
  if (!unitId) {
    console.log("[SEED] Skipping demo cases — no TGCSB unit found");
    return;
  }

  // Look up officer user_ids
  const officerRows = await query(
    `SELECT user_id, username FROM user_account WHERE username IN ('dsp_srinivas','acp_sudarshan','insp_lakshmi','dg_rao','dig_deepthi','dcp_raghav')`
  );
  const officers: Record<string, string> = {};
  for (const r of officerRows.rows) officers[r.username] = r.user_id;

  // Get a connector_id for seeding content items
  const connResult = await query(`SELECT connector_id FROM source_connector WHERE platform = 'instagram' LIMIT 1`);
  const connectorId = connResult.rows[0]?.connector_id || null;

  // Helper: create a content item + alert if needed, returns alert_id
  async function ensureAlertWithContent(
    platform: string,
    authorHandle: string,
    contentText: string,
    alertTitle: string,
    alertPriority: string,
    daysAgo: number,
  ): Promise<string> {
    const publishedAt = new Date(Date.now() - daysAgo * 86400000).toISOString();

    const ciRes = await query(
      `INSERT INTO content_item (connector_id, platform, platform_post_id, author_handle, author_name,
         content_text, language, threat_score, published_at, ingested_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'en', $7, $8, $8)
       RETURNING content_id`,
      [connectorId, platform, `seed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
       authorHandle, authorHandle, contentText,
       alertPriority === "CRITICAL" ? 92 : alertPriority === "HIGH" ? 78 : 55,
       publishedAt],
    );
    const contentId = ciRes.rows[0].content_id;

    const alertRefRes = await query(
      `SELECT 'TEF-ALR-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(nextval('sm_alert_ref_seq')::text, 6, '0') AS ref`
    );
    const alertRef = alertRefRes.rows[0].ref;
    const alertRes = await query(
      `INSERT INTO sm_alert (alert_type, priority, title, description, content_id, state_id, unit_id, alert_ref, created_at)
       VALUES ('AUTO', $1, $2, $3, $4, 'IN_REVIEW', $5, $6, $7)
       RETURNING alert_id`,
      [alertPriority, alertTitle, contentText.slice(0, 200), contentId, unitId, alertRef, publishedAt],
    );
    return alertRes.rows[0].alert_id;
  }

  async function insertAudit(
    entityId: string, fromState: string, toState: string, transitionId: string,
    actorId: string, remarks: string, daysAgo: number,
  ) {
    const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString();
    await query(
      `INSERT INTO audit_log (entity_type, entity_id, event_type, from_state, to_state, transition_id, actor_type, actor_id, remarks, created_at)
       VALUES ('sm_case', $1, 'STATE_CHANGE', $2, $3, $4, 'OFFICER', $5, $6, $7)`,
      [entityId, fromState, toState, transitionId, actorId, remarks, createdAt],
    );
  }

  async function insertNote(entityId: string, text: string, actorId: string, daysAgo: number) {
    const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString();
    await query(
      `INSERT INTO entity_note (entity_type, entity_id, note_text, created_by, created_at)
       VALUES ('sm_case', $1, $2, $3, $4)`,
      [entityId, text, actorId, createdAt],
    );
  }

  async function createCase(
    title: string, description: string, stateId: string, priority: string,
    assignedTo: string | null, alertId: string, daysAgo: number,
  ): Promise<string> {
    const caseRefRes = await query(
      `SELECT 'TEF-CASE-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(nextval('sm_case_ref_seq')::text, 6, '0') AS ref`
    );
    const caseRef = caseRefRes.rows[0].ref;
    const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString();
    const createdBy = officers.dg_rao || officers.dig_deepthi;
    const res = await query(
      `INSERT INTO case_record (title, description, state_id, priority, assigned_to, source_alert_id,
         unit_id, case_ref, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
       RETURNING case_id`,
      [title, description, stateId, priority, assignedTo, alertId, unitId, caseRef, createdBy, createdAt],
    );
    return res.rows[0].case_id;
  }

  console.log("[SEED] Creating demo cases...");

  // ── Case 1: Drug trafficking — UNDER_INVESTIGATION ──
  const alert1 = await ensureAlertWithContent(
    "instagram", "@darknet_dealer_hyd",
    "DM for premium stuff 🍃💊 Cyberabad delivery guaranteed. Signal link in bio. No cops no trace.",
    "Suspected narcotics promotion — Instagram Cyberabad",
    "CRITICAL", 14,
  );
  const case1 = await createCase(
    "Drug trafficking network via Instagram — Cyberabad",
    "Multiple Instagram accounts promoting narcotics sales in Cyberabad commissionerate area. Accounts use coded emoji (🍃=marijuana, 💊=MDMA, ❄️=cocaine) and redirect to Signal/Telegram for transactions. Network appears to span Gachibowli, Madhapur, and Kondapur areas.",
    "UNDER_INVESTIGATION", "CRITICAL", officers.dsp_srinivas, alert1, 12,
  );
  await insertAudit(case1, "OPEN", "ASSIGNED", "ASSIGN", officers.dig_deepthi, "Assigned to DSP Srinivasa Rao for immediate investigation", 11);
  await insertAudit(case1, "ASSIGNED", "UNDER_INVESTIGATION", "START_INVEST", officers.dsp_srinivas, "Investigation commenced, monitoring suspect accounts", 10);
  await insertNote(case1, "Identified 4 linked accounts sharing same content pattern. Phone numbers traced to prepaid SIMs purchased in Secunderabad.", officers.dsp_srinivas, 9);
  await insertNote(case1, "Coordination with NCB Hyderabad zonal unit initiated for parallel physical surveillance.", officers.dig_deepthi, 7);

  // ── Case 2: Hate speech — AWAITING_REVIEW ──
  const alert2 = await ensureAlertWithContent(
    "twitter", "@communal_troll_hyd",
    "These people are destroying our culture! Time to teach them a lesson. Share and make viral! #HyderabadRiots",
    "Communal incitement campaign detected — Twitter",
    "HIGH", 10,
  );
  const case2 = await createCase(
    "Communal hate speech campaign on Twitter — Hyderabad",
    "Coordinated campaign of communal hate speech detected across 12+ Twitter accounts targeting religious communities in Old City Hyderabad. Content includes inflammatory images, calls for violence, and targeted harassment. Peak activity during evening hours suggests organized bot-assisted amplification.",
    "AWAITING_REVIEW", "HIGH", officers.acp_sudarshan, alert2, 8,
  );
  await insertAudit(case2, "OPEN", "ASSIGNED", "ASSIGN", officers.dig_deepthi, "High-priority assignment — potential communal tension", 7);
  await insertAudit(case2, "ASSIGNED", "UNDER_INVESTIGATION", "START_INVEST", officers.acp_sudarshan, "Investigation initiated with social media cell team", 6);
  await insertAudit(case2, "UNDER_INVESTIGATION", "AWAITING_REVIEW", "SUBMIT_REVIEW", officers.acp_sudarshan, "Investigation complete, submitted for supervisory review. 12 accounts identified, FIR details prepared.", 3);
  await insertNote(case2, "Bot analysis reveals 8 of 12 accounts created within 48 hours of each other. Common IP range traced to VPN exit node.", officers.acp_sudarshan, 5);

  // ── Case 3: Online fraud — ASSIGNED ──
  const alert3 = await ensureAlertWithContent(
    "telegram", "@quickloan_india",
    "Instant loan approval! No documents needed! Download our app: [malicious link]. 100% guaranteed approval in 5 minutes!",
    "Fake loan app syndicate — Telegram channels",
    "HIGH", 6,
  );
  const case3 = await createCase(
    "Online fraud syndicate — fake loan apps on Telegram",
    "Organized network promoting fraudulent loan applications via Telegram channels and groups. Apps harvest personal data (Aadhaar, PAN, contacts) and extort victims. Multiple complaints received from Hyderabad, Warangal, and Karimnagar districts. Estimated 500+ victims across Telangana.",
    "ASSIGNED", "HIGH", officers.insp_lakshmi, alert3, 5,
  );
  await insertAudit(case3, "OPEN", "ASSIGNED", "ASSIGN", officers.dcp_raghav, "Assigned to Inspector Lakshmi Prasad for preliminary analysis", 4);
  await insertNote(case3, "Initial scan reveals 3 Telegram channels with combined 15,000+ subscribers. App APK samples collected for forensic analysis.", officers.insp_lakshmi, 3);

  // ── Case 4: CSAM — UNDER_INVESTIGATION ──
  const alert4 = await ensureAlertWithContent(
    "whatsapp", "group:encrypted_share_hyd",
    "[Content flagged by automated CSAM detection system — hash match confirmed]",
    "CSAM distribution via encrypted groups — CRITICAL",
    "CRITICAL", 12,
  );
  const case4 = await createCase(
    "CSAM distribution via encrypted WhatsApp groups",
    "Automated CSAM detection flagged hash matches in forwarded media across multiple WhatsApp groups. NCMEC tipline report #TL-2026-XXXXX corroborates findings. Immediate coordination with WhatsApp Trust & Safety team initiated. Group admin phone numbers traced to Telangana SIMs.",
    "UNDER_INVESTIGATION", "CRITICAL", officers.dsp_srinivas, alert4, 10,
  );
  await insertAudit(case4, "OPEN", "ASSIGNED", "ASSIGN", officers.dg_rao, "CRITICAL — Assigned to DSP for immediate action per POCSO protocols", 10);
  await insertAudit(case4, "ASSIGNED", "UNDER_INVESTIGATION", "START_INVEST", officers.dsp_srinivas, "Investigation commenced. Platform preservation request sent to WhatsApp. NCMEC coordination active.", 9);
  await insertNote(case4, "WhatsApp preservation request acknowledged. Group metadata and member list expected within 72 hours.", officers.dsp_srinivas, 8);
  await insertNote(case4, "NCMEC report cross-referenced with INTERPOL ICSE database — 3 known series identified.", officers.dsp_srinivas, 6);

  // ── Case 5: Cyberbullying — OPEN (unassigned) ──
  const alert5 = await ensureAlertWithContent(
    "facebook", "@bully_account_fb",
    "Everyone look at this loser! Share this everywhere and make their life hell! Tag all your friends! #exposed",
    "Cyberbullying and defamation campaign — Facebook",
    "MEDIUM", 3,
  );
  const case5 = await createCase(
    "Cyber bullying and defamation campaign on Facebook",
    "Sustained cyberbullying campaign targeting an individual across Facebook. Defamatory posts, morphed images, and organized mass-reporting of victim's account. Victim is a college student from Hyderabad who filed complaint at Cyber Crime PS. Multiple accounts involved.",
    "OPEN", "MEDIUM", null, alert5, 2,
  );
  await insertNote(case5, "Complaint registered by victim at Cyber Crime PS. Screenshots and URLs preserved as initial evidence.", officers.insp_lakshmi, 1);

  // ── Case 6: Narcotics (closed) — CLOSED ──
  const alert6 = await ensureAlertWithContent(
    "instagram", "@emoji_dealer_closed",
    "🍃🔥 Premium quality, Hyd only. DM for menu. Regulars know the drill. 💯🤫",
    "Narcotics sale via coded emoji posts — Instagram",
    "HIGH", 20,
  );
  const case6 = await createCase(
    "Narcotics sale via coded emoji posts — Instagram",
    "Investigation into Instagram-based narcotics distribution using coded emoji language. Suspect accounts identified and traced. Physical surveillance led to seizure of contraband and arrest of 2 suspects in Jubilee Hills. Case closed after successful prosecution handoff to local PS.",
    "CLOSED", "HIGH", officers.acp_sudarshan, alert6, 14,
  );
  await insertAudit(case6, "OPEN", "ASSIGNED", "ASSIGN", officers.dig_deepthi, "Assigned to ACP Sudarshan", 13);
  await insertAudit(case6, "ASSIGNED", "UNDER_INVESTIGATION", "START_INVEST", officers.acp_sudarshan, "Investigation started — monitoring coded emoji patterns", 12);
  await insertAudit(case6, "UNDER_INVESTIGATION", "AWAITING_REVIEW", "SUBMIT_REVIEW", officers.acp_sudarshan, "Investigation complete. 2 suspects arrested, 500g marijuana seized. Submitted for closure.", 5);
  await insertAudit(case6, "AWAITING_REVIEW", "CLOSED", "APPROVE_CLOSE", officers.dig_deepthi, "Approved for closure. Case handed to Jubilee Hills PS for prosecution. FIR No. 234/2026.", 3);
  await query(
    `UPDATE case_record SET closed_at = NOW() - interval '3 days', closure_reason = $1 WHERE case_id = $2`,
    ["Case resolved. 2 arrests made, contraband seized. FIR No. 234/2026 registered at Jubilee Hills PS for prosecution.", case6],
  );
  await insertNote(case6, "Physical surveillance confirmed suspect residence in Jubilee Hills. Coordinated with local SHO for raid.", officers.acp_sudarshan, 8);
  await insertNote(case6, "Seizure memo prepared. Chain of custody documented. Digital evidence preserved per ISO 27037.", officers.acp_sudarshan, 5);

  // ── Case 7: MDMA distribution — Warangal ──
  const alert7 = await ensureAlertWithContent(
    "telegram", "@party_supplies_wgl",
    "Weekend specials 💊💊 Warangal delivery. Minimum order 10 pcs. DM for Signal number. No random adds.",
    "MDMA distribution network — Telegram Warangal",
    "CRITICAL", 11,
  );
  const case7 = await createCase(
    "MDMA distribution network via Telegram — Warangal",
    "Organized MDMA distribution ring operating via Telegram channels targeting college students in Warangal. Suspects use coded language and emoji to advertise party drugs. Payment via cryptocurrency. Multiple NIT-Warangal and Kakatiya University students identified as buyers.",
    "UNDER_INVESTIGATION", "CRITICAL", officers.dsp_srinivas, alert7, 9,
  );
  await insertAudit(case7, "OPEN", "ASSIGNED", "ASSIGN", officers.dig_deepthi, "Assigned to DSP — NDPS Act violation", 8);
  await insertAudit(case7, "ASSIGNED", "UNDER_INVESTIGATION", "START_INVEST", officers.dsp_srinivas, "Undercover account created to infiltrate distribution channel", 7);
  await insertNote(case7, "Channel has 2,300 members. Admin uses rotating phone numbers. Payment in USDT via P2P exchange.", officers.dsp_srinivas, 6);

  // ── Case 8: Ganja supply chain — Khammam ──
  const alert8 = await ensureAlertWithContent(
    "whatsapp", "group:khammam_green_delivery",
    "Fresh harvest from AOB border. 1kg packs ready. Transport arranged via private buses. Contact for bulk rates.",
    "Ganja supply chain detected — WhatsApp Khammam",
    "HIGH", 8,
  );
  const case8 = await createCase(
    "Ganja supply chain coordinated through WhatsApp — Khammam",
    "WhatsApp group coordinating ganja supply from Andhra-Odisha border (AOB) region to Hyderabad via Khammam district. Group members discuss harvesting, packaging, and transport logistics. Estimated 50+ kg monthly supply chain. Linked to known AOB trafficking routes.",
    "ASSIGNED", "HIGH", officers.insp_lakshmi, alert8, 6,
  );
  await insertAudit(case8, "OPEN", "ASSIGNED", "ASSIGN", officers.dcp_raghav, "Assigned for investigation — NDPS coordination with Khammam district police", 5);
  await insertNote(case8, "Group has 47 members. Admin number traced to Bhadrachalam. Bus route Bhadrachalam-Khammam-Hyderabad identified.", officers.insp_lakshmi, 4);

  // ── Case 9: Dark web narcotics — Hyderabad ──
  const alert9 = await ensureAlertWithContent(
    "telegram", "@darkweb_hyd_vendor",
    "Premium quality products. Tor links updated weekly. Escrow payments only. PGP verified vendor since 2024.",
    "Dark web narcotics marketplace — Hyderabad vendor",
    "CRITICAL", 15,
  );
  const case9 = await createCase(
    "Dark web narcotics marketplace — Hyderabad hub",
    "Dark web vendor based in Hyderabad selling narcotics (cocaine, MDMA, LSD) via Tor marketplace. Vendor uses Telegram for customer communication and crypto wallets for payments. OSINT analysis suggests physical base in Begumpet area. Coordination with NCB and Interpol initiated.",
    "UNDER_INVESTIGATION", "CRITICAL", officers.dsp_srinivas, alert9, 13,
  );
  await insertAudit(case9, "OPEN", "ASSIGNED", "ASSIGN", officers.dg_rao, "CRITICAL — Dark web operation, NCB coordination required", 12);
  await insertAudit(case9, "ASSIGNED", "UNDER_INVESTIGATION", "START_INVEST", officers.dsp_srinivas, "Investigation initiated. Crypto wallet analysis and Tor traffic monitoring underway.", 11);
  await insertNote(case9, "Bitcoin wallet analysis reveals ₹2.3 crore in transactions over 6 months. 3 Hyderabad delivery addresses identified.", officers.dsp_srinivas, 10);
  await insertNote(case9, "Coordination with NCB Hyderabad zonal office. Joint operation planned.", officers.dig_deepthi, 8);

  // ── Case 10: Cocaine trafficking — Jubilee Hills ──
  const alert10 = await ensureAlertWithContent(
    "instagram", "@luxlife_hyd_party",
    "Premium party favors for the elite ❄️✨ Jubilee Hills home delivery. DM with referral code only.",
    "Cocaine distribution — Instagram Jubilee Hills",
    "CRITICAL", 9,
  );
  const case10 = await createCase(
    "Cocaine trafficking via Instagram stories — Jubilee Hills",
    "High-end cocaine distribution targeting affluent clients in Jubilee Hills and Banjara Hills. Suspects use Instagram stories with coded emoji (❄️=cocaine) and operate via referral-only system. Multiple Instagram accounts linked to same phone cluster. Estimated ₹50 lakh monthly turnover.",
    "AWAITING_REVIEW", "CRITICAL", officers.acp_sudarshan, alert10, 7,
  );
  await insertAudit(case10, "OPEN", "ASSIGNED", "ASSIGN", officers.dig_deepthi, "Assigned to ACP — high-profile area, discretion required", 6);
  await insertAudit(case10, "ASSIGNED", "UNDER_INVESTIGATION", "START_INVEST", officers.acp_sudarshan, "Surveillance initiated on suspect accounts and delivery patterns", 5);
  await insertAudit(case10, "UNDER_INVESTIGATION", "AWAITING_REVIEW", "SUBMIT_REVIEW", officers.acp_sudarshan, "Investigation complete. 3 suspects identified. Ready for raid authorization.", 2);
  await insertNote(case10, "Delivery boy network identified — 4 riders using Rapido bike taxi as cover. Payment via GPay to multiple accounts.", officers.acp_sudarshan, 4);

  // ── Case 11: Synthetic drug promotion — Karimnagar ──
  const alert11 = await ensureAlertWithContent(
    "youtube", "@chem_experiments_kr",
    "New compound review — legal alternative, same effects! Check description for vendor link. Use code KNR10 for discount.",
    "Synthetic drug promotion — YouTube Karimnagar",
    "HIGH", 5,
  );
  const case11 = await createCase(
    "Synthetic drug promotion via coded YouTube videos — Karimnagar",
    "YouTube channel promoting synthetic drugs (mephedrone, synthetic cannabinoids) disguised as 'chemistry experiments'. Description links to Telegram channel for purchases. Channel has 8,000+ subscribers, majority from Telangana based on comment analysis. Videos use coded language to evade content moderation.",
    "OPEN", "HIGH", null, alert11, 4,
  );
  await insertNote(case11, "YouTube channel reported via LEA portal. Preservation request sent. 23 videos identified with drug promotion content.", officers.si_padma, 3);

  // ── Case 12: Drug mule recruitment — Nizamabad ──
  const alert12 = await ensureAlertWithContent(
    "facebook", "@easy_money_nzb",
    "Earn ₹50,000 per trip! No questions asked. Just carry a package from Nizamabad to Hyderabad. DM for details.",
    "Drug mule recruitment — Facebook Nizamabad",
    "HIGH", 7,
  );
  const case12 = await createCase(
    "Drug mule recruitment via Facebook — Nizamabad",
    "Facebook posts recruiting drug mules for transporting contraband from Nizamabad to Hyderabad. Posts target unemployed youth with promises of quick money. Multiple accounts posting identical content. Phone numbers traced to prepaid SIMs. Linked to known Nizamabad-Hyderabad trafficking route.",
    "ASSIGNED", "HIGH", officers.insp_lakshmi, alert12, 5,
  );
  await insertAudit(case12, "OPEN", "ASSIGNED", "ASSIGN", officers.dcp_raghav, "Assigned for investigation — potential NDPS trafficking network", 4);
  await insertNote(case12, "6 Facebook profiles identified posting identical recruitment ads. Profile photos appear AI-generated.", officers.insp_lakshmi, 3);

  // ── Case 13: Prescription drug black market — Secunderabad ──
  const alert13 = await ensureAlertWithContent(
    "telegram", "@pharma_deals_sec",
    "Tramadol, Alprazolam, Codeine — no prescription needed. COD available Secunderabad area. Bulk discounts.",
    "Prescription drug black market — Telegram Secunderabad",
    "MEDIUM", 6,
  );
  const case13 = await createCase(
    "Prescription drug black market on Telegram — Secunderabad",
    "Telegram channel selling controlled prescription drugs (Tramadol, Alprazolam, Codeine) without prescriptions. COD delivery in Secunderabad area. Channel has 1,200 members. Suspected link to a pharmacy in Kachiguda area supplying drugs without valid prescriptions.",
    "OPEN", "MEDIUM", null, alert13, 5,
  );
  await insertNote(case13, "Channel admin uses rotating Telegram accounts. 3 pharmacy names mentioned in customer reviews within the channel.", officers.si_padma, 4);

  // ── Case 14: Crypto-based drug payments — multi-district ──
  const alert14 = await ensureAlertWithContent(
    "telegram", "@crypto_deals_ts",
    "BTC/USDT payments only. Multi-city delivery network. Escrow service available. Trusted since 2023.",
    "Cryptocurrency drug payment network — multi-district",
    "CRITICAL", 16,
  );
  const case14 = await createCase(
    "Crypto-based drug payment network — multi-district operation",
    "Sophisticated drug distribution network using cryptocurrency payments operating across Hyderabad, Warangal, and Karimnagar. Uses Telegram for orders, Bitcoin/USDT for payments, and a network of delivery agents. Blockchain analysis reveals ₹5 crore in transactions. International vendor connections suspected.",
    "UNDER_INVESTIGATION", "CRITICAL", officers.dsp_srinivas, alert14, 14,
  );
  await insertAudit(case14, "OPEN", "ASSIGNED", "ASSIGN", officers.dg_rao, "Multi-district operation — top priority, NCB coordination", 13);
  await insertAudit(case14, "ASSIGNED", "UNDER_INVESTIGATION", "START_INVEST", officers.dsp_srinivas, "Investigation commenced. Crypto forensics firm engaged for wallet analysis.", 12);
  await insertNote(case14, "Blockchain analysis identifies 3 primary wallets with ₹5.2 crore cumulative volume. Mixer service used for obfuscation.", officers.dsp_srinivas, 11);
  await insertNote(case14, "P2P exchange KYC records subpoenaed — 2 Hyderabad residents identified as frequent converters.", officers.dsp_srinivas, 8);

  // ── Case 15: UPI fraud ring — Cyberabad ──
  const alert15 = await ensureAlertWithContent(
    "twitter", "@alert_upi_fraud",
    "Got a call from 'bank executive' asking to update KYC via link. Lost ₹2.5 lakh from my account! @CyberCrimeTG please help!",
    "UPI fraud complaints surge — Cyberabad",
    "HIGH", 10,
  );
  const case15 = await createCase(
    "UPI fraud ring targeting senior citizens — Cyberabad",
    "Organized UPI fraud ring targeting senior citizens in Cyberabad commissionerate. Modus operandi: impersonate bank executives, send fake KYC update links, harvest UPI PINs. 47 complaints received in 30 days. Common money mule accounts identified. Estimated ₹1.2 crore defrauded.",
    "UNDER_INVESTIGATION", "HIGH", officers.acp_sudarshan, alert15, 8,
  );
  await insertAudit(case15, "OPEN", "ASSIGNED", "ASSIGN", officers.dcp_raghav, "Multiple complaints — consolidated into single investigation", 7);
  await insertAudit(case15, "ASSIGNED", "UNDER_INVESTIGATION", "START_INVEST", officers.acp_sudarshan, "Investigation initiated. Bank account freeze requests sent.", 6);
  await insertNote(case15, "Common call center number identified — traced to Jharkhand. Coordination with Jharkhand Cyber PS initiated.", officers.acp_sudarshan, 5);

  // ── Case 16: Fake job portal phishing — Rachakonda ──
  const alert16 = await ensureAlertWithContent(
    "instagram", "@dream_jobs_india",
    "🔥 IT jobs Hyderabad! ₹8-15 LPA! No experience needed! Pay ₹5000 registration fee. Limited spots! Apply now!",
    "Fake job portal phishing — Instagram",
    "HIGH", 7,
  );
  const case16 = await createCase(
    "Fake job portal phishing scam — Rachakonda",
    "Fake job portal promoted via Instagram and Facebook targeting job seekers in Rachakonda commissionerate. Victims pay ₹5,000-15,000 'registration fees' for non-existent IT jobs. Linked to a network of fake company websites. 23 complaints in past 2 weeks. UPI payment trail leads to mule accounts.",
    "ASSIGNED", "HIGH", officers.insp_lakshmi, alert16, 5,
  );
  await insertAudit(case16, "OPEN", "ASSIGNED", "ASSIGN", officers.dcp_raghav, "Assigned — job fraud targeting unemployed youth, high complaint volume", 4);
  await insertNote(case16, "3 fake company domains registered via GoDaddy — registrant info matches previous fraud cases.", officers.insp_lakshmi, 3);

  // ── Case 17: Cryptocurrency Ponzi scheme ──
  const alert17 = await ensureAlertWithContent(
    "youtube", "@crypto_guru_hyd",
    "10X guaranteed returns in 30 days! Join our exclusive crypto investment club. ₹10,000 minimum. 500+ happy members!",
    "Crypto Ponzi scheme promotion — YouTube",
    "HIGH", 12,
  );
  const case17 = await createCase(
    "Cryptocurrency investment fraud — Ponzi scheme promotion",
    "YouTube and Telegram-based cryptocurrency Ponzi scheme targeting Hyderabad residents. Promises 10X returns in 30 days. Operator conducts live sessions showing fake trading dashboards. Estimated ₹3 crore collected from 800+ victims. Company not registered with SEBI or RBI.",
    "AWAITING_REVIEW", "HIGH", officers.acp_sudarshan, alert17, 10,
  );
  await insertAudit(case17, "OPEN", "ASSIGNED", "ASSIGN", officers.dig_deepthi, "Financial fraud — SEBI notification required", 9);
  await insertAudit(case17, "ASSIGNED", "UNDER_INVESTIGATION", "START_INVEST", officers.acp_sudarshan, "Investigation started. Company registration check initiated.", 8);
  await insertAudit(case17, "UNDER_INVESTIGATION", "AWAITING_REVIEW", "SUBMIT_REVIEW", officers.acp_sudarshan, "Evidence compiled. Operator identified as Hyderabad resident. Ready for action.", 4);
  await insertNote(case17, "Operator identified: runs operations from Hitech City co-working space. SEBI complaint filed. Bank account details obtained.", officers.acp_sudarshan, 6);

  // ── Case 18: Sextortion ring — Hyderabad ──
  const alert18 = await ensureAlertWithContent(
    "instagram", "@model_connect_hyd",
    "[Victim report] Received threatening messages demanding ₹5 lakh or intimate photos will be shared with contacts.",
    "Sextortion ring — Instagram DMs Hyderabad",
    "CRITICAL", 8,
  );
  const case18 = await createCase(
    "Sextortion ring operating via Instagram DMs — Hyderabad",
    "Organized sextortion ring targeting professionals in Hyderabad via Instagram. Modus operandi: fake female profiles initiate video calls, record compromising screenshots, demand payment (₹2-10 lakh). 15 victims identified, several from IT sector. Money trail leads to accounts in Rajasthan. Cross-state coordination required.",
    "UNDER_INVESTIGATION", "CRITICAL", officers.dsp_srinivas, alert18, 6,
  );
  await insertAudit(case18, "OPEN", "ASSIGNED", "ASSIGN", officers.dig_deepthi, "CRITICAL — Multiple victim reports, organized crime pattern", 5);
  await insertAudit(case18, "ASSIGNED", "UNDER_INVESTIGATION", "START_INVEST", officers.dsp_srinivas, "Investigation commenced. Fake profiles analyzed, payment trail mapping initiated.", 4);
  await insertNote(case18, "15 fake Instagram profiles linked to same device fingerprint. Money mule accounts in Rajasthan and UP.", officers.dsp_srinivas, 3);

  // ── Case 19: Online gambling — Telegram ──
  const alert19 = await ensureAlertWithContent(
    "telegram", "@satta_king_ts",
    "Today's matka results! Join premium group for 100% winning numbers. ₹500/month VIP membership. Weekly payouts guaranteed!",
    "Illegal online gambling platform — Telegram",
    "MEDIUM", 9,
  );
  const case19 = await createCase(
    "Illegal online gambling platform promotion — Telegram",
    "Telegram-based illegal gambling operation (Satta Matka, cricket betting) targeting Telangana users. Premium groups charge ₹500-5000/month. Multiple payment gateways used. Operator also promotes betting apps not licensed by any gaming authority. Estimated monthly turnover ₹80 lakh.",
    "ASSIGNED", "MEDIUM", officers.insp_lakshmi, alert19, 7,
  );
  await insertAudit(case19, "OPEN", "ASSIGNED", "ASSIGN", officers.dcp_raghav, "Assigned — gambling promotion, Public Gambling Act applicable", 6);
  await insertNote(case19, "3 Telegram groups identified with combined 12,000 members. Admin operates from Telangana based on payment account analysis.", officers.insp_lakshmi, 5);

  // ── Case 20: Identity theft ring ──
  const alert20 = await ensureAlertWithContent(
    "telegram", "@docs_service_hyd",
    "Aadhaar, PAN, driving license — any document ready in 24 hours. WhatsApp for pricing. Bulk orders welcome.",
    "Fake document service — Telegram",
    "HIGH", 11,
  );
  const case20 = await createCase(
    "Identity theft ring — fake Aadhaar and PAN services on Telegram",
    "Telegram channel offering forged identity documents (Aadhaar, PAN, driving license, voter ID). Channel has 3,500 members. Documents reportedly used for opening bank accounts, SIM activation, and creating fake identities. Potential link to financial fraud and money laundering networks.",
    "UNDER_INVESTIGATION", "HIGH", officers.acp_sudarshan, alert20, 9,
  );
  await insertAudit(case20, "OPEN", "ASSIGNED", "ASSIGN", officers.dig_deepthi, "Identity fraud — potential IT Act and BNS violations", 8);
  await insertAudit(case20, "ASSIGNED", "UNDER_INVESTIGATION", "START_INVEST", officers.acp_sudarshan, "Investigation started. Sample documents ordered for analysis.", 7);
  await insertNote(case20, "Forged documents are high quality — suspect has access to official templates. UIDAI coordination initiated.", officers.acp_sudarshan, 6);

  // ── Case 21: Loan app extortion — Chinese-operated ──
  const alert21 = await ensureAlertWithContent(
    "twitter", "@loanapp_victim_hyd",
    "These Chinese loan apps are destroying lives! They call all your contacts, morph photos, and threaten! 3 people have committed suicide! @TGPolice",
    "Chinese loan app extortion — Twitter complaints",
    "CRITICAL", 7,
  );
  const case21 = await createCase(
    "Loan app extortion — Chinese-operated predatory lending apps",
    "Multiple Chinese-operated predatory loan apps extorting borrowers across Telangana. Apps harvest contact lists, photos; then morph intimate images and threaten to share with contacts. 3 suicide cases linked. 200+ complaints. Server infrastructure traced to Singapore and Hong Kong. RBI blacklisted apps still operating under new names.",
    "UNDER_INVESTIGATION", "CRITICAL", officers.dsp_srinivas, alert21, 5,
  );
  await insertAudit(case21, "OPEN", "ASSIGNED", "ASSIGN", officers.dg_rao, "CRITICAL — Suicide cases linked, immediate priority", 4);
  await insertAudit(case21, "ASSIGNED", "UNDER_INVESTIGATION", "START_INVEST", officers.dsp_srinivas, "Investigation commenced. Google Play Store takedown requests sent. Money trail analysis initiated.", 3);
  await insertNote(case21, "12 app variants identified on Google Play. APK analysis reveals data exfiltration to Hong Kong servers. CBI referral prepared.", officers.dsp_srinivas, 2);

  // ── Case 22: Drug delivery via food apps — coded orders ──
  const alert22 = await ensureAlertWithContent(
    "instagram", "@special_menu_hyd",
    "Order 'Special Brownie Combo' for the real deal 🍫🍃 Available on all delivery apps. Use code GREEN420.",
    "Drug delivery via food apps — Instagram coded ads",
    "HIGH", 6,
  );
  const case22 = await createCase(
    "Drug delivery via food delivery apps — coded orders",
    "Suspects using food delivery platforms (Swiggy, Zomato) to deliver marijuana-laced edibles under coded menu items like 'Special Brownie Combo'. Instagram used for promotion with coded hashtags. 3 cloud kitchen locations identified in Madhapur, Gachibowli, and Kondapur. Platform cooperation requested.",
    "ASSIGNED", "HIGH", officers.acp_sudarshan, alert22, 4,
  );
  await insertAudit(case22, "OPEN", "ASSIGNED", "ASSIGN", officers.dig_deepthi, "Novel MO — food delivery platform misuse for drug distribution", 3);
  await insertNote(case22, "Cloud kitchen addresses verified. Platform cooperation team contacted. Order history subpoena prepared.", officers.acp_sudarshan, 2);

  // ── Case 23: Cannabis oil extraction tutorials — YouTube ──
  const alert23 = await ensureAlertWithContent(
    "youtube", "@herbalist_ts",
    "How to extract cannabis oil at home — step by step guide. Pure organic process. Legal disclaimer: for educational purposes only.",
    "Cannabis oil extraction tutorial — YouTube",
    "MEDIUM", 8,
  );
  const case23 = await createCase(
    "Cannabis oil extraction tutorial channel — YouTube",
    "YouTube channel with 15,000 subscribers posting detailed cannabis oil extraction tutorials. Comment section used as marketplace — users exchange contact details for buying/selling. Channel operator based in Telangana (identified via Patreon account linked to Aadhaar-verified bank account). NDPS Act applicable for promotion of drug manufacturing.",
    "OPEN", "MEDIUM", null, alert23, 7,
  );
  await insertNote(case23, "Channel monetized via Patreon. Patron name matches Aadhaar-linked bank account in Medchal district.", officers.si_padma, 6);

  // ── Case 24: Cross-border drug trafficking — encrypted channels ──
  const alert24 = await ensureAlertWithContent(
    "telegram", "@international_pharma_route",
    "Direct sourcing from Afghanistan-Pakistan route. Bulk orders only. Minimum 5kg. Escrow via hawala. Serious buyers only.",
    "Cross-border drug trafficking — Telegram",
    "CRITICAL", 18,
  );
  const case24 = await createCase(
    "Cross-border drug trafficking coordination — encrypted channels",
    "International drug trafficking operation using encrypted Telegram channels to coordinate heroin and opium supply from Afghanistan-Pakistan route to Indian distribution points including Hyderabad. Hawala transactions for payments. Multiple Telangana-based intermediaries identified. NCB, NIA, and BSF coordination active.",
    "AWAITING_REVIEW", "CRITICAL", officers.dsp_srinivas, alert24, 16,
  );
  await insertAudit(case24, "OPEN", "ASSIGNED", "ASSIGN", officers.dg_rao, "CRITICAL — International trafficking, NIA coordination initiated", 15);
  await insertAudit(case24, "ASSIGNED", "UNDER_INVESTIGATION", "START_INVEST", officers.dsp_srinivas, "Investigation commenced with NCB joint team. Border surveillance enhanced.", 14);
  await insertAudit(case24, "UNDER_INVESTIGATION", "AWAITING_REVIEW", "SUBMIT_REVIEW", officers.dsp_srinivas, "Investigation findings compiled. 5 intermediaries identified. NIA takeover recommended.", 5);
  await insertNote(case24, "Hawala network mapped — 3 operators in Hyderabad, 2 in Mumbai. ₹15 crore estimated annual volume.", officers.dsp_srinivas, 10);
  await insertNote(case24, "NIA formally notified. Preliminary assessment supports NIA jurisdiction under NDPS Act.", officers.dg_rao, 4);

  // ── Case 25: Fake KYC phishing — banking fraud ──
  const alert25 = await ensureAlertWithContent(
    "whatsapp", "broadcast:kyc_update_scam",
    "Dear Customer, your bank account will be blocked in 24 hours. Update KYC immediately: [phishing link]. — Your Bank Team",
    "Mass KYC phishing campaign — WhatsApp broadcast",
    "HIGH", 4,
  );
  const case25 = await createCase(
    "Fake KYC update phishing campaign — banking fraud",
    "Mass phishing campaign via WhatsApp broadcast lists impersonating SBI, HDFC, and ICICI banks. Messages contain links to clone banking websites that harvest credentials. Campaign targets Telangana phone numbers. 35 complaints in 1 week, estimated ₹45 lakh stolen. Phishing domains hosted on bulletproof hosting.",
    "OPEN", "HIGH", null, alert25, 3,
  );
  await insertNote(case25, "8 phishing domains identified. CERT-In notified for takedown. Domain registrar contacted.", officers.si_padma, 2);

  // ── Case 26: Charas trafficking from Himachal via social media ──
  const alert26 = await ensureAlertWithContent(
    "instagram", "@himalayan_cream_direct",
    "Direct from Malana 🏔️ Cream of the crop. Postal delivery all India. DM for menu card and rates.",
    "Charas trafficking — Instagram inter-state supply",
    "HIGH", 10,
  );
  const case26 = await createCase(
    "Charas trafficking from Himachal via Instagram — Hyderabad recipients",
    "Instagram accounts advertising Malana Cream (charas) from Himachal Pradesh with postal delivery to Hyderabad. 4 Hyderabad-based recipient addresses identified from intercepted parcels. India Post and courier company cooperation requested. HP Police coordination for source-end action.",
    "UNDER_INVESTIGATION", "HIGH", officers.acp_sudarshan, alert26, 8,
  );
  await insertAudit(case26, "OPEN", "ASSIGNED", "ASSIGN", officers.dig_deepthi, "Inter-state trafficking — HP Police coordination needed", 7);
  await insertAudit(case26, "ASSIGNED", "UNDER_INVESTIGATION", "START_INVEST", officers.acp_sudarshan, "Investigation initiated. India Post suspicious parcels flagged.", 6);
  await insertNote(case26, "2 parcels intercepted at Hyderabad GPO containing 200g charas each. Sender address in Kullu district. HP Cyber PS notified.", officers.acp_sudarshan, 5);

  console.log("[SEED] Demo cases created successfully (26 cases with workflow history)");
}

async function fixInvalidStates() {
  const caseFixed = await query(
    `UPDATE case_record SET state_id = 'UNDER_INVESTIGATION', updated_at = NOW() WHERE state_id = 'INVESTIGATING'`
  );
  if (caseFixed.rowCount && caseFixed.rowCount > 0) {
    console.log(`[SEED] Fixed ${caseFixed.rowCount} cases: INVESTIGATING → UNDER_INVESTIGATION`);
  }

  const alertFixed = await query(
    `UPDATE sm_alert SET state_id = 'IN_REVIEW', updated_at = NOW() WHERE state_id IN ('ESCALATED','ASSIGNED','INVESTIGATING')`
  );
  if (alertFixed.rowCount && alertFixed.rowCount > 0) {
    console.log(`[SEED] Fixed ${alertFixed.rowCount} alerts: invalid states → IN_REVIEW`);
  }

  await query(`UPDATE audit_log SET to_state = 'IN_REVIEW' WHERE entity_type = 'sm_alert' AND to_state IN ('ESCALATED','ASSIGNED','INVESTIGATING')`);
  await query(`UPDATE audit_log SET from_state = 'IN_REVIEW' WHERE entity_type = 'sm_alert' AND from_state IN ('ESCALATED','ASSIGNED','INVESTIGATING')`);
  await query(`UPDATE audit_log SET to_state = 'UNDER_INVESTIGATION' WHERE entity_type = 'sm_case' AND to_state = 'INVESTIGATING'`);
  await query(`UPDATE audit_log SET from_state = 'UNDER_INVESTIGATION' WHERE entity_type = 'sm_case' AND from_state = 'INVESTIGATING'`);

  console.log("[SEED] Invalid workflow states cleaned up");
}

async function backfillCaseAssignments(unitId: string | null) {
  const unassigned = await query(
    `SELECT case_id, created_at, state_id FROM case_record WHERE assigned_to IS NULL ORDER BY created_at`
  );
  if (unassigned.rows.length === 0) {
    console.log("[SEED] No unassigned cases to backfill");
    return;
  }

  // Get available officers from DB (not hardcoded UUIDs)
  const officerResult = await query(
    `SELECT DISTINCT u.user_id, u.full_name, u.designation
     FROM user_account u
     JOIN user_role ur ON ur.user_id = u.user_id
     JOIN role r ON r.role_id = ur.role_id
     WHERE u.is_active = TRUE AND r.role_key IN ('INVESTIGATOR','SUPERVISOR')`
  );
  if (officerResult.rows.length === 0) {
    console.log("[SEED] No officers available for backfill");
    return;
  }

  const officers = officerResult.rows;
  const total = unassigned.rows.length;
  const supervisorResult = await query(
    `SELECT u.user_id FROM user_account u
     JOIN user_role ur ON ur.user_id = u.user_id
     JOIN role r ON r.role_id = ur.role_id
     WHERE u.is_active = TRUE AND r.role_key = 'SUPERVISOR' LIMIT 1`
  );
  const supervisorId = supervisorResult.rows[0]?.user_id || officers[0].user_id;

  // Distribution: 30% OPEN, 25% ASSIGNED, 20% UNDER_INVESTIGATION, 15% AWAITING_REVIEW, 10% CLOSED
  const openEnd = Math.floor(total * 0.30);
  const assignedEnd = openEnd + Math.floor(total * 0.25);
  const investEnd = assignedEnd + Math.floor(total * 0.20);
  const reviewEnd = investEnd + Math.floor(total * 0.15);

  const remarks_pool = [
    "Assigned for investigation per standard operating procedure",
    "Case flagged for priority review",
    "Assigned based on case jurisdiction and specialization",
    "Routine assignment from intake queue",
  ];
  const invest_remarks = [
    "Investigation commenced, digital evidence collection initiated",
    "Preliminary investigation started, monitoring suspect accounts",
    "Investigation underway, platform preservation requests sent",
  ];
  const review_remarks = [
    "Investigation complete, submitted for supervisory review",
    "All evidence collected, case ready for review",
    "Investigation findings compiled, awaiting supervisor decision",
  ];
  const close_remarks = [
    "Case resolved. Evidence insufficient for prosecution, filed for record.",
    "Case resolved. FIR registered at local PS for further action.",
    "Case closed. Subject account deactivated by platform.",
    "Case resolved. Warning issued to the subject, no further action required.",
  ];

  let assigned = 0, investigated = 0, reviewed = 0, closed = 0;

  for (let i = 0; i < total; i++) {
    const c = unassigned.rows[i];
    const officer = officers[i % officers.length];
    const createdAt = new Date(c.created_at);

    if (i < openEnd) continue;

    await query(`UPDATE case_record SET assigned_to = $1, updated_at = NOW() WHERE case_id = $2`, [officer.user_id, c.case_id]);

    if (i < assignedEnd) {
      await query(`UPDATE case_record SET state_id = 'ASSIGNED', due_at = $1 WHERE case_id = $2`,
        [new Date(createdAt.getTime() + 5 * 86400000).toISOString(), c.case_id]);
      await query(
        `INSERT INTO audit_log (entity_type, entity_id, event_type, from_state, to_state, transition_id, actor_type, actor_id, remarks, created_at)
         VALUES ('sm_case', $1, 'STATE_CHANGE', 'OPEN', 'ASSIGNED', 'ASSIGN', 'OFFICER', $2, $3, $4)`,
        [c.case_id, supervisorId, remarks_pool[i % remarks_pool.length], new Date(createdAt.getTime() + 1 * 86400000).toISOString()]
      );
      assigned++;
    } else if (i < investEnd) {
      await query(`UPDATE case_record SET state_id = 'UNDER_INVESTIGATION', due_at = $1 WHERE case_id = $2`,
        [new Date(createdAt.getTime() + 7 * 86400000).toISOString(), c.case_id]);
      await query(
        `INSERT INTO audit_log (entity_type, entity_id, event_type, from_state, to_state, transition_id, actor_type, actor_id, remarks, created_at)
         VALUES ('sm_case', $1, 'STATE_CHANGE', 'OPEN', 'ASSIGNED', 'ASSIGN', 'OFFICER', $2, $3, $4)`,
        [c.case_id, supervisorId, remarks_pool[i % remarks_pool.length], new Date(createdAt.getTime() + 86400000).toISOString()]
      );
      await query(
        `INSERT INTO audit_log (entity_type, entity_id, event_type, from_state, to_state, transition_id, actor_type, actor_id, remarks, created_at)
         VALUES ('sm_case', $1, 'STATE_CHANGE', 'ASSIGNED', 'UNDER_INVESTIGATION', 'START_INVEST', 'OFFICER', $2, $3, $4)`,
        [c.case_id, officer.user_id, invest_remarks[i % invest_remarks.length], new Date(createdAt.getTime() + 2 * 86400000).toISOString()]
      );
      investigated++;
    } else if (i < reviewEnd) {
      await query(`UPDATE case_record SET state_id = 'AWAITING_REVIEW', due_at = $1 WHERE case_id = $2`,
        [new Date(createdAt.getTime() + 3 * 86400000).toISOString(), c.case_id]);
      await query(
        `INSERT INTO audit_log (entity_type, entity_id, event_type, from_state, to_state, transition_id, actor_type, actor_id, remarks, created_at)
         VALUES ('sm_case', $1, 'STATE_CHANGE', 'OPEN', 'ASSIGNED', 'ASSIGN', 'OFFICER', $2, $3, $4)`,
        [c.case_id, supervisorId, remarks_pool[i % remarks_pool.length], new Date(createdAt.getTime() + 86400000).toISOString()]
      );
      await query(
        `INSERT INTO audit_log (entity_type, entity_id, event_type, from_state, to_state, transition_id, actor_type, actor_id, remarks, created_at)
         VALUES ('sm_case', $1, 'STATE_CHANGE', 'ASSIGNED', 'UNDER_INVESTIGATION', 'START_INVEST', 'OFFICER', $2, $3, $4)`,
        [c.case_id, officer.user_id, invest_remarks[i % invest_remarks.length], new Date(createdAt.getTime() + 2 * 86400000).toISOString()]
      );
      await query(
        `INSERT INTO audit_log (entity_type, entity_id, event_type, from_state, to_state, transition_id, actor_type, actor_id, remarks, created_at)
         VALUES ('sm_case', $1, 'STATE_CHANGE', 'UNDER_INVESTIGATION', 'AWAITING_REVIEW', 'SUBMIT_REVIEW', 'OFFICER', $2, $3, $4)`,
        [c.case_id, officer.user_id, review_remarks[i % review_remarks.length], new Date(createdAt.getTime() + 4 * 86400000).toISOString()]
      );
      reviewed++;
    } else {
      const closedAt = new Date(createdAt.getTime() + 6 * 86400000).toISOString();
      const reason = close_remarks[i % close_remarks.length];
      await query(
        `UPDATE case_record SET state_id = 'CLOSED', closed_at = $1, closure_reason = $2, updated_at = NOW() WHERE case_id = $3`,
        [closedAt, reason, c.case_id]
      );
      await query(
        `INSERT INTO audit_log (entity_type, entity_id, event_type, from_state, to_state, transition_id, actor_type, actor_id, remarks, created_at)
         VALUES ('sm_case', $1, 'STATE_CHANGE', 'OPEN', 'ASSIGNED', 'ASSIGN', 'OFFICER', $2, $3, $4)`,
        [c.case_id, supervisorId, remarks_pool[i % remarks_pool.length], new Date(createdAt.getTime() + 86400000).toISOString()]
      );
      await query(
        `INSERT INTO audit_log (entity_type, entity_id, event_type, from_state, to_state, transition_id, actor_type, actor_id, remarks, created_at)
         VALUES ('sm_case', $1, 'STATE_CHANGE', 'ASSIGNED', 'UNDER_INVESTIGATION', 'START_INVEST', 'OFFICER', $2, $3, $4)`,
        [c.case_id, officer.user_id, invest_remarks[i % invest_remarks.length], new Date(createdAt.getTime() + 2 * 86400000).toISOString()]
      );
      await query(
        `INSERT INTO audit_log (entity_type, entity_id, event_type, from_state, to_state, transition_id, actor_type, actor_id, remarks, created_at)
         VALUES ('sm_case', $1, 'STATE_CHANGE', 'UNDER_INVESTIGATION', 'AWAITING_REVIEW', 'SUBMIT_REVIEW', 'OFFICER', $2, $3, $4)`,
        [c.case_id, officer.user_id, review_remarks[i % review_remarks.length], new Date(createdAt.getTime() + 4 * 86400000).toISOString()]
      );
      await query(
        `INSERT INTO audit_log (entity_type, entity_id, event_type, from_state, to_state, transition_id, actor_type, actor_id, remarks, created_at)
         VALUES ('sm_case', $1, 'STATE_CHANGE', 'AWAITING_REVIEW', 'CLOSED', 'APPROVE_CLOSE', 'OFFICER', $2, $3, $4)`,
        [c.case_id, supervisorId, reason, closedAt]
      );
      closed++;
    }
  }

  console.log(`[SEED] Backfill complete: ${openEnd} OPEN, ${assigned} ASSIGNED, ${investigated} UNDER_INVESTIGATION, ${reviewed} AWAITING_REVIEW, ${closed} CLOSED`);
}

async function distributeDataAcrossDivisions(divisionUnitIds: string[]) {
  if (divisionUnitIds.length === 0) {
    console.log("[SEED] No divisions to distribute data across");
    return;
  }

  // Distribute alerts across divisions (round-robin)
  const alerts = await query(`SELECT alert_id FROM sm_alert ORDER BY created_at`);
  let alertsUpdated = 0;
  for (let i = 0; i < alerts.rows.length; i++) {
    const unitId = divisionUnitIds[i % divisionUnitIds.length];
    await query(`UPDATE sm_alert SET unit_id = $1 WHERE alert_id = $2`, [unitId, alerts.rows[i].alert_id]);
    alertsUpdated++;
  }
  console.log(`[SEED] Distributed ${alertsUpdated} alerts across ${divisionUnitIds.length} divisions`);

  // Distribute cases across divisions
  const cases = await query(`SELECT case_id FROM case_record ORDER BY created_at`);
  let casesUpdated = 0;
  for (let i = 0; i < cases.rows.length; i++) {
    const unitId = divisionUnitIds[i % divisionUnitIds.length];
    await query(`UPDATE case_record SET unit_id = $1 WHERE case_id = $2`, [unitId, cases.rows[i].case_id]);
    casesUpdated++;
  }
  console.log(`[SEED] Distributed ${casesUpdated} cases across ${divisionUnitIds.length} divisions`);
}

async function seedClassifiedContentItems() {
  // Clean up ALL existing content items and dependent records first
  console.log("[SEED] Clearing all existing content items...");
  await query(`DELETE FROM classification_result WHERE entity_type = 'content_item'`);
  // Safe deletes — tables may not exist in every deployment
  for (const stmt of [
    `DELETE FROM translation_record WHERE source_entity_type = 'content_item'`,
    `DELETE FROM entity_extraction WHERE entity_type = 'content_item'`,
  ]) {
    try { await query(stmt); } catch { /* table may not exist */ }
  }
  await query(`DELETE FROM evidence_item WHERE content_id IS NOT NULL`);
  await query(`UPDATE case_record SET source_alert_id = NULL WHERE source_alert_id IS NOT NULL`);
  await query(`DELETE FROM sm_alert WHERE content_id IS NOT NULL`);
  await query(`DELETE FROM content_item`);
  console.log("[SEED] All content items cleared");

  // Fetch category IDs and a connector
  const catRows = await query(`SELECT category_id, name FROM taxonomy_category`);
  const catMap: Record<string, string> = {};
  for (const r of catRows.rows) catMap[r.name] = r.category_id;

  const connectorRow = await query(`SELECT connector_id FROM source_connector LIMIT 1`);
  const connectorId = connectorRow.rows[0]?.connector_id || null;

  const PLATFORMS = ["twitter", "facebook", "instagram", "telegram", "youtube", "whatsapp"];
  const HANDLES = [
    "darknet_hyd", "truth_seeker_ts", "cyber_patrol", "news_daily_ts",
    "local_reporter_hyd", "student_voice_ou", "whistleblower_ts", "street_buzz_ts",
    "tech_fraud_alert", "community_watch_hyd", "justice4all_ts", "hyderabad_speaks",
    "telangana_news24", "secunderabad_eye", "vigilant_citizen", "chai_pe_charcha",
    "info_warrior_ts", "amma_odi_ts", "nizam_heritage", "gachibowli_gossip",
  ];

  let itemCount = 0;

  async function seedItem(opts: {
    platform: string; handle: string; text: string;
    category: string; riskScore: number;
    factors: Array<{ factor: string; detail: string }>;
    llmUsed: boolean; llmConfidence: number | null;
    createAlert: boolean; alertPriority?: string;
    daysAgo: number;
  }) {
    const catId = catMap[opts.category] || catMap.GENERAL;
    if (!catId) return;

    const publishedAt = new Date(Date.now() - opts.daysAgo * 24 * 60 * 60 * 1000);
    const postId = `seed-cls-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const ciResult = await query(
      `INSERT INTO content_item (connector_id, platform, platform_post_id, author_handle, author_name,
         content_text, language, threat_score, category_id, published_at, metadata_jsonb)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, '{}'::jsonb)
       RETURNING content_id`,
      [connectorId, opts.platform, postId, opts.handle, opts.handle, opts.text, "en", opts.riskScore, catId, publishedAt],
    );
    if (ciResult.rows.length === 0) return;
    const contentId = ciResult.rows[0].content_id as string;
    itemCount++;

    const riskFactors = opts.factors.map(f => ({ factor: f.factor, weight: 1.0, score: opts.riskScore, detail: f.detail }));
    const reviewStatus = opts.riskScore < 60 && opts.riskScore >= 40 ? "NEEDS_REVIEW" : "AUTO_ACCEPTED";

    await query(
      `INSERT INTO classification_result (entity_type, entity_id, category, risk_score, risk_factors, review_status, classified_by_llm, llm_confidence)
       VALUES ('content_item', $1, $2, $3, $4, $5, $6, $7)`,
      [contentId, opts.category, opts.riskScore, JSON.stringify(riskFactors), reviewStatus, opts.llmUsed, opts.llmConfidence],
    );

    if (opts.createAlert) {
      const priority = opts.alertPriority || (opts.riskScore >= 85 ? "CRITICAL" : opts.riskScore >= 70 ? "HIGH" : opts.riskScore >= 50 ? "MEDIUM" : "LOW");
      await query(
        `INSERT INTO sm_alert (alert_type, priority, title, description, content_id, state_id, category_id,
           alert_ref)
         VALUES ('AUTO_DETECTED', $1, $2, $3, $4, 'NEW', $5,
           'SM-ALERT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('sm_alert_ref_seq')::text, 6, '0'))`,
        [priority, `${opts.platform} — ${opts.text.slice(0, 100)}`,
         `Auto-detected ${opts.category} content. Risk: ${opts.riskScore}. Author: ${opts.handle}`,
         contentId, catId],
      );
    }
  }

  const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

  // ── DRUGS_TRAFFICKING (8 items, risk 70-95, all alert) ──
  const drugTexts = [
    "Bro check telegram for maal delivery tonight, Jubilee Hills area. Pure stuff 🔥",
    "New batch of MDMA crystals landed in Secunderabad. DM for bulk pricing 💊",
    "Ganja packets available near Charminar, ₹2000/100g. Fast home delivery 🌿",
    "Cocaine supply chain from Goa restored. Hyderabad drops available this weekend.",
    "Charas smuggling route via Adilabad border active again. Mules needed urgently.",
    "Fentanyl test strips available — our stuff is 99% pure. Banjara Hills meetup.",
    "Heroin shipment cleared customs. South Indian distribution starting from Hyd hub.",
    "Dark web vendor shipping LSD tabs to Telangana. Bitcoin only, encrypted comms.",
  ];
  for (let i = 0; i < drugTexts.length; i++) {
    await seedItem({
      platform: pick(PLATFORMS), handle: pick(HANDLES), text: drugTexts[i],
      category: "DRUGS_TRAFFICKING", riskScore: 70 + Math.floor(Math.random() * 26),
      factors: [{ factor: "narcotic_terminology", detail: "Drug trade terminology detected" }, { factor: "location_mention", detail: "Hyderabad area reference" }],
      llmUsed: true, llmConfidence: 0.85 + Math.random() * 0.14,
      createAlert: true, daysAgo: Math.floor(Math.random() * 14) + 1,
    });
  }

  // ── DRUGS_CONSUMPTION (5 items, risk 40-65, some alert) ──
  const consumptionTexts = [
    "420 vibes at OU campus 🌿 who's joining the session tonight",
    "Sunday evening chill with cannabis oil and music. Peaceful life.",
    "Tried that new weed strain from Warangal. Smooth high, recommended 💨",
    "Rolling a joint for the weekend. Hyderabad parties getting wild.",
    "Got stoned at the farm, watching sunset. Life in Telangana 🌅",
  ];
  for (let i = 0; i < consumptionTexts.length; i++) {
    await seedItem({
      platform: pick(PLATFORMS), handle: pick(HANDLES), text: consumptionTexts[i],
      category: "DRUGS_CONSUMPTION", riskScore: 40 + Math.floor(Math.random() * 26),
      factors: [{ factor: "drug_consumption_reference", detail: "Casual drug use language" }],
      llmUsed: true, llmConfidence: 0.7 + Math.random() * 0.2,
      createAlert: i < 3, daysAgo: Math.floor(Math.random() * 21) + 1,
    });
  }

  // ── HATE_SPEECH (8 items, risk 60-90, all alert) ──
  const hateTexts = [
    "These people don't belong in our neighbourhood. Throw them out before Diwali!",
    "Community X is destroying our culture. Time for action brothers 🔥",
    "Spreading religious hatred pamphlets near Charminar. Who's behind this?",
    "Inciting communal violence on WhatsApp — screenshots of provocative messages shared",
    "Hate rally planned in Old City. Inflammatory slogans being prepared.",
    "Sectarian clashes expected during festival. Provocateurs identified online.",
    "Anti-minority posts going viral in Telangana Facebook groups. Very dangerous.",
    "Religious extremists using YouTube to spread enmity between communities.",
  ];
  for (let i = 0; i < hateTexts.length; i++) {
    await seedItem({
      platform: pick(PLATFORMS), handle: pick(HANDLES), text: hateTexts[i],
      category: "HATE_SPEECH", riskScore: 60 + Math.floor(Math.random() * 31),
      factors: [{ factor: "communal_tension", detail: "Communal hatred language detected" }, { factor: "incitement", detail: "Call to action against community" }],
      llmUsed: true, llmConfidence: 0.8 + Math.random() * 0.15,
      createAlert: true, daysAgo: Math.floor(Math.random() * 14) + 1,
    });
  }

  // ── HARASSMENT (6 items, risk 45-75, all alert) ──
  const harassTexts = [
    "Posting her morphed photos everywhere until she apologizes. She deserves it.",
    "Continuous trolling and bullying of student activist on Instagram stories.",
    "Stalking ex-girlfriend's location via social media. Posted her daily routine.",
    "Threatening messages sent to journalist for exposing corruption. Screenshots.",
    "Cyberbullying campaign against a teacher. Fake accounts created to harass.",
    "Exposed personal photos of rival. Online harassment campaign organized.",
  ];
  for (let i = 0; i < harassTexts.length; i++) {
    await seedItem({
      platform: pick(PLATFORMS), handle: pick(HANDLES), text: harassTexts[i],
      category: "HARASSMENT", riskScore: 45 + Math.floor(Math.random() * 31),
      factors: [{ factor: "harassment_pattern", detail: "Targeted harassment behaviour" }],
      llmUsed: true, llmConfidence: 0.75 + Math.random() * 0.2,
      createAlert: true, daysAgo: Math.floor(Math.random() * 14) + 1,
    });
  }

  // ── CYBER_FRAUD (8 items, risk 50-85, all alert) ──
  const fraudTexts = [
    "Fake loan app collecting KYC data. Already 200+ victims in Hyderabad.",
    "OTP fraud ring operating via Telegram. Targeting senior citizens in Secunderabad.",
    "Crypto investment scam promising 300% returns. Telegram group has 5000 members.",
    "Job fraud: fake IT company collecting ₹50,000 registration fee from freshers.",
    "Sextortion racket: victims being blackmailed after video calls. 50+ cases reported.",
    "UPI fraud: fake customer care numbers posted on Google Maps for Hyderabad banks.",
    "Phishing website mimicking SBI login page. URL being shared via SMS campaign.",
    "Ponzi scheme operator running from Banjara Hills. Social media ads still active.",
  ];
  for (let i = 0; i < fraudTexts.length; i++) {
    await seedItem({
      platform: pick(PLATFORMS), handle: pick(HANDLES), text: fraudTexts[i],
      category: "CYBER_FRAUD", riskScore: 50 + Math.floor(Math.random() * 36),
      factors: [{ factor: "fraud_indicator", detail: "Financial fraud terminology" }, { factor: "victim_count", detail: "Multiple victims referenced" }],
      llmUsed: true, llmConfidence: 0.8 + Math.random() * 0.15,
      createAlert: true, daysAgo: Math.floor(Math.random() * 14) + 1,
    });
  }

  // ── CSAM (3 items, risk 85-95, all alert) ──
  const csamTexts = [
    "Suspected CSAM distribution channel detected on Telegram. Hash match with NCMEC database.",
    "Minor exploitation content being shared in encrypted group. IP traces point to Telangana.",
    "Child abuse material found linked to dark web forum. Hyderabad user identified.",
  ];
  for (let i = 0; i < csamTexts.length; i++) {
    await seedItem({
      platform: pick(PLATFORMS), handle: pick(HANDLES), text: csamTexts[i],
      category: "CSAM", riskScore: 85 + Math.floor(Math.random() * 11),
      factors: [{ factor: "csam_indicator", detail: "CSAM hash match or exploitation reference" }],
      llmUsed: true, llmConfidence: 0.92 + Math.random() * 0.07,
      createAlert: true, alertPriority: "CRITICAL", daysAgo: Math.floor(Math.random() * 7) + 1,
    });
  }

  // ── TERRORISM (4 items, risk 80-95, all alert) ──
  const terrorTexts = [
    "ISIS propaganda video shared in private Telegram group. Recruitment messaging in Urdu.",
    "Bomb-making instructions circulated via encrypted chat. Hyderabad sleeper cell suspected.",
    "Radicalization content targeting youth in Telangana. Online training modules shared.",
    "Terror financing through cryptocurrency — hawala network coordinates shared on social media.",
  ];
  for (let i = 0; i < terrorTexts.length; i++) {
    await seedItem({
      platform: pick(PLATFORMS), handle: pick(HANDLES), text: terrorTexts[i],
      category: "TERRORISM", riskScore: 80 + Math.floor(Math.random() * 16),
      factors: [{ factor: "terrorism_indicator", detail: "Terror-related content or recruitment" }],
      llmUsed: true, llmConfidence: 0.88 + Math.random() * 0.1,
      createAlert: true, alertPriority: "CRITICAL", daysAgo: Math.floor(Math.random() * 7) + 1,
    });
  }

  // ── FAKE_NEWS (5 items, risk 30-55, some alert) ──
  const fakeNewsTexts = [
    "Viral WhatsApp forward claiming water supply poisoned in Secunderabad. NO official confirmation.",
    "Fabricated news article about political leader's arrest shared 10,000 times.",
    "Hoax: morphed image of army deployment in Hyderabad circulating on Facebook.",
    "Misinformation about new tax on street vendors. Government has denied.",
    "Deepfake video of CM making inflammatory statements. Fact-checkers flagged.",
  ];
  for (let i = 0; i < fakeNewsTexts.length; i++) {
    await seedItem({
      platform: pick(PLATFORMS), handle: pick(HANDLES), text: fakeNewsTexts[i],
      category: "FAKE_NEWS", riskScore: 30 + Math.floor(Math.random() * 26),
      factors: [{ factor: "misinformation", detail: "Unverified claims or fabricated content" }],
      llmUsed: true, llmConfidence: 0.6 + Math.random() * 0.25,
      createAlert: i < 3, daysAgo: Math.floor(Math.random() * 21) + 1,
    });
  }

  // ── DEFAMATION (4 items, risk 35-60, some alert) ──
  const defamationTexts = [
    "False accusation against local politician shared with morphed documents.",
    "Character assassination campaign against business rival on Twitter.",
    "Libellous blog post about government official circulated on WhatsApp groups.",
    "Fake screenshots of chat conversations to defame college professor.",
  ];
  for (let i = 0; i < defamationTexts.length; i++) {
    await seedItem({
      platform: pick(PLATFORMS), handle: pick(HANDLES), text: defamationTexts[i],
      category: "DEFAMATION", riskScore: 35 + Math.floor(Math.random() * 26),
      factors: [{ factor: "defamation_content", detail: "False statements aimed at reputation damage" }],
      llmUsed: false, llmConfidence: null,
      createAlert: i < 2, daysAgo: Math.floor(Math.random() * 21) + 1,
    });
  }

  // ── EXTORTION (4 items, risk 55-80, all alert) ──
  const extortionTexts = [
    "Pay ₹5 lakh or your private video goes viral. Last warning. Sextortion case.",
    "Threatening to release company secrets unless ransom paid. Corporate blackmail.",
    "Online extortion: hacker threatening to leak database unless Bitcoin payment.",
    "Ex-employee blackmailing former boss with private photos. Demanding ₹10 lakh.",
  ];
  for (let i = 0; i < extortionTexts.length; i++) {
    await seedItem({
      platform: pick(PLATFORMS), handle: pick(HANDLES), text: extortionTexts[i],
      category: "EXTORTION", riskScore: 55 + Math.floor(Math.random() * 26),
      factors: [{ factor: "extortion_threat", detail: "Financial demand with threat of exposure" }],
      llmUsed: true, llmConfidence: 0.82 + Math.random() * 0.15,
      createAlert: true, daysAgo: Math.floor(Math.random() * 14) + 1,
    });
  }

  // ── GAMBLING (3 items, risk 30-50, some alert) ──
  const gamblingTexts = [
    "Online satta matka results for Hyderabad kalyan. Place bets now 🎰",
    "Illegal betting app promoting IPL cricket gambling. Thousands of users.",
    "Casino night promotion via Instagram stories. No licence, operating from Jubilee Hills.",
  ];
  for (let i = 0; i < gamblingTexts.length; i++) {
    await seedItem({
      platform: pick(PLATFORMS), handle: pick(HANDLES), text: gamblingTexts[i],
      category: "GAMBLING", riskScore: 30 + Math.floor(Math.random() * 21),
      factors: [{ factor: "gambling_promotion", detail: "Illegal gambling or betting content" }],
      llmUsed: false, llmConfidence: null,
      createAlert: i < 2, daysAgo: Math.floor(Math.random() * 21) + 1,
    });
  }

  // ── IDENTITY_THEFT (4 items, risk 45-70, all alert) ──
  const idTheftTexts = [
    "Fake profile impersonating IPS officer on Facebook. Using official photos.",
    "Catfishing operation: multiple fake identities targeting women on dating apps.",
    "Stolen identity used to open bank accounts. Victim's Aadhaar details leaked online.",
    "Impersonation of government official on Twitter to extract personal data from citizens.",
  ];
  for (let i = 0; i < idTheftTexts.length; i++) {
    await seedItem({
      platform: pick(PLATFORMS), handle: pick(HANDLES), text: idTheftTexts[i],
      category: "IDENTITY_THEFT", riskScore: 45 + Math.floor(Math.random() * 26),
      factors: [{ factor: "identity_fraud", detail: "Impersonation or stolen identity indicators" }],
      llmUsed: true, llmConfidence: 0.7 + Math.random() * 0.2,
      createAlert: true, daysAgo: Math.floor(Math.random() * 14) + 1,
    });
  }

  // ── GENERAL (38 items, risk 0-25, no alerts) ──
  const generalTexts = [
    "Traffic congestion near Begumpet due to road work. Expect delays.",
    "New metro line inauguration ceremony at Hitech City station this Saturday.",
    "Weather update: heavy rainfall expected in Hyderabad over the next 48 hours.",
    "Local cricket tournament results from Uppal stadium. Great match!",
    "Biryani festival at Exhibition Grounds this weekend. 50+ stalls. 🍚",
    "GHMC starts pothole repair drive in Kukatpally. Finally!",
    "Blood donation camp at Gandhi Hospital on Sunday. Please participate.",
    "Telangana IT exports cross ₹2 lakh crore milestone. Proud moment.",
    "New public library opening in Ameerpet. Free membership for students.",
    "Hyderabad Marathon 2026 registration now open. 10K and 21K categories.",
    "Power cut scheduled in Madhapur from 10 AM to 2 PM tomorrow.",
    "Free COVID booster vaccination at all government hospitals this week.",
    "New bus routes announced by TSRTC connecting Shamshabad airport.",
    "Real estate prices in Gachibowli area rising steadily. Good investment?",
    "Farmers' market at Botanical Gardens every Saturday. Fresh organic produce.",
    "KTR inaugurates new flyover at Biodiversity Junction. Traffic relief expected.",
    "Charminar illuminated for special festival celebrations. Beautiful sight! 🏛️",
    "Osmania University admissions open for 2026-27 academic year.",
    "New startup incubator launched in T-Hub Phase 2. Apply now!",
    "Tank Bund walking track renovation completed. Great for morning walks.",
    "Hyderabad ranked among top 5 cities for quality of life in India.",
    "Street food guide: best dosa spots in Ameerpet area. Thread 🧵",
    "Heritage walk organized by INTACH covering Golconda Fort this Sunday.",
    "Traffic police conducting awareness drive on helmet usage. Stay safe!",
    "New hospital wing inaugurated at NIMS. 200 additional beds.",
    "Children's science fair at Birla Planetarium. Amazing projects! 🔬",
    "Hussain Sagar lake cleanup drive needs volunteers. Register online.",
    "TSRTC introduces electric buses on Secunderabad-Airport route.",
    "Classical dance performance at Ravindra Bharati auditorium tonight.",
    "Software engineer from Hyderabad wins national hackathon. Congratulations!",
    "Ganesh Chaturthi celebrations: immersion routes announced by traffic police.",
    "Medchal toll plaza to go cashless from next month. FASTag mandatory.",
    "Outer Ring Road speed limit reduced to 80 km/h after accidents.",
    "New school admissions: best CBSE schools in Kondapur area reviewed.",
    "Hyderabad book fair at NTR Stadium. Discounts up to 50% on all books.",
    "Pochampally handloom exhibition at Shilparamam. Support local artisans!",
    "Telangana state formation day celebrations at Public Gardens.",
    "Local NGO distributing free meals at railway stations. Great initiative. 🙏",
  ];
  for (let i = 0; i < generalTexts.length; i++) {
    await seedItem({
      platform: pick(PLATFORMS), handle: pick(HANDLES), text: generalTexts[i],
      category: "GENERAL", riskScore: Math.floor(Math.random() * 26),
      factors: [{ factor: "general_monitoring", detail: "Content under routine social media monitoring" }],
      llmUsed: i % 3 === 0, llmConfidence: i % 3 === 0 ? 0.3 + Math.random() * 0.3 : null,
      createAlert: false, daysAgo: Math.floor(Math.random() * 30) + 1,
    });
  }

  console.log(`[SEED] Seeded ${itemCount} classified content items`);
}

async function categorizeContentItems() {
  // Fetch category IDs
  const catRows = await query(`SELECT category_id, name FROM taxonomy_category`);
  const catMap: Record<string, string> = {};
  for (const r of catRows.rows) catMap[r.name] = r.category_id;

  let totalUpdated = 0;
  for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const catId = catMap[catName];
    if (!catId) continue;
    const patterns = keywords.map(k => `%${k}%`);
    const res = await query(
      `UPDATE content_item SET category_id = $1
       WHERE category_id IS NULL AND content_text ILIKE ANY($2::text[])`,
      [catId, patterns],
    );
    if (res.rowCount && res.rowCount > 0) {
      totalUpdated += res.rowCount;
    }
  }

  // Assign a default category to any remaining uncategorized items
  const defaultCatId = catMap.GENERAL || Object.values(catMap)[0];
  if (defaultCatId) {
    const res = await query(
      `UPDATE content_item SET category_id = $1 WHERE category_id IS NULL`,
      [defaultCatId],
    );
    if (res.rowCount && res.rowCount > 0) totalUpdated += res.rowCount;
  }

  console.log(`[SEED] Categorized ${totalUpdated} content items`);
}

async function distributeAlertStates() {
  // Get all alerts currently in IN_REVIEW or NEW state
  const alerts = await query(
    `SELECT alert_id FROM sm_alert WHERE state_id IN ('IN_REVIEW', 'NEW') ORDER BY created_at`
  );
  const total = alerts.rows.length;
  if (total === 0) {
    console.log("[SEED] No alerts to redistribute");
    return;
  }

  // Distribution: 60% IN_REVIEW, 15% CONVERTED_TO_CASE, 10% FALSE_POSITIVE, 5% CLOSED_NO_ACTION, 10% NEW
  const inReviewEnd = Math.floor(total * 0.60);
  const convertedEnd = inReviewEnd + Math.floor(total * 0.15);
  const fpEnd = convertedEnd + Math.floor(total * 0.10);
  const closedEnd = fpEnd + Math.floor(total * 0.05);
  // Rest stay as NEW

  let converted = 0, fp = 0, closed = 0;

  for (let i = 0; i < total; i++) {
    const alertId = alerts.rows[i].alert_id;
    if (i < inReviewEnd) {
      await query(`UPDATE sm_alert SET state_id = 'IN_REVIEW' WHERE alert_id = $1`, [alertId]);
    } else if (i < convertedEnd) {
      await query(`UPDATE sm_alert SET state_id = 'CONVERTED_TO_CASE' WHERE alert_id = $1`, [alertId]);
      converted++;
    } else if (i < fpEnd) {
      await query(`UPDATE sm_alert SET state_id = 'FALSE_POSITIVE' WHERE alert_id = $1`, [alertId]);
      fp++;
    } else if (i < closedEnd) {
      await query(`UPDATE sm_alert SET state_id = 'CLOSED_NO_ACTION' WHERE alert_id = $1`, [alertId]);
      closed++;
    } else {
      await query(`UPDATE sm_alert SET state_id = 'NEW' WHERE alert_id = $1`, [alertId]);
    }
  }

  // Also mark the 6 demo case alerts as CONVERTED_TO_CASE
  await query(
    `UPDATE sm_alert SET state_id = 'CONVERTED_TO_CASE'
     WHERE alert_id IN (SELECT source_alert_id FROM case_record WHERE source_alert_id IS NOT NULL)
       AND state_id != 'CONVERTED_TO_CASE'`
  );

  console.log(`[SEED] Alert state distribution: ${inReviewEnd} IN_REVIEW, ${converted} CONVERTED, ${fp} FALSE_POSITIVE, ${closed} CLOSED_NO_ACTION, ${total - closedEnd} NEW`);
}

async function seedModels() {
  for (const m of MODELS) {
    const evaluatedAt = new Date(Date.now() - m.daysAgo * 86400000).toISOString();
    await query(
      `INSERT INTO model_registry (model_name, model_type, version, status, performance_metrics, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $6)
       ON CONFLICT (model_name, version) DO NOTHING`,
      [m.name, m.type, m.version, m.status,
       JSON.stringify({ accuracy: m.accuracy, precision: m.accuracy - 0.03, recall: m.accuracy - 0.01, f1: m.accuracy - 0.02 }),
       evaluatedAt],
    );
  }

  // LLM provider (skip if any active provider exists)
  const existingProvider = await query(`SELECT config_id FROM llm_provider_config WHERE is_active = TRUE LIMIT 1`);
  if (existingProvider.rows.length === 0) {
    await query(
      `INSERT INTO llm_provider_config (config_id, provider, display_name, api_base_url, model_id, is_active, is_default)
       VALUES (gen_random_uuid(), 'openai', 'OpenAI GPT-4', 'https://api.openai.com/v1', 'gpt-4', true, true)`
    );
  }

  console.log(`[SEED] ${MODELS.length} models + 1 LLM provider seeded`);
}

async function seedLegalRules() {
  for (const r of LEGAL_RULES) {
    await query(
      `INSERT INTO legal_mapping_rule (rule_code, law_name, provision_code, severity_weight, approval_status, effective_from, version_no, rule_expression)
       VALUES ($1, $2, $3, $4, 'PUBLISHED', $5, 1, $6::jsonb)
       ON CONFLICT (rule_code) DO NOTHING`,
      [r.code, r.law, r.provision, r.weight, r.from, JSON.stringify(r.expr)],
    );
  }
  console.log(`[SEED] ${LEGAL_RULES.length} additional legal mapping rules seeded`);
}

async function seedMonitoringProfiles() {
  // Clear existing profiles and re-seed
  await query(`DELETE FROM monitoring_profile`);

  for (const p of MONITORING_PROFILES) {
    await query(
      `INSERT INTO monitoring_profile (platform, entry_type, handle, priority, source, source_ref, suspect_name, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING`,
      [p.platform, p.entryType, p.handle, p.priority, p.source, p.sourceRef, p.suspectName, p.notes],
    );
  }

  console.log(`[SEED] ${MONITORING_PROFILES.length} monitoring profiles seeded`);

  // Seed jurisdiction locations
  for (const loc of JURISDICTION_LOCATIONS) {
    await query(
      `INSERT INTO jurisdiction_location (district_name, city_names, area_names, alt_spellings)
       VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb)
       ON CONFLICT (district_name) DO UPDATE SET
         city_names = EXCLUDED.city_names,
         area_names = EXCLUDED.area_names,
         alt_spellings = EXCLUDED.alt_spellings`,
      [loc.district, JSON.stringify(loc.cities), JSON.stringify(loc.areas), JSON.stringify(loc.altSpellings)],
    );
  }
  console.log(`[SEED] ${JURISDICTION_LOCATIONS.length} jurisdiction locations seeded`);
}

seed()
  .catch((err) => { console.error("[SEED] Fatal error:", err); process.exit(1); })
  .finally(() => pool.end());
