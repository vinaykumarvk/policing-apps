/**
 * LLM provider management, system prompts, and ad-hoc LLM operations.
 */

import { FastifyInstance } from "fastify";
import { query } from "../db";
import {
  llmComplete,
  getActiveProvider,
  testProvider,
  invalidateProviderCache,
  getSystemPrompt,
  type LlmProviderConfig,
  type LlmUseCase,
} from "../services/llm-provider";

type DbRow = Record<string, unknown>;

function maskApiKey(key: string | null): string {
  if (!key) return "";
  if (key.length <= 4) return "****";
  return "****" + key.slice(-4);
}

export async function registerLlmRoutes(app: FastifyInstance) {
  // ── Provider CRUD ────────────────────────────────────────────────────────

  app.get("/api/v1/llm/providers", async (request) => {
    const res = await query(
      `SELECT config_id, provider, display_name, api_base_url, api_key_enc,
              model_id, is_active, is_default, max_tokens, temperature,
              timeout_ms, max_retries, config_jsonb, created_at, updated_at
       FROM llm_provider_config ORDER BY created_at DESC`,
    );
    return {
      providers: res.rows.map((r: DbRow) => ({
        ...r,
        api_key_enc: maskApiKey(r.api_key_enc as string | null),
      })),
    };
  });

  app.post("/api/v1/llm/providers", async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const res = await query(
      `INSERT INTO llm_provider_config
         (provider, display_name, api_base_url, api_key_enc, model_id,
          is_active, is_default, max_tokens, temperature, timeout_ms, max_retries, config_jsonb)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        body.provider,
        body.display_name,
        body.api_base_url,
        body.api_key_enc || null,
        body.model_id,
        body.is_active ?? true,
        body.is_default ?? false,
        body.max_tokens ?? 2048,
        body.temperature ?? 0.3,
        body.timeout_ms ?? 30000,
        body.max_retries ?? 2,
        JSON.stringify(body.config_jsonb || {}),
      ],
    );
    invalidateProviderCache();
    reply.code(201);
    return res.rows[0];
  });

  app.patch("/api/v1/llm/providers/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const setClauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const allowedFields = [
      "provider", "display_name", "api_base_url", "api_key_enc", "model_id",
      "is_active", "is_default", "max_tokens", "temperature", "timeout_ms",
      "max_retries", "config_jsonb",
    ];

    for (const field of allowedFields) {
      if (field in body) {
        const val = field === "config_jsonb" ? JSON.stringify(body[field]) : body[field];
        setClauses.push(`${field} = $${idx}`);
        params.push(val);
        idx++;
      }
    }

    if (setClauses.length === 0) return { error: "No fields to update" };

    setClauses.push(`updated_at = now()`);
    params.push(id);

    const res = await query(
      `UPDATE llm_provider_config SET ${setClauses.join(", ")} WHERE config_id = $${idx} RETURNING *`,
      params,
    );

    invalidateProviderCache();
    return res.rows[0] || { error: "Not found" };
  });

  app.delete("/api/v1/llm/providers/:id", async (request) => {
    const { id } = request.params as { id: string };
    await query(
      `UPDATE llm_provider_config SET is_active = FALSE, is_default = FALSE, updated_at = now()
       WHERE config_id = $1`,
      [id],
    );
    invalidateProviderCache();
    return { success: true };
  });

  app.post("/api/v1/llm/providers/:id/test", async (request) => {
    const { id } = request.params as { id: string };
    const res = await query(`SELECT * FROM llm_provider_config WHERE config_id = $1`, [id]);
    if (res.rows.length === 0) return { success: false, error: "Provider not found" };

    const config = res.rows[0] as unknown as LlmProviderConfig;
    const result = await testProvider(config);
    return result;
  });

  app.post("/api/v1/llm/providers/:id/activate", async (request) => {
    const { id } = request.params as { id: string };

    // Unset previous default
    await query(
      `UPDATE llm_provider_config SET is_default = FALSE, updated_at = now() WHERE is_default = TRUE`,
    );

    // Set new default
    const res = await query(
      `UPDATE llm_provider_config SET is_default = TRUE, is_active = TRUE, updated_at = now()
       WHERE config_id = $1 RETURNING *`,
      [id],
    );

    invalidateProviderCache();
    return res.rows[0] || { error: "Not found" };
  });

  // ── System Prompts ─────────────────────────────────────────────────────────

  app.get("/api/v1/llm/prompts", async () => {
    const res = await query(
      `SELECT prompt_id, use_case, version, prompt_text, is_active, created_at, updated_at
       FROM llm_system_prompt ORDER BY use_case, version DESC`,
    );
    return { prompts: res.rows };
  });

  app.patch("/api/v1/llm/prompts/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const res = await query(
      `UPDATE llm_system_prompt SET prompt_text = $2, updated_at = now()
       WHERE prompt_id = $1 RETURNING *`,
      [id, body.prompt_text],
    );
    return res.rows[0] || { error: "Not found" };
  });

  app.post("/api/v1/llm/prompts", async (request, reply) => {
    const body = request.body as Record<string, unknown>;

    // Deactivate previous versions of same use_case
    if (body.is_active !== false) {
      await query(
        `UPDATE llm_system_prompt SET is_active = FALSE WHERE use_case = $1`,
        [body.use_case],
      );
    }

    // Get next version number
    const vRes = await query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM llm_system_prompt WHERE use_case = $1`,
      [body.use_case],
    );
    const nextVersion = vRes.rows[0].next_version;

    const res = await query(
      `INSERT INTO llm_system_prompt (use_case, version, prompt_text, is_active)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [body.use_case, nextVersion, body.prompt_text, body.is_active ?? true],
    );
    reply.code(201);
    return res.rows[0];
  });

  // ── Status ─────────────────────────────────────────────────────────────────

  app.get("/api/v1/llm/status", async () => {
    return await getActiveProvider();
  });

  // ── Ad-hoc Operations ──────────────────────────────────────────────────────

  app.post("/api/v1/llm/classify", async (request) => {
    const { text } = request.body as { text: string };
    if (!text) return { error: "text is required" };

    const result = await llmComplete({
      messages: [{ role: "user", content: text }],
      useCase: "CLASSIFICATION",
    });

    if (!result) return { mode: "RULES_ONLY", message: "No LLM provider available" };

    try {
      const parsed = JSON.parse(result.content);
      return { ...parsed, provider: result.provider, model: result.model, latencyMs: result.latencyMs };
    } catch {
      return { raw: result.content, provider: result.provider, model: result.model, latencyMs: result.latencyMs };
    }
  });

  app.post("/api/v1/llm/translate", async (request) => {
    const { text, target_language } = request.body as { text: string; target_language?: string };
    if (!text) return { error: "text is required" };

    const prompt = target_language
      ? `Translate the following text to ${target_language}:\n\n${text}`
      : text;

    const result = await llmComplete({
      messages: [{ role: "user", content: prompt }],
      useCase: "TRANSLATION",
    });

    if (!result) return { mode: "RULES_ONLY", message: "No LLM provider available" };

    try {
      const parsed = JSON.parse(result.content);
      return { ...parsed, provider: result.provider, model: result.model, latencyMs: result.latencyMs };
    } catch {
      return { translated_text: result.content, provider: result.provider, model: result.model, latencyMs: result.latencyMs };
    }
  });

  app.post("/api/v1/llm/narcotics-analyze", async (request) => {
    const { text } = request.body as { text: string };
    if (!text) return { error: "text is required" };

    const result = await llmComplete({
      messages: [{ role: "user", content: text }],
      useCase: "NARCOTICS_ANALYSIS",
    });

    if (!result) return { mode: "RULES_ONLY", message: "No LLM provider available" };

    try {
      const parsed = JSON.parse(result.content);
      return { ...parsed, provider: result.provider, model: result.model, latencyMs: result.latencyMs };
    } catch {
      return { raw: result.content, provider: result.provider, model: result.model, latencyMs: result.latencyMs };
    }
  });

  app.post("/api/v1/llm/risk-narrative", async (request) => {
    const body = request.body as Record<string, unknown>;
    const context = JSON.stringify(body);

    const result = await llmComplete({
      messages: [{ role: "user", content: `Generate a risk narrative for the following data:\n\n${context}` }],
      useCase: "RISK_NARRATIVE",
    });

    if (!result) return { mode: "RULES_ONLY", message: "No LLM provider available" };
    return { narrative: result.content, provider: result.provider, model: result.model, latencyMs: result.latencyMs };
  });

  app.post("/api/v1/llm/investigation-summary", async (request) => {
    const body = request.body as Record<string, unknown>;
    const context = JSON.stringify(body);

    const result = await llmComplete({
      messages: [{ role: "user", content: `Generate an investigation summary for:\n\n${context}` }],
      useCase: "INVESTIGATION_SUMMARY",
    });

    if (!result) return { mode: "RULES_ONLY", message: "No LLM provider available" };
    return { summary: result.content, provider: result.provider, model: result.model, latencyMs: result.latencyMs };
  });

  // ── Prediction Log ─────────────────────────────────────────────────────────

  app.get("/api/v1/llm/predictions", async (request) => {
    const qs = request.query as Record<string, string>;
    const page = Math.max(1, parseInt(qs.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(qs.limit || "50", 10)));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (qs.use_case) {
      conditions.push(`use_case = $${idx++}`);
      params.push(qs.use_case);
    }
    if (qs.provider) {
      conditions.push(`provider = $${idx++}`);
      params.push(qs.provider);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query(`SELECT COUNT(*) FROM model_prediction_log ${where}`, params);
    const total = parseInt(countRes.rows[0].count as string, 10);

    const dataRes = await query(
      `SELECT log_id, provider, model_name, prompt_tokens, output_tokens,
              use_case, entity_type, entity_id, latency_ms, fallback_used, created_at
       FROM model_prediction_log ${where}
       ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    );

    return { predictions: dataRes.rows, total, page, limit };
  });
}
