import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";
import { createRoleGuard } from "@puda/api-core";
import { ingestItems } from "../connectors/ingestion-pipeline";
import type { FetchedItem } from "../connectors/types";

const requireAnalyst = createRoleGuard(["ANALYST", "SUPERVISOR", "PLATFORM_ADMINISTRATOR"]);

export async function registerContentRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/content", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          platform: { type: "string", maxLength: 500 },
          category_id: { type: "string", maxLength: 500 },
          language: { type: "string", maxLength: 100 },
          author: { type: "string", maxLength: 256 },
          threat_score_min: { type: "string", maxLength: 10 },
          date_range: { type: "string", maxLength: 10 },
          retention_expired: { type: "string", maxLength: 10 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const q = request.query as Record<string, string | undefined>;
      const limit = Math.min(Math.max(parseInt(q.limit || "50", 10) || 50, 1), 200);
      const offset = Math.max(parseInt(q.offset || "0", 10) || 0, 0);

      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      // Platform filter (comma-separated)
      if (q.platform) {
        const platforms = q.platform.split(",").filter(Boolean);
        if (platforms.length > 0) {
          conditions.push(`ci.platform = ANY($${idx}::text[])`);
          params.push(platforms);
          idx++;
        }
      }

      // Category filter (comma-separated UUIDs)
      if (q.category_id) {
        const cats = q.category_id.split(",").filter(Boolean);
        if (cats.length > 0) {
          conditions.push(`ci.category_id = ANY($${idx}::uuid[])`);
          params.push(cats);
          idx++;
        }
      }

      // Language filter (comma-separated)
      if (q.language) {
        const langs = q.language.split(",").filter(Boolean);
        if (langs.length > 0) {
          conditions.push(`ci.language = ANY($${idx}::text[])`);
          params.push(langs);
          idx++;
        }
      }

      // Author filter (partial match)
      if (q.author) {
        conditions.push(`ci.author_handle ILIKE '%' || $${idx} || '%'`);
        params.push(q.author);
        idx++;
      }

      // Threat score min
      const scoreMin = parseInt(q.threat_score_min || "0", 10);
      if (scoreMin > 0) {
        conditions.push(`COALESCE(ci.threat_score, 0) >= $${idx}`);
        params.push(scoreMin);
        idx++;
      }

      // Date range
      if (q.date_range === "today") {
        conditions.push(`ci.published_at >= CURRENT_DATE`);
      } else if (q.date_range === "7d") {
        conditions.push(`ci.published_at >= CURRENT_DATE - INTERVAL '7 days'`);
      } else if (q.date_range === "30d") {
        conditions.push(`ci.published_at >= CURRENT_DATE - INTERVAL '30 days'`);
      }

      // Retention expired
      if (q.retention_expired === "true") {
        conditions.push(`ci.retention_until IS NOT NULL AND ci.retention_until < NOW()`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const limitIdx = idx;
      const offsetIdx = idx + 1;
      params.push(limit, offset);

      const result = await query(
        `SELECT ci.content_id, ci.platform, ci.author_handle, ci.author_name, ci.content_text, ci.content_url,
                ci.language, ci.sentiment, ci.category_id, tc.name AS category_name, ci.threat_score,
                ci.legal_basis, ci.retention_until, ci.retention_flagged,
                ci.published_at, ci.ingested_at,
                cr.category AS classification_category,
                cr.risk_score AS classification_risk_score,
                cr.classified_by_llm,
                cr.llm_confidence,
                cr.review_status,
                COALESCE(cr.category, tc.name) AS effective_category,
                COUNT(*) OVER() AS total_count
         FROM content_item ci
         LEFT JOIN taxonomy_category tc ON tc.category_id = ci.category_id
         LEFT JOIN classification_result cr
           ON cr.entity_type = 'content_item' AND cr.entity_id = ci.content_id
         ${whereClause}
         ORDER BY ci.ingested_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params,
      );
      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      return { content: result.rows.map(({ total_count, ...r }: Record<string, unknown>) => r), total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list content");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.get("/api/v1/content/facets", async () => {
    const [platformRows, categoryRows, languageRows] = await Promise.all([
      query(`SELECT platform AS value, COUNT(*)::int AS count FROM content_item GROUP BY platform ORDER BY count DESC`, []),
      query(`SELECT ci.category_id AS value, tc.name AS label, COUNT(*)::int AS count FROM content_item ci LEFT JOIN taxonomy_category tc ON tc.category_id = ci.category_id WHERE ci.category_id IS NOT NULL GROUP BY ci.category_id, tc.name ORDER BY count DESC`, []),
      query(`SELECT language AS value, COUNT(*)::int AS count FROM content_item WHERE language IS NOT NULL AND language != '' GROUP BY language ORDER BY count DESC`, []),
    ]);

    const langLabelMap: Record<string, string> = { en: "English", te: "Telugu", hi: "Hindi", pa: "Punjabi", ur: "Urdu", ta: "Tamil", kn: "Kannada", ml: "Malayalam" };
    const languageFacets = languageRows.rows.map((r: { value: string; count: number }) => ({
      ...r,
      label: langLabelMap[r.value] || r.value,
    }));

    return { facets: { platform: platformRows.rows, category_id: categoryRows.rows, language: languageFacets } };
  });

  // FR-03: POST /api/v1/content/ingest — Ingest content with legal basis and retention (ANALYST+)
  app.post("/api/v1/content/ingest", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["platform", "contentText", "legalBasis"],
        properties: {
          platform: { type: "string", maxLength: 64 },
          platformPostId: { type: "string", maxLength: 256 },
          authorHandle: { type: "string", maxLength: 256 },
          authorName: { type: "string", maxLength: 256 },
          contentText: { type: "string" },
          contentUrl: { type: "string" },
          language: { type: "string", maxLength: 8 },
          legalBasis: { type: "string", enum: ["COURT_ORDER", "INVESTIGATION", "PUBLIC_INTEREST", "REGULATORY", "CONSENT", "NATIONAL_SECURITY"] },
          retentionDays: { type: "integer", minimum: 1 },
          connectorId: { type: "string", format: "uuid" },
          metadataJsonb: { type: "object" },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireAnalyst(request, reply)) return;
    try {
      const body = request.body as {
        platform: string; platformPostId?: string; authorHandle?: string; authorName?: string;
        contentText: string; contentUrl?: string; language?: string;
        legalBasis: string; retentionDays?: number; connectorId?: string; metadataJsonb?: Record<string, unknown>;
      };

      // Calculate retention_until
      let retentionDays = body.retentionDays || 365;
      if (body.connectorId && !body.retentionDays) {
        const connResult = await query(
          `SELECT default_retention_days FROM source_connector WHERE connector_id = $1`,
          [body.connectorId],
        );
        if (connResult.rows.length > 0 && connResult.rows[0].default_retention_days) {
          retentionDays = connResult.rows[0].default_retention_days;
        }
      }
      const retentionUntil = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

      const result = await query(
        `INSERT INTO content_item (connector_id, platform, platform_post_id, author_handle, author_name,
                content_text, content_url, language, legal_basis, retention_until, metadata_jsonb)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING content_id, platform, author_handle, content_url, legal_basis, retention_until, ingested_at`,
        [
          body.connectorId || null, body.platform, body.platformPostId || null,
          body.authorHandle || null, body.authorName || null,
          body.contentText, body.contentUrl || null, body.language || null,
          body.legalBasis, retentionUntil, JSON.stringify(body.metadataJsonb || {}),
        ],
      );
      reply.code(201);
      return { content: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to ingest content");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.get("/api/v1/content/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(
        `SELECT ci.content_id, ci.connector_id, ci.platform, ci.platform_post_id, ci.author_handle, ci.author_name,
                ci.content_text, ci.content_url, ci.language, ci.sentiment, ci.category_id, tc.name AS category_name,
                ci.threat_score, ci.metadata_jsonb, ci.published_at, ci.ingested_at, ci.created_at,
                cr.category AS classification_category,
                cr.risk_score AS classification_risk_score,
                cr.classified_by_llm,
                cr.llm_confidence,
                cr.review_status,
                cr.risk_factors,
                cr.pipeline_metadata,
                COALESCE(cr.category, tc.name) AS effective_category
         FROM content_item ci
         LEFT JOIN taxonomy_category tc ON tc.category_id = ci.category_id
         LEFT JOIN classification_result cr
           ON cr.entity_type = 'content_item' AND cr.entity_id = ci.content_id
         WHERE ci.content_id = $1`,
        [id],
      );
      if (result.rows.length === 0) {
        return send404(reply, "CONTENT_NOT_FOUND", "Content item not found");
      }
      return { content: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get content item");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/content/fetch-demo — Fetch 25 demo posts (5 per platform, 3 EN + 2 TE)
  // Posts are run through the full ingestion pipeline (classification + alert creation).
  // Posts with threat_score >= 50 automatically generate alerts.
  app.post("/api/v1/content/fetch-demo", async (_request, reply) => {
    try {
      // Ensure a demo connector exists
      let connectorId: string;
      const existing = await query(
        `SELECT connector_id FROM source_connector WHERE platform = 'DEMO_FETCH' LIMIT 1`,
      );
      if (existing.rows.length > 0) {
        connectorId = existing.rows[0].connector_id;
      } else {
        const ins = await query(
          `INSERT INTO source_connector (platform, connector_type, config_jsonb, is_active, default_legal_basis, default_retention_days)
           VALUES ('DEMO_FETCH', 'MANUAL', '{"source":"fetch_demo"}'::jsonb, true, 'INVESTIGATION', 365)
           RETURNING connector_id`,
        );
        connectorId = ins.rows[0].connector_id;
      }

      const demoPosts: Array<{ platform: string; lang: string; author: string; name: string; text: string }> = [
        // TWITTER — 3 English
        { platform: "TWITTER", lang: "en", author: "@news_updates_in", name: "News Updates India", text: "Breaking: Cyber crime cell busts online fraud ring operating across 5 states. 12 arrests made. #CyberCrime #DigitalSafety" },
        { platform: "TWITTER", lang: "en", author: "@safety_watch_org", name: "Safety Watch", text: "New research shows alarming rise in online drug markets targeting youth. Authorities need to step up monitoring. #OnlineSafety" },
        { platform: "TWITTER", lang: "en", author: "@quick_delivery_99", name: "Quick Delivery", text: "Fresh stock landed 🍃💊 Premium quality. DM for menu. Fast delivery all metros. Telegram only 📦🚀 Serious buyers only." },
        // TWITTER — 2 Telugu
        { platform: "TWITTER", lang: "te", author: "@telangana_news_te", name: "తెలంగాణ న్యూస్", text: "హైదరాబాద్ లో ఆన్‌లైన్ మోసగాళ్ల అరెస్ట్. సైబర్ క్రైమ్ పోలీసుల విజయవంతమైన ఆపరేషన్. #సైబర్‌క్రైమ్" },
        { platform: "TWITTER", lang: "te", author: "@supply_hyd_te", name: "Supply HYD", text: "సరుకు అన్ని రకాలు అందుబాటులో ఉన్నాయి. మందు కావాలంటే DM చేయండి. హైదరాబాద్ లో డెలివరీ 📦" },

        // FACEBOOK — 3 English
        { platform: "FACEBOOK", lang: "en", author: "community_watch_hyd", name: "Hyderabad Community Watch", text: "Community alert: Suspicious activity reported near school zone. If you see anything unusual, contact local police immediately." },
        { platform: "FACEBOOK", lang: "en", author: "party_central_deals", name: "Party Central", text: "Looking for premium quality products? We got everything. Best prices guaranteed. Cash on delivery available. DM now 🎉📦" },
        { platform: "FACEBOOK", lang: "en", author: "digital_awareness_in", name: "Digital Awareness India", text: "Digital literacy workshop this Saturday at Town Hall. Learn to protect yourself from online scams. Free entry for all!" },
        // FACEBOOK — 2 Telugu
        { platform: "FACEBOOK", lang: "te", author: "vijayawada_youth_te", name: "విజయవాడ యూత్", text: "విజయవాడలో డ్రగ్ వ్యతిరేక ర్యాలీ. యువత భాగస్వామ్యంతో పెద్ద ఎత్తున నిర్వహణ. #డ్రగ్‌ఫ్రీఏపీ" },
        { platform: "FACEBOOK", lang: "te", author: "ap_crime_watch_te", name: "AP Crime Watch", text: "గంజాయి మొక్కల సాగు కేసులో ఇద్దరు అరెస్ట్. తూర్పు గోదావరి జిల్లాలో పోలీసుల చర్య." },

        // INSTAGRAM — 3 English
        { platform: "INSTAGRAM", lang: "en", author: "@hyd_photographer", name: "Hyd Photographer", text: "Beautiful morning at Hussain Sagar lake 🌅 Hyderabad never fails to amaze. #HyderabadDiaries #Photography" },
        { platform: "INSTAGRAM", lang: "en", author: "@premium_imports_01", name: "Premium Imports", text: "💊❄️🍃 All available. Premium imported quality. Discreet packaging. Pan India shipping. DM for rates 📦💰" },
        { platform: "INSTAGRAM", lang: "en", author: "@fit_hyderabad", name: "Fit Hyderabad", text: "New gym opened near Banjara Hills! State-of-the-art equipment. First month free. #FitnessGoals #Hyderabad" },
        // INSTAGRAM — 2 Telugu
        { platform: "INSTAGRAM", lang: "te", author: "@foodie_hyd_te", name: "Foodie HYD", text: "హైదరాబాద్ బిర్యానీ — ఎప్పటికీ నంబర్ వన్! ఈ రోజు షాహ్ ఘర్ లో భోజనం 🍛 #హైదరాబాదీ" },
        { platform: "INSTAGRAM", lang: "te", author: "@fresh_stock_te", name: "Fresh Stock", text: "తాజా సరుకు వచ్చింది 🔥 అన్ని రకాల పొడి, మందు. ధరలకు DM చేయండి. డిస్క్రీట్ డెలివరీ 📦" },

        // YOUTUBE — 3 English
        { platform: "YOUTUBE", lang: "en", author: "investigative_media", name: "Investigative Media", text: "EXPOSED: How drug dealers use social media to sell narcotics openly. Investigation report reveals shocking details." },
        { platform: "YOUTUBE", lang: "en", author: "travel_telangana", name: "Travel Telangana", text: "Top 10 must-visit places in Telangana. From ancient temples to modern tech parks. Travel guide 2026." },
        { platform: "YOUTUBE", lang: "en", author: "legal_help_india", name: "Legal Help India", text: "How to file a cyber crime complaint online — Step by step guide for Indian citizens. Official process explained." },
        // YOUTUBE — 2 Telugu
        { platform: "YOUTUBE", lang: "te", author: "telangana_report_te", name: "Telangana Report", text: "తెలంగాణ పోలీసుల NDPS ఆపరేషన్ — 50 కోట్ల విలువైన డ్రగ్స్ స్వాధీనం. పూర్తి వివరాలు." },
        { platform: "YOUTUBE", lang: "te", author: "digital_telugu_te", name: "Digital Telugu", text: "ఆన్‌లైన్ సేఫ్టీ టిప్స్ — మీ పిల్లలను సైబర్ నేరాల నుండి ఎలా కాపాడాలి. తెలుగులో పూర్తి గైడ్." },

        // TELEGRAM — 3 English
        { platform: "TELEGRAM", lang: "en", author: "channel_admin_x", name: "Channel Admin", text: "New batch ready. Purest quality in the market. Minimum order 5g. Payment crypto or UPI. DM admin for menu." },
        { platform: "TELEGRAM", lang: "en", author: "tech_digest_daily", name: "Tech Digest", text: "Daily tech news digest: AI developments, startup funding, policy updates. Subscribe for curated content." },
        { platform: "TELEGRAM", lang: "en", author: "jobs_hyderabad", name: "Jobs Hyderabad", text: "Job openings in IT sector: 50+ positions in Hyderabad. Share your resume with HR. Walk-in interviews this week." },
        // TELEGRAM — 2 Telugu
        { platform: "TELEGRAM", lang: "te", author: "channel_te_admin", name: "Channel Admin TE", text: "సరుకు రెడీగా ఉంది. ప్రీమియం క్వాలిటీ. మినిమం ఆర్డర్ 10g. ధరల కోసం అడ్మిన్‌ని సంప్రదించండి." },
        { platform: "TELEGRAM", lang: "te", author: "telugu_news_channel", name: "Telugu News Channel", text: "రోజువారీ వార్తలు: తెలంగాణ, ఆంధ్రప్రదేశ్ నుండి ముఖ్యమైన అప్‌డేట్లు. సబ్‌స్క్రైబ్ చేయండి." },
      ];

      // Convert to FetchedItem format for the ingestion pipeline
      const items: FetchedItem[] = demoPosts.map(p => {
        const daysAgo = Math.random() * 7;
        return {
          platformPostId: `fetch-${p.platform.toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 1e8)}`,
          platform: p.platform,
          authorHandle: p.author,
          authorName: p.name,
          contentText: p.text,
          contentUrl: "",
          language: p.lang,
          publishedAt: new Date(Date.now() - daysAgo * 86400000),
          metadata: { source: "fetch_demo" },
        };
      });

      // Run through full ingestion pipeline: classify, score, create alerts for threat_score >= 50
      const result = await ingestItems(items, connectorId);

      return {
        inserted: result.inserted,
        duplicates: result.duplicates,
        alertsCreated: result.alertsCreated,
        total: demoPosts.length,
      };
    } catch (err: unknown) {
      _request.log.error(err, "Failed to fetch demo posts");
      return sendError(reply, 500, "INTERNAL_ERROR", "Failed to fetch demo posts");
    }
  });
}
