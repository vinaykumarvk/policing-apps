import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";
import { createRoleGuard } from "@puda/api-core";
import { executeTransition } from "../workflow-bridge";
import { getAvailableTransitions } from "../workflow-bridge/transitions";
import { generateAndLogWatermark } from "../services/watermark";

const requireAnalyst = createRoleGuard(["ANALYST", "SUPERVISOR", "PLATFORM_ADMINISTRATOR"]);

export async function registerAlertRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/alerts", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          state_id: { type: "string", maxLength: 100 },
          priority: { type: "string", maxLength: 50 },
          alert_type: { type: "string", maxLength: 100 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { state_id, priority, alert_type, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
      const unitId = request.authUser?.unitId || null;
      const limit = Math.min(Math.max(parseInt(rawLimit || "50", 10) || 50, 1), 200);
      const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);
      const result = await query(
        `SELECT alert_id, alert_ref, alert_type, priority, title, description, content_id,
                category_id, state_id, assigned_to, created_at,
                COUNT(*) OVER() AS total_count
         FROM sm_alert
         WHERE ($1::text IS NULL OR state_id = $1)
           AND ($2::text IS NULL OR priority = $2)
           AND ($3::text IS NULL OR alert_type = $3)
           AND (unit_id IS NULL OR unit_id = $4::uuid OR unit_id IN (SELECT unit_id FROM organization_unit WHERE parent_unit_id = $4::uuid))
         ORDER BY created_at DESC
         LIMIT $5 OFFSET $6`,
        [state_id || null, priority || null, alert_type || null, unitId, limit, offset],
      );
      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      return { alerts: result.rows.map(({ total_count, ...r }) => r), total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list alerts");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.get("/api/v1/alerts/facets", async (request) => {
    const unitId = request.authUser?.unitId || null;
    const unitClause = `(unit_id IS NULL OR unit_id = $1::uuid OR unit_id IN (SELECT unit_id FROM organization_unit WHERE parent_unit_id = $1::uuid))`;
    const [stateRows, priorityRows, typeRows] = await Promise.all([
      query(`SELECT state_id AS value, COUNT(*)::int AS count FROM sm_alert WHERE ${unitClause} GROUP BY state_id ORDER BY count DESC`, [unitId]),
      query(`SELECT priority AS value, COUNT(*)::int AS count FROM sm_alert WHERE ${unitClause} GROUP BY priority ORDER BY count DESC`, [unitId]),
      query(`SELECT alert_type AS value, COUNT(*)::int AS count FROM sm_alert WHERE ${unitClause} GROUP BY alert_type ORDER BY count DESC`, [unitId]),
    ]);
    return { facets: { state_id: stateRows.rows, priority: priorityRows.rows, alert_type: typeRows.rows } };
  });

  app.get("/api/v1/alerts/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(
        `SELECT alert_id, alert_ref, alert_type, priority, title, description, content_id,
                category_id, state_id, row_version, assigned_to, due_at, created_at, updated_at
         FROM sm_alert WHERE alert_id = $1`,
        [id],
      );
      if (result.rows.length === 0) {
        return send404(reply, "ALERT_NOT_FOUND", "Alert not found");
      }
      return { alert: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get alert");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.get("/api/v1/alerts/:id/transitions", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(`SELECT state_id FROM sm_alert WHERE alert_id = $1`, [id]);
      if (result.rows.length === 0) return send404(reply, "ALERT_NOT_FOUND", "Alert not found");
      return { transitions: getAvailableTransitions("sm_alert", result.rows[0].state_id) };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get alert transitions");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.post("/api/v1/alerts/:id/transition", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, required: ["transitionId"], properties: { transitionId: { type: "string" }, remarks: { type: "string" } } },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { transitionId, remarks } = request.body as { transitionId: string; remarks?: string };
      const { userId, roles } = request.authUser!;

      const result = await executeTransition(
        id, "sm_alert", transitionId, userId, "OFFICER", roles, remarks,
      );
      if (!result.success) {
        if (result.error === "ENTITY_NOT_FOUND") return send404(reply, "ALERT_NOT_FOUND", "Alert not found");
        return sendError(reply, 409, result.error || "TRANSITION_FAILED", "Alert transition failed");
      }
      return { success: true, newStateId: result.newStateId };
    } catch (err: unknown) {
      request.log.error(err, "Failed to execute alert transition");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/alerts/:id/actions — Alert actions: ACKNOWLEDGE, ESCALATE, SHARE, DISMISS
  app.post("/api/v1/alerts/:id/actions", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        required: ["actionType"],
        properties: {
          actionType: { type: "string", enum: ["ACKNOWLEDGE", "ESCALATE", "SHARE", "DISMISS"] },
          notes: { type: "string" },
          assignTo: { type: "string", format: "uuid" },
          sharedWith: { type: "string" },
          shareType: { type: "string", enum: ["INTERNAL", "EXTERNAL_AGENCY", "PLATFORM_REPORT"] },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireAnalyst(request, reply)) return;
    try {
      const { id } = request.params as { id: string };
      const { actionType, notes, assignTo, sharedWith, shareType } = request.body as {
        actionType: string; notes?: string; assignTo?: string; sharedWith?: string; shareType?: string;
      };
      const { userId } = request.authUser!;

      // Verify alert exists
      const alertResult = await query(`SELECT alert_id, state_id FROM sm_alert WHERE alert_id = $1`, [id]);
      if (alertResult.rows.length === 0) return send404(reply, "ALERT_NOT_FOUND", "Alert not found");

      switch (actionType) {
        case "ACKNOWLEDGE": {
          await query(
            `UPDATE sm_alert SET state_id = 'ACKNOWLEDGED', assigned_to = COALESCE($1, assigned_to), updated_at = NOW(), row_version = row_version + 1
             WHERE alert_id = $2`,
            [assignTo || userId, id],
          );
          return { success: true, action: "ACKNOWLEDGE", alertId: id };
        }
        case "ESCALATE": {
          const newPriority = alertResult.rows[0].priority === "HIGH" ? "CRITICAL" : "HIGH";
          await query(
            `UPDATE sm_alert SET priority = $1, assigned_to = $2, state_id = 'ESCALATED', updated_at = NOW(), row_version = row_version + 1
             WHERE alert_id = $3`,
            [newPriority, assignTo || null, id],
          );
          return { success: true, action: "ESCALATE", alertId: id, newPriority };
        }
        case "SHARE": {
          if (!sharedWith) return sendError(reply, 400, "MISSING_FIELD", "sharedWith is required for SHARE action");
          await query(
            `INSERT INTO alert_share (alert_id, shared_with, share_type, shared_by, notes)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, sharedWith, shareType || "INTERNAL", userId, notes || null],
          );
          return { success: true, action: "SHARE", alertId: id, sharedWith };
        }
        case "DISMISS": {
          await query(
            `UPDATE sm_alert SET state_id = 'DISMISSED', updated_at = NOW(), row_version = row_version + 1
             WHERE alert_id = $1`,
            [id],
          );
          return { success: true, action: "DISMISS", alertId: id };
        }
        default:
          return sendError(reply, 400, "INVALID_ACTION", `Unknown action: ${actionType}`);
      }
    } catch (err: unknown) {
      request.log.error(err, "Failed to execute alert action");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/alerts/:id/shares — List shares for an alert
  app.get("/api/v1/alerts/:id/shares", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(
        `SELECT share_id, shared_with, share_type, shared_by, notes, shared_at
         FROM alert_share WHERE alert_id = $1 ORDER BY shared_at DESC`,
        [id],
      );
      return { shares: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list alert shares");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // FR-07: GET /api/v1/alerts/queue/:queueName — List alerts in a specific priority queue
  app.get("/api/v1/alerts/queue/:queueName", {
    schema: {
      params: {
        type: "object",
        additionalProperties: false,
        required: ["queueName"],
        properties: {
          queueName: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"] },
        },
      },
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { queueName } = request.params as { queueName: string };
      const { limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
      const unitId = request.authUser?.unitId || null;
      const limit = Math.min(Math.max(parseInt(rawLimit || "50", 10) || 50, 1), 200);
      const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);
      const result = await query(
        `SELECT a.alert_id, a.alert_ref, a.alert_type, a.priority, a.priority_queue, a.title, a.description,
                a.content_id, a.category_id, a.state_id, a.assigned_to, a.created_at,
                cr.risk_score,
                COUNT(*) OVER() AS total_count
         FROM sm_alert a
         LEFT JOIN classification_result cr ON cr.entity_type = 'sm_alert' AND cr.entity_id = a.alert_id
         WHERE a.priority_queue = $1
           AND (a.unit_id IS NULL OR a.unit_id = $2::uuid)
           AND a.state_id NOT IN ('DISMISSED', 'FALSE_POSITIVE', 'CLOSED')
         ORDER BY cr.risk_score DESC NULLS LAST, a.created_at DESC
         LIMIT $3 OFFSET $4`,
        [queueName, unitId, limit, offset],
      );
      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      return { queue: queueName, alerts: result.rows.map(({ total_count, ...r }) => r), total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list alerts by queue");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/alerts/:id/recalculate — Re-run risk scoring
  app.post("/api/v1/alerts/:id/recalculate", {
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(
        `SELECT alert_id, alert_type, priority, category_id, content_id FROM sm_alert WHERE alert_id = $1`,
        [id],
      );
      if (result.rows.length === 0) return send404(reply, "ALERT_NOT_FOUND", "Alert not found");

      const alert = result.rows[0];

      // Recalculate risk score based on category and content virality
      let riskScore = 0;
      const priorityMap: Record<number, string> = { 1: "LOW", 2: "MEDIUM", 3: "HIGH", 4: "CRITICAL" };

      // Factor 1: Category risk weight
      if (alert.category_id) {
        const catResult = await query(
          `SELECT risk_weight FROM taxonomy_category WHERE category_id = $1`,
          [alert.category_id],
        );
        if (catResult.rows.length > 0) {
          riskScore += (catResult.rows[0].risk_weight || 1) * 25;
        }
      }

      // Factor 2: Content virality metrics
      if (alert.content_id) {
        const contentResult = await query(
          `SELECT share_count, view_count, like_count FROM content_item WHERE content_id = $1`,
          [alert.content_id],
        );
        if (contentResult.rows.length > 0) {
          const c = contentResult.rows[0];
          const virality = (c.share_count || 0) * 3 + (c.view_count || 0) * 0.01 + (c.like_count || 0);
          if (virality > 10000) riskScore += 40;
          else if (virality > 1000) riskScore += 25;
          else if (virality > 100) riskScore += 10;
        }
      }

      // Factor 3: Alert type weight
      if (alert.alert_type === "TERRORISM" || alert.alert_type === "CHILD_EXPLOITATION") riskScore += 35;
      else if (alert.alert_type === "HATE_SPEECH" || alert.alert_type === "DRUG_TRAFFICKING") riskScore += 25;
      else if (alert.alert_type === "COMMUNAL_TENSION") riskScore += 20;
      else riskScore += 10;

      // Determine new priority
      const newPriority = riskScore >= 80 ? "CRITICAL" : riskScore >= 55 ? "HIGH" : riskScore >= 30 ? "MEDIUM" : "LOW";

      // FR-07: Assign priority_queue based on normalized risk score (0-100 scale mapped to 0-1)
      const normalizedScore = riskScore / 100;
      const priorityQueue = normalizedScore >= 0.9 ? "CRITICAL"
        : normalizedScore >= 0.7 ? "HIGH"
        : normalizedScore >= 0.4 ? "MEDIUM"
        : "LOW";

      // Update alert with priority and queue assignment
      await query(
        `UPDATE sm_alert SET priority = $1, priority_queue = $2, updated_at = NOW() WHERE alert_id = $3`,
        [newPriority, priorityQueue, id],
      );

      return {
        alertId: id,
        previousPriority: alert.priority,
        newPriority,
        priorityQueue,
        riskScore,
        recalculatedAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      request.log.error(err, "Failed to recalculate alert score");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/alerts/:id/screenshot — Capture screenshot evidence for alert
  app.post("/api/v1/alerts/:id/screenshot", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    if (!requireAnalyst(request, reply)) return;
    try {
      const { id } = request.params as { id: string };
      const { userId } = request.authUser!;

      // Look up alert and its content_url
      const alertResult = await query(
        `SELECT a.alert_id, a.content_id, c.content_url, c.platform, c.author_handle
         FROM sm_alert a
         LEFT JOIN content_item c ON c.content_id = a.content_id
         WHERE a.alert_id = $1`,
        [id],
      );
      if (alertResult.rows.length === 0) return send404(reply, "ALERT_NOT_FOUND", "Alert not found");

      const alert = alertResult.rows[0];
      const contentUrl = alert.content_url || "N/A";
      const contentId = alert.content_id;
      const timestamp = Date.now();

      // Save screenshot metadata as evidence
      const filePath = `screenshots/${contentId || id}_${timestamp}.txt`;

      // Write a placeholder screenshot file
      const fs = await import("fs");
      const path = await import("path");
      const dir = path.join(process.cwd(), "evidence-local", "screenshots");
      fs.mkdirSync(dir, { recursive: true });
      const fullPath = path.join(dir, `${contentId || id}_${timestamp}.txt`);
      fs.writeFileSync(fullPath, `Screenshot capture record\nURL: ${contentUrl}\nPlatform: ${alert.platform || "unknown"}\nAuthor: ${alert.author_handle || "unknown"}\nAlert ID: ${id}\nCaptured at: ${new Date().toISOString()}\nCaptured by: ${userId}\n`);

      // Compute hash
      const crypto = await import("crypto");
      const fileContent = fs.readFileSync(fullPath);
      const hash = crypto.createHash("sha256").update(fileContent).digest("hex");

      // Insert evidence record
      const evidenceResult = await query(
        `INSERT INTO evidence_item (content_id, alert_id, capture_type, screenshot_url, hash_sha256, state_id, captured_by)
         VALUES ($1, $2, 'MANUAL_SCREENSHOT', $3, $4, 'CAPTURED', $5)
         RETURNING evidence_id, content_id, alert_id, capture_type, screenshot_url, hash_sha256, state_id, captured_by, created_at`,
        [contentId, id, filePath, hash, userId],
      );

      return { success: true, evidence: evidenceResult.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to capture screenshot");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/alerts/:id/convert-to-case — Convert alert to a case
  app.post("/api/v1/alerts/:id/convert-to-case", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    if (!requireAnalyst(request, reply)) return;
    try {
      const { id } = request.params as { id: string };
      const { userId } = request.authUser!;

      // Verify alert exists and is convertible
      const alertResult = await query(
        `SELECT alert_id, title, description, content_id, priority, state_id
         FROM sm_alert WHERE alert_id = $1`,
        [id],
      );
      if (alertResult.rows.length === 0) return send404(reply, "ALERT_NOT_FOUND", "Alert not found");

      const alert = alertResult.rows[0];
      const terminalStates = ["CONVERTED_TO_CASE", "CLOSED_NO_ACTION", "FALSE_POSITIVE", "DISMISSED", "CLOSED"];
      if (terminalStates.includes(alert.state_id)) {
        return sendError(reply, 400, "INVALID_STATE", `Alert is in state ${alert.state_id} and cannot be converted`);
      }

      // Create case record
      const unitId = request.authUser?.unitId || null;
      const caseResult = await query(
        `INSERT INTO case_record (title, description, source_alert_id, priority, state_id, created_by, unit_id)
         VALUES ($1, $2, $3, $4, 'OPEN', $5, $6)
         RETURNING case_id, case_ref`,
        [alert.title, alert.description || "", id, alert.priority || "MEDIUM", userId, unitId],
      );
      const newCase = caseResult.rows[0];

      // Update alert state to CONVERTED_TO_CASE
      await query(
        `UPDATE sm_alert SET state_id = 'CONVERTED_TO_CASE', updated_at = NOW(), row_version = row_version + 1
         WHERE alert_id = $1`,
        [id],
      );

      // Link any evidence attached to this alert to the new case
      await query(
        `UPDATE evidence_item SET case_id = $1 WHERE alert_id = $2 AND case_id IS NULL`,
        [newCase.case_id, id],
      );

      // Link content to case if alert has content_id
      if (alert.content_id) {
        await query(
          `INSERT INTO case_content (case_id, content_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [newCase.case_id, alert.content_id],
        ).catch(() => { /* table may not exist, non-critical */ });
      }

      // Audit log
      await query(
        `INSERT INTO audit_log (entity_type, entity_id, event_type, from_state, to_state, actor_type, actor_id, remarks)
         VALUES ('sm_alert', $1, 'CONVERT_TO_CASE', $2, 'CONVERTED_TO_CASE', 'OFFICER', $3, $4)`,
        [id, alert.state_id, userId, `Converted to case ${newCase.case_ref || newCase.case_id}`],
      );

      return { success: true, case_id: newCase.case_id, case_ref: newCase.case_ref };
    } catch (err: unknown) {
      request.log.error(err, "Failed to convert alert to case");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // FR-10 AC-03: POST /api/v1/alerts/:id/export — Export alert with watermark
  app.post("/api/v1/alerts/:id/export", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      querystring: { type: "object", additionalProperties: false, properties: { format: { type: "string", enum: ["json", "csv"], default: "json" } } },
    },
  }, async (request, reply) => {
    if (!requireAnalyst(request, reply)) return;
    try {
      const { id } = request.params as { id: string };
      const qs = request.query as { format?: string };
      const { userId } = request.authUser!;

      const result = await query(
        `SELECT a.alert_id, a.alert_ref, a.alert_type, a.priority, a.title, a.description,
                a.content_id, a.category_id, a.state_id, a.assigned_to, a.created_at, a.updated_at,
                cr.category AS classification_category, cr.risk_score
         FROM sm_alert a
         LEFT JOIN classification_result cr ON cr.entity_type = 'sm_alert' AND cr.entity_id = a.alert_id
         WHERE a.alert_id = $1`,
        [id],
      );
      if (result.rows.length === 0) return send404(reply, "ALERT_NOT_FOUND", "Alert not found");

      const alert = result.rows[0];

      // Generate watermark for export tracking
      const watermarkText = await generateAndLogWatermark(userId, "sm_alert", id, "ALERT_EXPORT");

      if (qs.format === "csv") {
        const headers = Object.keys(alert).join(",");
        const values = Object.values(alert).map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
        const csv = `${headers}\n${values}\n\nWatermark: ${watermarkText}`;
        reply.header("Content-Type", "text/csv");
        reply.header("Content-Disposition", `attachment; filename="alert-${id}.csv"`);
        reply.header("X-Watermark", watermarkText);
        return reply.send(csv);
      }

      reply.header("X-Watermark", watermarkText);
      return { alert: { ...alert, watermark: watermarkText } };
    } catch (err: unknown) {
      request.log.error(err, "Failed to export alert");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // FR-10: POST /api/v1/alerts/:id/false-positive — Mark alert as false positive
  app.post("/api/v1/alerts/:id/false-positive", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        required: ["reason"],
        properties: {
          reason: { type: "string", minLength: 1, maxLength: 2000 },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireAnalyst(request, reply)) return;
    try {
      const { id } = request.params as { id: string };
      const { reason } = request.body as { reason: string };
      const { userId } = request.authUser!;

      // Verify alert exists and is not already FALSE_POSITIVE
      const alertResult = await query(`SELECT alert_id, state_id FROM sm_alert WHERE alert_id = $1`, [id]);
      if (alertResult.rows.length === 0) return send404(reply, "ALERT_NOT_FOUND", "Alert not found");

      if (alertResult.rows[0].state_id === "FALSE_POSITIVE") {
        return sendError(reply, 400, "ALREADY_FALSE_POSITIVE", "Alert is already marked as false positive");
      }

      const previousState = alertResult.rows[0].state_id;

      // Transition to FALSE_POSITIVE state
      await query(
        `UPDATE sm_alert SET state_id = 'FALSE_POSITIVE', false_positive_reason = $1,
                false_positive_by = $2, false_positive_at = NOW(),
                updated_at = NOW(), row_version = row_version + 1
         WHERE alert_id = $3`,
        [reason, userId, id],
      );

      // Log audit entry
      await query(
        `INSERT INTO audit_log (entity_type, entity_id, event_type, from_state, to_state, actor_type, actor_id, remarks)
         VALUES ('sm_alert', $1, 'FALSE_POSITIVE', $2, 'FALSE_POSITIVE', 'OFFICER', $3, $4)`,
        [id, previousState, userId, reason],
      );

      return { success: true, alertId: id, newStateId: "FALSE_POSITIVE", reason };
    } catch (err: unknown) {
      request.log.error(err, "Failed to mark alert as false positive");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
