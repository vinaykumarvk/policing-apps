import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError } from "../errors";
import { logInfo, logError } from "../logger";
import { ingestItems } from "../connectors/ingestion-pipeline";
import { classifyContentWithLlm, normalizeCategoryToTaxonomy } from "../services/classifier";
import type { FetchedItem } from "../connectors/types";
import crypto from "crypto";

// ── Helper: generate a past date within the last N days ──────────────────────
function randomPastDate(daysBack: number): Date {
  return new Date(Date.now() - Math.random() * daysBack * 86400000);
}

// ── Platforms, handles, names for variety ─────────────────────────────────────
const PLATFORMS = ["Telegram", "Instagram", "Facebook", "Twitter", "WhatsApp", "YouTube"];
const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

/**
 * 100 multilingual seed posts across all detection layers.
 * Grouped by theme:
 *   1-15  English + emoji drug codes
 *  16-30  Hindi romanised (chitta, maal, nashe, afeem)
 *  31-45  Telugu romanised (ganjayi, saruku, mandu, podi, naatusaara)
 *  46-55  Punjabi romanised (chitta, sulfa, phukki)
 *  56-65  Leetspeak / homoglyph evasion
 *  66-75  Transaction-heavy (pricing, quantities, delivery areas)
 *  76-85  Emoji-only / coded messages
 *  86-95  Mixed / separator evasion (M.D.M.A, ecs-ta-sy)
 *  96-100 Benign / borderline (should score low — calibration posts)
 */
function buildSeedPosts(): FetchedItem[] {
  const posts: FetchedItem[] = [];
  const meta = (tier?: string) => ({ source_tier: tier || undefined, seed: true });

  // ── 1-15: English + emoji drug codes ───────────────────────────────────────
  const enEmojiTexts = [
    "🍃💊❄️ Fresh batch just landed! Premium quality, DM for menu. Fast delivery across Punjab. No time wasters 🚀",
    "Got the best 🌿 in town. Pure ❄️ snow too. Telegram only. Chandigarh, Mohali, Panchkula. 📦💨",
    "💊💊💊 Party pills ready for the weekend. Ecstasy, molly, special K. All tested. DM your city 📞",
    "🍄 Magic mushrooms and LSD tabs. Mind-expanding experience. Discreet packaging. Delhi NCR delivery 🚚",
    "❄️💎 Colombian grade. Uncut. Serious buyers only. Minimum 10g. Payment crypto or UPI 💰",
    "🌿🔥 Top shelf cannabis. Indoor grown, 28% THC. Edibles and concentrates also available. Nationwide shipping 📦",
    "💉 Brown sugar purest form. Heroin grade A. Only bulk orders. Patna, Ranchi, Varanasi delivery 🚛",
    "💊 Xanax, tramadol, codeine — pharma grade. No prescription needed. Cash on delivery all India 📬",
    "🍃💨 Charas from Malana. Hand-rubbed cream. Limited stock. Manali pickup or shipping available ❄️",
    "🔥🔥🔥 Crystal meth. Ice. Purest on the market. Small quantities to wholesale. North India only 💎",
    "🌈🍄 Psychedelic combo packs: LSD + shrooms + DMT. Weekend special offer 🎉 DM for pricing",
    "💊💉 Fentanyl patches and powder. Medical grade. Extreme caution advised. Only experienced users. DM 🤫",
    "🍃 Marijuana pre-rolls, vape carts, and wax. Premium Cali imports. Pan India delivery 🛩️ 📦",
    "❄️ Crack rocks ready. 0.5g, 1g, 3.5g packs. Same day delivery metro cities. Signal only 📱",
    "💊🎵 Festival season stock: MDMA crystals, 2CB, ketamine, poppers. Bulk discounts available 🎪✨",
  ];
  enEmojiTexts.forEach((text, i) => {
    posts.push({
      platformPostId: `seed-en-emoji-${i + 1}`,
      platform: pick(PLATFORMS),
      authorHandle: pick(["dealer_420", "green_connect", "snow_plug", "party_pack", "pharm_king", "shroom_guru", "ice_man", "cali_imports"]),
      authorName: pick(["Green Connect", "Snow Plug", "Party Pack Supply", "Pharma King", "Shroom Guru", "Ice Man", "Cali Imports", "Festival Stock"]),
      contentText: text,
      contentUrl: `https://example.com/post/${1000 + i}`,
      language: "en",
      publishedAt: randomPastDate(30),
      metadata: meta("TIER_1"),
    });
  });

  // ── 16-30: Hindi romanised ─────────────────────────────────────────────────
  const hiTexts = [
    "Chitta available hai bhai, maal first class hai. Nashe ka asli maza. Afeem bhi mil jayegi. DM karo quantity ke saath. Amritsar, Ludhiana delivery.",
    "Ganja top quality milega, charas bhi hai. Maal ekdum fresh hai. Delhi mein delivery ho jayegi. Contact karo WhatsApp pe.",
    "Afeem ka stock aa gaya hai. Pure opium, no mixing. Rajasthan se direct supply. Serious buyers only. Payment advance.",
    "Chitta 1g = 2000, 5g = 8000. Nashe wali cheez sabse best. Punjab delivery same day. DM karo.",
    "Maal chahiye toh DM karo. Ganja, charas, afeem sab available. Lucknow, Kanpur, Varanasi delivery. Cash on delivery.",
    "Brown sugar milega best quality. Heroin purest form. Mumbai, Pune, Nashik. Minimum order 5g. WhatsApp only.",
    "Nashe ka saman chahiye? Chitta, sulfa, ganja — sab milega ek jagah se. Punjab har shehar delivery. DM karo bhai.",
    "MDMA crystals imported stock. Ecstasy pills bhi hai. Party ke liye best. Goa, Mumbai, Delhi delivery. Payment UPI.",
    "Pharmaceutical grade maal — codeine syrup, tramadol, alprazolam. No prescription. Pan India delivery. COD available.",
    "Hashish cream malana se direct. Best quality guaranteed. 10g minimum. Shimla, Manali, Chandigarh. Signal pe contact karo.",
    "Smack mil jayega, chitta bhi. Maal ekdum sahi hai bhai. Jaipur, Jodhpur area delivery. Advance payment only.",
    "Cocaine imported hai, uncut hai. 1g se lekar kilo tak available. Bangalore, Hyderabad delivery. Crypto preferred.",
    "LSD tabs fresh stock aaya hai. Acid trip guaranteed. 1 tab = 500, 10 tabs = 4000. Delhi NCR same day.",
    "Ketamine powder and liquid dono available. Special K best quality. Goa party scene ke liye perfect. DM for menu.",
    "Weed plantation se direct maal. Organic, no chemicals. Sativa and indica dono. Bihar, Jharkhand delivery. Fresh harvest.",
  ];
  hiTexts.forEach((text, i) => {
    posts.push({
      platformPostId: `seed-hi-${i + 1}`,
      platform: pick(PLATFORMS),
      authorHandle: pick(["ludhiana_maal", "delhi_supply", "afeem_raja", "punjab_dealer", "nashe_wala", "ganja_guru_hi", "bombay_brown", "party_maal"]),
      authorName: pick(["Punjab Connect", "Delhi Supply", "Maal Raja", "Nashe Wala", "Ganja Guru", "Bombay Brown", "Party Maal", "Desi Pharma"]),
      contentText: text,
      contentUrl: `https://example.com/post/${2000 + i}`,
      language: "hi",
      publishedAt: randomPastDate(30),
      metadata: meta("TIER_1"),
    });
  });

  // ── 31-45: Telugu romanised ────────────────────────────────────────────────
  const teTexts = [
    "Ganjayi, saruku, mandu anni available. Podi kuda undi. Best quality guarantee. Vijayawada, Vizag lo delivery. Contact: 9876XXXXXX",
    "Naatusaara fresh batch ready. Saarayi best quality. Kallu available daily morning. Nellore, Ongole area delivery. Belt shop rates.",
    "Gaanja best quality, gaddi kuda available. Hyderabad, Secunderabad lo delivery. WhatsApp cheyandi. Minimum order 50g.",
    "Saruku premium grade undi. Mandu tablets kuda. Tirupati, Kadapa area. Cash on delivery. DM cheyandi.",
    "Afeemu rare stock vachindi. Pure opium, imported. Warangal, Khammam delivery. Serious buyers matrame. Advance payment.",
    "Podi white colour, purest form. Cocaine premium. Vizag port area. Bulk orders ke special rates. Signal only.",
    "Ganjayi plantation nundi direct. Organic, no pesticides. East Godavari best quality. 100g = ₹5000. Delivery available.",
    "Naatusaara toddy kallu — fresh daily. Saarayi country liquor, best taste. Guntur, Prakasam districts. Home delivery.",
    "Gullu tablets party ke ready. MDMA undi, ecstasy kuda. Hyderabad nightlife special. Weekend offers. DM.",
    "Tikke heroin, dose ready ga undi. Kurnool, Anantapur area. Minimum 2g order. Advance only. Discreet packaging.",
    "Poudar cocaine, crystal meth — rendu available. Vijayawada lo pickup or delivery. Crypto or UPI. DM for rates.",
    "Ganji hemp oil and CBD products along with recreational ganjayi. Visakhapatnam lo delivery. Legal and recreational both.",
    "Mandu sleeping pills, pain killers — prescription lekundane. All India delivery. COD accept. Telegram lo order pettu.",
    "Saarayi illicit brew, naatusaara arrack — Rayalaseema special. Daily supply. Kurnool belt. Wholesale rates for bulk.",
    "Saruku party powder and ganjayi combo pack. Weekend special. Hyderabad, Warangal. ₹3000 combo. DM fast, limited stock.",
  ];
  teTexts.forEach((text, i) => {
    posts.push({
      platformPostId: `seed-te-${i + 1}`,
      platform: pick(PLATFORMS),
      authorHandle: pick(["vizag_supply", "hyd_maal", "godavari_ganja", "nellore_desi", "ap_trader", "rayala_brew", "coast_powder", "tirupati_supply"]),
      authorName: pick(["AP Trader", "Vizag Supply", "Godavari Green", "Nellore Desi", "Hyd Connect", "Rayala Brew", "Coast Supply", "Tirupati Deals"]),
      contentText: text,
      contentUrl: `https://example.com/post/${3000 + i}`,
      language: "te",
      publishedAt: randomPastDate(30),
      metadata: meta("TIER_1"),
    });
  });

  // ── 46-55: Punjabi romanised ───────────────────────────────────────────────
  const paTexts = [
    "Chitta mil jayega, sulfa bhi hai. Phukki fresh stock. Punjab de har shehar vich delivery. Sirf serious buyers nu contact karo.",
    "Chitta sabse sasta rate te milega. 1g = ₹1500. Amritsar, Jalandhar, Ludhiana. Same day delivery. DM karo.",
    "Phukki top quality, sulfa imported. Mohali, Patiala, Bathinda delivery. Cash on delivery. Telegram te message karo.",
    "Afeem opium — direct from fields. Rajasthan connection. Punjab vich delivery. Minimum 10g. Advance only.",
    "Chitta powder and sulfa tablets — dono available. Border area stock. Firozpur, Amritsar, Gurdaspur. WhatsApp only.",
    "Ganja fresh harvest aa gaya. Himachali charas bhi. Chandigarh pickup ya delivery. ₹500/10g. DM karo.",
    "Smack brown sugar — purest Punjab vich. Ludhiana, Jalandhar area. Needle supplies bhi available. Discreet.",
    "Heroin chitta wholesale rate te. 100g se upar order te special discount. Punjab, Haryana delivery. Crypto ya cash.",
    "Phukki cannabis edibles — brownies, gummies. Homemade, fresh. Chandigarh, Mohali delivery. ₹200 per piece. DM.",
    "Sulfa tablets aur chitta powder — party combo. Weekend special offer. Ludhiana city delivery. Signal te order karo.",
  ];
  paTexts.forEach((text, i) => {
    posts.push({
      platformPostId: `seed-pa-${i + 1}`,
      platform: pick(PLATFORMS),
      authorHandle: pick(["pind_da_maal", "amritsar_chitta", "ludhiana_sulfa", "punjab_ganja", "border_stock", "desi_supply_pa"]),
      authorName: pick(["Desi Supply", "Punjab Maal", "Amritsar Deals", "Border Stock", "Ludhiana Connect", "Pind Da Maal"]),
      contentText: text,
      contentUrl: `https://example.com/post/${4000 + i}`,
      language: "pa",
      publishedAt: randomPastDate(30),
      metadata: meta("TIER_1"),
    });
  });

  // ── 56-65: Leetspeak / homoglyph evasion ───────────────────────────────────
  const evasionTexts = [
    "c0c@1n3 and m3th available. f3nt@nyl for serious buyers only. h3r01n top grade. DM with your city for rates.",
    "Сосаinе and hеrоin available. Мeth crystal clear. Using special characters to evade detection. Premium stuff only.",
    "G@nj@ and ch@r@s available. M@@l best quality. DM for r@tes. D3livery all over Punj@b.",
    "H.e" + ".r.o.i.n purest form. C.o" + ".c.a.i.n.e uncut. M.e" + ".t.h crystal. Dots cant stop us. DM now.",
    "dr*gs for s@le. c0ke, h3r01n, w33d. @ll c1t13s. dm f0r pr1c3s. n0 c0ps.",
    "Fеntаnуl раtсhеs available. Суrilliс letters used. Bulk оrdеrs wеlсоmе. DМ for priсing.",
    "C.R.Y.S.T.A.L M.E.T.H — premium ice. Separator evasion. Delhi, Mumbai, Bangalore. Signal chat.",
    "K-E-T-A-M-I-N-E liquid and powder. L.S.D tabs. E-C-S-T-A-S-Y rolls. Weekend party pack.",
    "𝐂𝐨𝐜𝐚𝐢𝐧𝐞 unicode bold font evasion. Premium imported. All metros delivery. Crypto payment preferred.",
    "Ⓗⓔⓡⓞⓘⓝ circled unicode characters. Brown sugar ⓑⓔⓢⓣ quality. Mumbai port stock. DM for details.",
  ];
  evasionTexts.forEach((text, i) => {
    posts.push({
      platformPostId: `seed-evasion-${i + 1}`,
      platform: pick(PLATFORMS),
      authorHandle: pick(["coded_msg_x", "stealth_post", "dot_dealer", "unicode_plug", "cipher_sell", "hidden_supply"]),
      authorName: pick(["Anon Seller", "Hidden Supply", "Cipher Deal", "Stealth Mode", "Unicode Plug", "Dot Dealer"]),
      contentText: text,
      contentUrl: `https://example.com/post/${5000 + i}`,
      language: "en",
      publishedAt: randomPastDate(30),
      metadata: meta(),
    });
  });

  // ── 66-75: Transaction-heavy (pricing, quantities, delivery) ───────────────
  const txTexts = [
    "Bulk pricing: 50g = ₹15000, 100g = ₹25000, 500g = ₹100000. Cocaine premium grade. Delivery to Chandigarh, Jalandhar, Patiala. WhatsApp only: +91-98765XXXXX. Minimum order 50g.",
    "MDMA crystals — ₹3000/gram, 5g = ₹12000, 10g = ₹20000. Import quality, lab tested. Delhi NCR same day delivery. UPI payment. DM for sample.",
    "Heroin wholesale: 1kg ₹5,00,000. Half kg ₹2,80,000. Quality guaranteed. Punjab border stock. Only serious dealers contact. Crypto only.",
    "Cannabis oil cartridges: ₹2500 each, 5 for ₹10000. THC 90%+. Bangalore, Chennai, Hyderabad shipping. Cash on delivery. Telegram orders.",
    "LSD blotters: ₹400/tab, sheet of 25 = ₹8000. Fresh print, 200ug each. Pan India speed post. Vacuum sealed. Track number provided.",
    "Ganja rates updated: 10g=₹800, 50g=₹3500, 100g=₹6000, 500g=₹25000. Hydroponic premium. Free delivery above ₹5000 in Hyderabad.",
    "Ketamine vials ₹1500 each, 10 vials = ₹12000. Medical grade, sealed. Goa, Mumbai express delivery. Google Pay or PhonePe accepted.",
    "Crystal meth: 1g=₹5000, 5g=₹20000, 28g=₹100000. Purest 97% in India. North India delivery 24-48hrs. Signal: +91-87654XXXXX.",
    "Charas Malana cream: tola (10g) = ₹4000. Minimum 5 tola order. Himachal pickup available. Shipping extra ₹500. Quality photos on request.",
    "Brown sugar 1g=₹1000, 5g=₹4000, 25g=₹15000. Ludhiana, Amritsar, Jalandhar daily delivery. Cash only. No UPI for safety. Call after 8pm.",
  ];
  txTexts.forEach((text, i) => {
    posts.push({
      platformPostId: `seed-tx-${i + 1}`,
      platform: pick(PLATFORMS),
      authorHandle: pick(["bulk_deals", "wholesale_connect", "rate_card", "price_list", "mega_deals", "daily_supply"]),
      authorName: pick(["Wholesale Connect", "Bulk Deals", "Rate Card", "Mega Deals", "Daily Supply", "Price Drop"]),
      contentText: text,
      contentUrl: "",
      language: "en",
      publishedAt: randomPastDate(14),
      metadata: meta("TIER_1"),
    });
  });

  // ── 76-85: Emoji-only / coded messages ─────────────────────────────────────
  const emojiTexts = [
    "🍃🔥💨 ❄️💎 💊💉 🍄🌈 📦🚚 💰💵 📞👉 🤫🔒",
    "💊💊💊💊💊 📦➡️🏠 💰💰 📞 🤐",
    "❄️❄️❄️ 💎💎 🔥🔥🔥 📦🚛 💵💵💵 📱👈",
    "🍃🌿🌱 × 100 📦 💰💰💰 🚚➡️ Punjab 📞",
    "🍄🍄🍄🌈✨ + 💊💊 = 🎉🎊 Weekend pack ready 📦",
    "💉💉💉 🏥❌ 📦✅ 💰 minimum 💵💵 📞 DM only",
    "🌿🔥 ➡️ 📦 ➡️ 🏠 ➡️ 😎 Happy customers 💯",
    "❄️💎🔮 Premium grade 📦🚀 All cities 💰 DM 📱",
    "🍃💨 + ❄️💎 + 💊🌈 = Ultimate combo 📦🚛💰💵📞",
    "🔌⚡ New stock: 🍃🌿❄️💊🍄💉 All available 📦🏠💰 DM fast 🏃",
  ];
  emojiTexts.forEach((text, i) => {
    posts.push({
      platformPostId: `seed-emoji-${i + 1}`,
      platform: pick(["Telegram", "Instagram", "WhatsApp"]),
      authorHandle: pick(["signal_only", "ghost_plug", "emoji_dealer", "coded_msg", "silent_supply", "no_words"]),
      authorName: pick(["Ghost", "Silent Supply", "Code Only", "No Words Needed", "Emoji Dealer", "Signal Only"]),
      contentText: text,
      contentUrl: `https://t.me/example/${7000 + i}`,
      language: "en",
      publishedAt: randomPastDate(7),
      metadata: meta(),
    });
  });

  // ── 86-95: Mixed language / separator evasion ──────────────────────────────
  const mixedTexts = [
    "M.D.M.A pills available for weekend. L.S.D tabs fresh stock. Ecs-ta-sy premium. Ketamine special K also. Contact on Signal for rates and delivery.",
    "Half English half Hindi: Cocaine ka stock aaya hai bro. M-e-t-h bhi hai. DM karo for prices. Delivery sab jagah.",
    "Telugu-English mix: Ganjayi undi bro, cocaine kuda. Hyderabad lo same day delivery. ₹3000 onwards. WhatsApp chey.",
    "Punjabi-English: Chitta aa gaya fresh lot bro. Premium quality. S.u" + ".l.f.a tablets bhi. Ludhiana Jalandhar delivery hai.",
    "Code words: Green tea (ganja), white powder (cocaine), brown sugar (heroin), party candy (MDMA). Menu available on DM.",
    "Slang mix: Got that loud (strong weed), fishscale (pure coke), tina (meth), lucy (LSD). All cities India. HMU 📱",
    "Multi-script: गांजा available + కొకైన్ kuda undi + ਚਿੱਟਾ mil jayega. Pan India delivery network. DM now.",
    "Separator heavy: C|O|C|A|I|N|E and H|E|R|O|I|N and M|E|T|H — all available. Price on DM. Metro cities.",
    "Acronym evasion: Got MD, K, G, C, H, LSD, 2CB — full menu. Festival season pricing. Group orders welcome.",
    "Reverse text style: eniacoc and nioreh stock ready. Premium quality. If you know, you know. DM the usual way.",
  ];
  mixedTexts.forEach((text, i) => {
    posts.push({
      platformPostId: `seed-mixed-${i + 1}`,
      platform: pick(PLATFORMS),
      authorHandle: pick(["party_supplier", "mixed_code", "multi_lang", "code_switch", "festival_plug", "menu_master"]),
      authorName: pick(["Night Life", "Mixed Code", "Multi-Lang Supply", "Code Switch", "Festival Plug", "Menu Master"]),
      contentText: text,
      contentUrl: `https://example.com/post/${8000 + i}`,
      language: "en",
      publishedAt: randomPastDate(14),
      metadata: meta(),
    });
  });

  // ── 96-100: Benign / borderline (should score low) ─────────────────────────
  const benignTexts = [
    "Beautiful green tea garden in Darjeeling. Fresh harvest season is here. Order online for home delivery across India. ₹500 for 250g pack.",
    "Snow capped mountains of Himachal Pradesh. Crystal clear water streams. Perfect holiday destination. Book now at affordable rates.",
    "Pharmacy awareness: Never buy prescription drugs without valid prescription. Report illegal online pharmacies to cyber crime helpline.",
    "Anti-drug awareness rally in Ludhiana today. Say no to chitta and drugs. Youth of Punjab standing against substance abuse. #DrugFree",
    "NEWS: Police seized 50kg heroin worth ₹200 crore in Amritsar. Three arrested including kingpin. Major drug bust operation.",
  ];
  benignTexts.forEach((text, i) => {
    posts.push({
      platformPostId: `seed-benign-${i + 1}`,
      platform: pick(PLATFORMS),
      authorHandle: pick(["tea_lover", "travel_india", "pharma_aware", "youth_punjab", "news_reporter"]),
      authorName: pick(["Tea Lover", "Travel India", "Pharma Awareness", "Youth Punjab", "News Reporter"]),
      contentText: text,
      contentUrl: `https://example.com/post/${9000 + i}`,
      language: "en",
      publishedAt: randomPastDate(30),
      metadata: meta(),
    });
  });

  return posts;
}

export async function registerPipelineRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/pipeline/run
   * Modes:
   *  - seed_and_classify: clear old content, insert 100 multilingual posts, run full pipeline
   *  - reclassify: re-process existing content items with full pipeline metadata
   */
  app.post("/api/v1/pipeline/run", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          mode: { type: "string", enum: ["seed_and_classify", "reclassify"] },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
        },
        required: ["mode"],
      },
    },
  }, async (request, reply) => {
    const { mode, limit: rawLimit } = request.body as { mode: string; limit?: number };
    const startTime = Date.now();

    try {
      if (mode === "seed_and_classify") {
        // ── 1. Clear old data (cascade-safe order) ───────────────────────────
        logInfo("Pipeline: clearing old content data for fresh seed");
        await query(`DELETE FROM classification_result WHERE entity_type = 'content_item'`);
        await query(`DELETE FROM sm_alert WHERE content_id IS NOT NULL`);
        await query(`DELETE FROM translation_record WHERE source_entity_type = 'content_item'`);
        await query(`DELETE FROM entity_extraction WHERE entity_type = 'content_item'`);
        // Delete evidence linked to content items
        await query(`DELETE FROM evidence_item WHERE content_id IS NOT NULL`);
        await query(`DELETE FROM content_item`);

        // ── 2. Ensure demo connector ─────────────────────────────────────────
        let connectorId: string;
        const existing = await query(
          `SELECT connector_id FROM source_connector WHERE platform = 'DEMO_PIPELINE' LIMIT 1`,
        );
        if (existing.rows.length > 0) {
          connectorId = existing.rows[0].connector_id;
        } else {
          const ins = await query(
            `INSERT INTO source_connector (platform, connector_type, config_jsonb, is_active, default_legal_basis, default_retention_days)
             VALUES ('DEMO_PIPELINE', 'MANUAL', '{"source":"pipeline_demo"}'::jsonb, true, 'INVESTIGATION', 365)
             RETURNING connector_id`,
          );
          connectorId = ins.rows[0].connector_id;
        }

        // ── 3. Generate 100 seed posts with unique IDs ───────────────────────
        const seedPosts = buildSeedPosts();
        const items = seedPosts.map(p => ({
          ...p,
          platformPostId: `${p.platformPostId}-${crypto.randomUUID().slice(0, 8)}`,
        }));

        // ── 4. Ingest through full pipeline ──────────────────────────────────
        const result = await ingestItems(items, connectorId);
        const elapsed = Date.now() - startTime;

        logInfo("Pipeline seed_and_classify complete", { ...result, elapsedMs: elapsed });

        return {
          mode: "seed_and_classify",
          result,
          postsSeeded: items.length,
          elapsedMs: elapsed,
        };
      }

      if (mode === "reclassify") {
        const limit = Math.min(rawLimit || 50, 200);
        const items = await query(
          `SELECT ci.content_id, ci.content_text
           FROM content_item ci
           LEFT JOIN classification_result cr
             ON cr.entity_type = 'content_item' AND cr.entity_id = ci.content_id
           WHERE cr.pipeline_metadata IS NULL OR cr.pipeline_metadata = '{}'::jsonb
           ORDER BY ci.ingested_at DESC
           LIMIT $1`,
          [limit],
        );

        let reclassified = 0;
        for (const row of items.rows) {
          try {
            const classification = await classifyContentWithLlm(
              row.content_text,
              0,
              false,
            );

            const nr = classification.narcoticsResult;
            const pipelineMetadata = nr ? {
              normalizedText: nr.normalizedText,
              keywordsFound: nr.keywordsFound,
              slangMatches: nr.slangMatches,
              emojiMatches: nr.emojiMatches,
              transactionSignals: nr.transactionSignals,
              normalizationsApplied: nr.normalizationsApplied,
              substanceCategory: nr.substanceCategory,
              activityType: nr.activityType,
              narcoticsScore: nr.narcoticsScore,
              slangDictionaryVersion: nr.slangDictionaryVersion,
              processingTimeMs: nr.processingTimeMs,
              llmUsed: classification.llmUsed,
              classifiedAt: new Date().toISOString(),
              ...(classification.llmClassification ? {
                llmClassification: {
                  narcoticsRelevance: classification.llmClassification.narcotics_relevance,
                  primaryCategory: classification.llmClassification.primary_category,
                  secondaryCategories: classification.llmClassification.secondary_categories,
                  subReasonScores: classification.llmClassification.sub_reason_scores,
                  matchedEntities: classification.llmClassification.matched_entities,
                  confidenceBand: classification.llmClassification.confidence_band,
                  reviewRecommended: classification.llmClassification.review_recommended,
                  reviewReason: classification.llmClassification.review_reason,
                  finalReasoning: classification.llmClassification.final_reasoning,
                },
              } : {}),
            } : {};

            await query(
              `UPDATE classification_result
               SET category = $2, risk_score = $3, risk_factors = $4,
                   classified_by_llm = $5, llm_confidence = $6,
                   pipeline_metadata = $7, updated_at = NOW()
               WHERE entity_type = 'content_item' AND entity_id = $1`,
              [
                row.content_id,
                classification.category,
                classification.riskScore,
                JSON.stringify(classification.factors || []),
                classification.llmUsed,
                classification.llmConfidence ?? null,
                JSON.stringify(pipelineMetadata),
              ],
            );

            const taxName = normalizeCategoryToTaxonomy(classification.category);
            const catResult = await query(
              `SELECT category_id FROM taxonomy_category WHERE name = $1 LIMIT 1`,
              [taxName],
            );
            if (catResult.rows.length > 0) {
              await query(
                `UPDATE content_item SET category_id = $1, threat_score = $2 WHERE content_id = $3`,
                [catResult.rows[0].category_id, classification.riskScore, row.content_id],
              );
            }

            reclassified++;
          } catch (err) {
            logError("Reclassify failed for content", { contentId: row.content_id, error: String(err) });
          }
        }

        const elapsed = Date.now() - startTime;
        logInfo("Pipeline reclassify complete", { reclassified, total: items.rows.length, elapsedMs: elapsed });

        return {
          mode: "reclassify",
          reclassified,
          total: items.rows.length,
          elapsedMs: elapsed,
        };
      }

      return sendError(reply, 400, "INVALID_MODE", "Mode must be seed_and_classify or reclassify");
    } catch (err) {
      logError("Pipeline run failed", { mode, error: String(err) });
      return sendError(reply, 500, "PIPELINE_ERROR", "Pipeline execution failed");
    }
  });

  /**
   * GET /api/v1/pipeline/status
   * Returns pipeline processing statistics.
   */
  app.get("/api/v1/pipeline/status", async (_request, reply) => {
    try {
      const [totalContent, classified, withMetadata, alertsRecent, categoryBreakdown] = await Promise.all([
        query(`SELECT COUNT(*)::int AS count FROM content_item`),
        query(`SELECT COUNT(*)::int AS count FROM classification_result WHERE entity_type = 'content_item'`),
        query(`SELECT COUNT(*)::int AS count FROM classification_result WHERE entity_type = 'content_item' AND pipeline_metadata IS NOT NULL AND pipeline_metadata != '{}'::jsonb`),
        query(`SELECT COUNT(*)::int AS count FROM sm_alert WHERE created_at > NOW() - interval '1 hour'`),
        query(`SELECT category, COUNT(*)::int AS count, ROUND(AVG(risk_score), 1) AS avg_score FROM classification_result WHERE entity_type = 'content_item' GROUP BY category ORDER BY count DESC LIMIT 20`),
      ]);

      return {
        totalContentItems: totalContent.rows[0]?.count || 0,
        classifiedItems: classified.rows[0]?.count || 0,
        itemsWithPipelineMetadata: withMetadata.rows[0]?.count || 0,
        alertsLastHour: alertsRecent.rows[0]?.count || 0,
        categoryBreakdown: categoryBreakdown.rows,
      };
    } catch (err) {
      return sendError(reply, 500, "INTERNAL_ERROR", "Failed to get pipeline status");
    }
  });
}
