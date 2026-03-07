import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send400, send404, sendError } from "../errors";
import { executeTransition } from "../workflow-bridge";
import { getAvailableTransitions } from "../workflow-bridge/transitions";

const PRIVILEGED_ROLES = ["ADMINISTRATOR", "PLATFORM_ADMINISTRATOR", "INTELLIGENCE_ANALYST", "INVESTIGATING_OFFICER"];

function maskSubjectPII(row: Record<string, unknown>, userRoles: string[]): Record<string, unknown> {
  if (!userRoles.some((r) => PRIVILEGED_ROLES.includes(r))) {
    row.identifiers = row.identifiers ? "[REDACTED]" : null;
    row.addresses = row.addresses ? "[REDACTED]" : null;
  }
  return row;
}

export async function registerSubjectRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/subjects", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          state_id: { type: "string", maxLength: 100 },
          gender: { type: "string", maxLength: 50 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const { state_id, gender, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
    const unitId = request.authUser?.unitId || null;
    const limit = Math.min(Math.max(parseInt(rawLimit || "50", 10) || 50, 1), 200);
    const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);

    const result = await query(
      `SELECT subject_id, subject_ref, full_name, aliases, date_of_birth, gender, risk_score,
              monitoring_status, threat_level, bail_status, is_merged,
              state_id, created_by, created_at,
              COUNT(*) OVER() AS total_count
       FROM subject_profile
       WHERE ($1::text IS NULL OR state_id = $1)
         AND ($2::text IS NULL OR gender = $2)
         AND (unit_id = $3::uuid)
       ORDER BY created_at DESC
       LIMIT $4 OFFSET $5`,
      [state_id || null, gender || null, unitId, limit, offset],
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    return { subjects: result.rows.map(({ total_count, ...r }) => r), total };
  });

  app.get("/api/v1/subjects/facets", async (request) => {
    const unitId = request.authUser?.unitId || null;
    const [stateRows, genderRows] = await Promise.all([
      query(`SELECT state_id AS value, COUNT(*)::int AS count FROM subject_profile WHERE (unit_id = $1::uuid) GROUP BY state_id ORDER BY count DESC`, [unitId]),
      query(`SELECT gender AS value, COUNT(*)::int AS count FROM subject_profile WHERE (unit_id = $1::uuid) GROUP BY gender ORDER BY count DESC`, [unitId]),
    ]);
    return { facets: { state_id: stateRows.rows, gender: genderRows.rows } };
  });

  app.get("/api/v1/subjects/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const unitId = request.authUser?.unitId || null;
    const result = await query(
      `SELECT subject_id, subject_ref, full_name, aliases, date_of_birth, gender, identifiers, addresses,
              photo_url, risk_score, father_name, mother_name, spouse_name, height_cm, weight_kg,
              complexion, distinguishing_marks, blood_group, nationality, religion, caste,
              education, occupation, marital_status, known_languages, mobile_numbers, email_addresses,
              social_handles, criminal_history, ndps_history, first_arrested_at, total_arrests,
              bail_status, monitoring_status, last_seen_at, last_seen_location, known_associates,
              gang_affiliation, modus_operandi, threat_level, field_provenance, photo_urls,
              is_merged, merged_into_id, source_system, cctns_id,
              state_id, row_version, created_by, created_at, updated_at
       FROM subject_profile WHERE subject_id = $1 AND (unit_id = $2::uuid)`,
      [id, unitId],
    );
    if (result.rows.length === 0) {
      return send404(reply, "SUBJECT_NOT_FOUND", "Subject not found");
    }
    const subject = maskSubjectPII(result.rows[0], request.authUser?.roles ?? []);

    // FR-04 AC-04 — compute profile completeness score
    const PROFILE_FIELDS = [
      'full_name', 'date_of_birth', 'gender', 'father_name', 'nationality',
      'identifiers', 'addresses', 'mobile_numbers', 'photo_url', 'occupation',
      'criminal_history', 'height_cm', 'complexion', 'distinguishing_marks',
      'known_languages', 'blood_group',
    ];
    const filledCount = PROFILE_FIELDS.filter(f => {
      const val = result.rows[0][f];
      if (val === null || val === undefined) return false;
      if (Array.isArray(val)) return val.length > 0;
      if (typeof val === 'object') return Object.keys(val).length > 0;
      return String(val).trim().length > 0;
    }).length;
    subject.completeness_score = Math.round((filledCount / PROFILE_FIELDS.length) * 100);

    return { subject };
  });

  app.post("/api/v1/subjects", {
    schema: { body: { type: "object", additionalProperties: false, required: ["fullName"], properties: {
      fullName: { type: "string" }, aliases: { type: "array", items: { type: "string" } }, identifiers: { type: "object", additionalProperties: true },
      fatherName: { type: "string" }, motherName: { type: "string" }, spouseName: { type: "string" },
      dateOfBirth: { type: "string", format: "date" }, gender: { type: "string" },
      heightCm: { type: "number" }, weightKg: { type: "number" }, complexion: { type: "string" },
      distinguishingMarks: { type: "string" }, bloodGroup: { type: "string" },
      nationality: { type: "string" }, religion: { type: "string" }, caste: { type: "string" },
      education: { type: "string" }, occupation: { type: "string" }, maritalStatus: { type: "string" },
      knownLanguages: { type: "array", items: { type: "string" } },
      mobileNumbers: { type: "array", items: { type: "string" } },
      socialHandles: { type: "array", items: { type: "object", additionalProperties: true } },
      monitoringStatus: { type: "string", enum: ["NONE", "ACTIVE", "WATCH", "SURVEILLANCE"] },
      threatLevel: { type: "string", enum: ["UNKNOWN", "LOW", "MEDIUM", "HIGH", "CRITICAL"] },
      sourceSystem: { type: "string" }, cctnsId: { type: "string" },
    } } },
  }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const { fullName, aliases, identifiers } = body as { fullName: string; aliases?: string[]; identifiers?: Record<string, unknown> };
    const { userId } = request.authUser!;
    const unitId = request.authUser?.unitId || null;
    const refResult = await query(`SELECT 'DOP-SUBJ-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(nextval('dopams_subject_ref_seq')::text, 6, '0') AS ref`);
    const subjectRef = refResult.rows[0].ref;
    const result = await query(
      `INSERT INTO subject_profile (subject_ref, full_name, aliases, identifiers, created_by, unit_id,
        father_name, mother_name, spouse_name, date_of_birth, gender, height_cm, weight_kg,
        complexion, distinguishing_marks, blood_group, nationality, religion, caste,
        education, occupation, marital_status, known_languages, mobile_numbers, social_handles,
        monitoring_status, threat_level, source_system, cctns_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
       RETURNING subject_id, subject_ref, full_name, aliases, identifiers, state_id, unit_id, created_by, created_at`,
      [subjectRef, fullName, JSON.stringify(aliases || []), JSON.stringify(identifiers || {}), userId, unitId,
        body.fatherName || null, body.motherName || null, body.spouseName || null,
        body.dateOfBirth || null, body.gender || null, body.heightCm || null, body.weightKg || null,
        body.complexion || null, body.distinguishingMarks || null, body.bloodGroup || null,
        body.nationality || null, body.religion || null, body.caste || null,
        body.education || null, body.occupation || null, body.maritalStatus || null,
        JSON.stringify(body.knownLanguages || []), JSON.stringify(body.mobileNumbers || []),
        JSON.stringify(body.socialHandles || []),
        body.monitoringStatus || "NONE", body.threatLevel || "UNKNOWN",
        body.sourceSystem || null, body.cctnsId || null],
    );
    reply.code(201);
    return { subject: maskSubjectPII(result.rows[0], request.authUser?.roles ?? []) };
  });

  app.put("/api/v1/subjects/:id", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, properties: {
        fullName: { type: "string" }, aliases: { type: "array", items: { type: "string" } },
        fatherName: { type: "string" }, motherName: { type: "string" }, spouseName: { type: "string" },
        dateOfBirth: { type: "string", format: "date" }, gender: { type: "string" },
        heightCm: { type: "number" }, weightKg: { type: "number" }, complexion: { type: "string" },
        distinguishingMarks: { type: "string" }, bloodGroup: { type: "string" },
        nationality: { type: "string" }, religion: { type: "string" }, caste: { type: "string" },
        education: { type: "string" }, occupation: { type: "string" }, maritalStatus: { type: "string" },
        knownLanguages: { type: "array", items: { type: "string" } },
        mobileNumbers: { type: "array", items: { type: "string" } },
        socialHandles: { type: "array", items: { type: "object", additionalProperties: true } },
        monitoringStatus: { type: "string", enum: ["NONE", "ACTIVE", "WATCH", "SURVEILLANCE"] },
        threatLevel: { type: "string", enum: ["UNKNOWN", "LOW", "MEDIUM", "HIGH", "CRITICAL"] },
        sourceSystem: { type: "string" }, cctnsId: { type: "string" },
        fieldProvenance: { type: "object", additionalProperties: true },
      } },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const fieldMap: Record<string, string> = {
      fullName: "full_name", aliases: "aliases", fatherName: "father_name", motherName: "mother_name",
      spouseName: "spouse_name", dateOfBirth: "date_of_birth", gender: "gender",
      heightCm: "height_cm", weightKg: "weight_kg", complexion: "complexion",
      distinguishingMarks: "distinguishing_marks", bloodGroup: "blood_group",
      nationality: "nationality", religion: "religion", caste: "caste",
      education: "education", occupation: "occupation", maritalStatus: "marital_status",
      knownLanguages: "known_languages", mobileNumbers: "mobile_numbers",
      socialHandles: "social_handles", monitoringStatus: "monitoring_status",
      threatLevel: "threat_level", sourceSystem: "source_system", cctnsId: "cctns_id",
      fieldProvenance: "field_provenance",
    };
    const jsonFields = new Set(["aliases", "knownLanguages", "mobileNumbers", "socialHandles", "fieldProvenance"]);

    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    for (const [bodyKey, col] of Object.entries(fieldMap)) {
      if (body[bodyKey] !== undefined) {
        sets.push(`${col} = $${idx++}`);
        params.push(jsonFields.has(bodyKey) ? JSON.stringify(body[bodyKey]) : body[bodyKey]);
      }
    }

    if (sets.length === 0) {
      return send400(reply, "NO_FIELDS", "No fields to update");
    }

    sets.push(`updated_at = NOW()`);
    params.push(id);

    const result = await query(
      `UPDATE subject_profile SET ${sets.join(", ")} WHERE subject_id = $${idx}
       RETURNING subject_id, full_name, aliases, state_id, updated_at`,
      params,
    );
    if (result.rows.length === 0) {
      return send404(reply, "SUBJECT_NOT_FOUND", "Subject not found");
    }
    return { subject: result.rows[0] };
  });

  app.get("/api/v1/subjects/:id/transitions", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(`SELECT state_id FROM subject_profile WHERE subject_id = $1`, [id]);
    if (result.rows.length === 0) return send404(reply, "SUBJECT_NOT_FOUND", "Subject not found");
    return { transitions: getAvailableTransitions("dopams_subject", result.rows[0].state_id) };
  });

  app.post("/api/v1/subjects/:id/transition", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, required: ["transitionId"], properties: { transitionId: { type: "string" }, remarks: { type: "string" } } },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { transitionId, remarks } = request.body as { transitionId: string; remarks?: string };
    const { userId, roles } = request.authUser!;

    // Validate transition is allowed from current state
    const stateResult = await query(`SELECT state_id FROM subject_profile WHERE subject_id = $1`, [id]);
    if (stateResult.rows.length === 0) return send404(reply, "SUBJECT_NOT_FOUND", "Subject not found");
    const available = getAvailableTransitions("dopams_subject", stateResult.rows[0].state_id);
    if (!available.some((t) => t.transitionId === transitionId)) {
      return sendError(reply, 400, "INVALID_TRANSITION", "Transition not allowed from current state");
    }

    const result = await executeTransition(
      id, "dopams_subject", transitionId, userId, "OFFICER", roles, remarks,
    );
    if (!result.success) {
      return sendError(reply, 409, result.error || "TRANSITION_FAILED", "Subject transition failed");
    }
    return { success: true, newStateId: result.newStateId };
  });
}
