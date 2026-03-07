import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";
import { executeTransition } from "../workflow-bridge";
import { getAvailableTransitions } from "../workflow-bridge/transitions";
import { createRoleGuard } from "@puda/api-core";

const requireCaseCreate = createRoleGuard(["EXAMINER", "REVIEWER", "SUPERVISOR", "ADMINISTRATOR", "PLATFORM_ADMINISTRATOR"]);
const requireCaseDelete = createRoleGuard(["SUPERVISOR", "ADMINISTRATOR", "PLATFORM_ADMINISTRATOR"]);

export async function registerCaseRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/cases", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          state_id: { type: "string", maxLength: 100 },
          priority: { type: "string", maxLength: 50 },
          case_type: { type: "string", maxLength: 100 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const { state_id, priority, case_type, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
    const limit = Math.min(Math.max(parseInt(rawLimit || "50", 10) || 50, 1), 200);
    const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);
    const unitId = request.authUser?.unitId || null;

    const result = await query(
      `SELECT case_id, case_number, title, case_type, priority, state_id,
              assigned_to, created_by, dopams_case_ref, created_at,
              COUNT(*) OVER() AS total_count
       FROM forensic_case
       WHERE ($1::text IS NULL OR state_id = $1)
         AND ($2::text IS NULL OR priority = $2)
         AND ($3::text IS NULL OR case_type = $3)
         AND (unit_id = $6::uuid)
       ORDER BY created_at DESC
       LIMIT $4 OFFSET $5`,
      [state_id || null, priority || null, case_type || null, limit, offset, unitId],
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    return { cases: result.rows.map(({ total_count, ...r }) => r), total };
  });

  app.get("/api/v1/cases/facets", async (request) => {
    const unitId = request.authUser?.unitId || null;
    const [stateRows, priorityRows, typeRows] = await Promise.all([
      query(`SELECT state_id AS value, COUNT(*)::int AS count FROM forensic_case WHERE (unit_id = $1::uuid) GROUP BY state_id ORDER BY count DESC`, [unitId]),
      query(`SELECT priority AS value, COUNT(*)::int AS count FROM forensic_case WHERE (unit_id = $1::uuid) GROUP BY priority ORDER BY count DESC`, [unitId]),
      query(`SELECT case_type AS value, COUNT(*)::int AS count FROM forensic_case WHERE (unit_id = $1::uuid) GROUP BY case_type ORDER BY count DESC`, [unitId]),
    ]);
    return { facets: { state_id: stateRows.rows, priority: priorityRows.rows, case_type: typeRows.rows } };
  });

  app.post("/api/v1/cases", {
    schema: { body: { type: "object", additionalProperties: false, required: ["title"], properties: { title: { type: "string" }, description: { type: "string" }, caseType: { type: "string" } } } },
  }, async (request, reply) => {
    if (!requireCaseCreate(request, reply)) return;
    const { title, description, caseType } = request.body as { title: string; description?: string; caseType?: string };
    const { userId, unitId } = request.authUser!;
    const refResult = await query(`SELECT 'EF-CASE-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(nextval('forensic_case_ref_seq')::text, 6, '0') AS ref`);
    const caseNumber = refResult.rows[0].ref;
    const result = await query(
      `INSERT INTO forensic_case (title, description, case_type, case_number, created_by, unit_id) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING case_id, case_number, title, description, case_type, priority, state_id, created_by, unit_id, created_at`,
      [title, description || null, caseType || null, caseNumber, userId, unitId],
    );
    reply.code(201);
    return { case: result.rows[0] };
  });

  app.get("/api/v1/cases/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const unitId = request.authUser?.unitId || null;
    const result = await query(
      `SELECT case_id, case_number, title, description, case_type, priority, state_id, row_version,
              assigned_to, created_by, dopams_case_ref, created_at, updated_at
       FROM forensic_case WHERE case_id = $1 AND (unit_id = $2::uuid)`,
      [id, unitId],
    );
    if (result.rows.length === 0) {
      return send404(reply, "CASE_NOT_FOUND", "Case not found");
    }
    return { case: result.rows[0] };
  });

  app.get("/api/v1/cases/:id/transitions", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(`SELECT state_id FROM forensic_case WHERE case_id = $1`, [id]);
    if (result.rows.length === 0) return send404(reply, "CASE_NOT_FOUND", "Case not found");
    return { transitions: getAvailableTransitions("forensic_case", result.rows[0].state_id) };
  });

  app.post("/api/v1/cases/:id/transition", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, required: ["transitionId"], properties: { transitionId: { type: "string" }, remarks: { type: "string" } } },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { transitionId, remarks } = request.body as { transitionId: string; remarks?: string };
    const { userId, roles } = request.authUser!;

    // FR-01: Mandatory field validation before DRAFT→ACTIVE
    // FR-07: Block close when unreviewed findings exist
    // Business logic checks use best-effort state read; transition validation is atomic in engine
    const target = getAvailableTransitions("forensic_case",
      (await query(`SELECT state_id FROM forensic_case WHERE case_id = $1`, [id])).rows[0]?.state_id ?? "",
    ).find((t) => t.transitionId === transitionId);

    if (target?.toStateId === "ACTIVE") {
      const caseRow = await query(
        `SELECT title, case_type, assigned_to FROM forensic_case WHERE case_id = $1`, [id],
      );
      if (caseRow.rows.length > 0) {
        const missing: string[] = [];
        if (!caseRow.rows[0].title) missing.push("title");
        if (!caseRow.rows[0].case_type) missing.push("case_type");
        if (!caseRow.rows[0].assigned_to) missing.push("assigned_to");
        if (missing.length > 0) {
          return sendError(reply, 400, "MANDATORY_FIELDS_MISSING",
            `Required fields missing for activation: ${missing.join(", ")}`);
        }
      }
    }

    if (target?.toStateId === "CLOSED") {
      const unreviewedResult = await query(
        `SELECT COUNT(*)::int AS cnt FROM ai_finding WHERE case_id = $1 AND state_id = 'UNREVIEWED'`,
        [id],
      );
      if (unreviewedResult.rows[0].cnt > 0) {
        return sendError(reply, 409, "UNREVIEWED_FINDINGS_EXIST",
          "Cannot close case with unreviewed findings. Please review all findings first.");
      }
    }

    const result = await executeTransition(
      id, "forensic_case", transitionId, userId, "OFFICER", roles, remarks,
    );
    if (!result.success) {
      if (result.error === "ENTITY_NOT_FOUND") return send404(reply, "CASE_NOT_FOUND", "Case not found");
      return sendError(reply, 409, result.error || "TRANSITION_FAILED", "Case transition failed");
    }
    return { success: true, newStateId: result.newStateId };
  });
}
