import { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { query } from "../db";
import { send404, sendError } from "../errors";
import { createEvidencePackager } from "@puda/api-integrations";

export async function registerEvidenceRoutes(app: FastifyInstance): Promise<void> {
  // FR-02: Allowed MIME types for evidence upload
  const ALLOWED_MIME_TYPES = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "video/mp4",
    "audio/mpeg",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);

  // POST /api/v1/evidence — create evidence item with SHA-256 hash
  app.post("/api/v1/evidence", {
    schema: {
      tags: ["evidence"],
      body: {
        type: "object",
        additionalProperties: false,
        required: ["fileName"],
        properties: {
          caseId: { type: "string", format: "uuid" },
          leadId: { type: "string", format: "uuid" },
          fileName: { type: "string", minLength: 1, maxLength: 500 },
          mimeType: { type: "string", maxLength: 100 },
          storagePath: { type: "string" },
          fileContent: { type: "string", description: "Base64-encoded file content for hash computation" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { caseId, leadId, fileName, mimeType, storagePath, fileContent } =
        request.body as { caseId?: string; leadId?: string; fileName: string; mimeType?: string; storagePath?: string; fileContent?: string };
      const { userId } = request.authUser!;

      // FR-02: Validate MIME type against allowed list
      if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
        return sendError(reply, 400, "INVALID_FILE_TYPE",
          `File type '${mimeType}' is not allowed. Accepted types: ${[...ALLOWED_MIME_TYPES].join(", ")}`);
      }

      let hashSha256: string | null = null;
      let fileSize: number | null = null;
      if (fileContent) {
        const buffer = Buffer.from(fileContent, "base64");
        hashSha256 = createHash("sha256").update(buffer).digest("hex");
        fileSize = buffer.length;
      }

      // FR-02: Checksum dedup — reject if evidence with same hash already exists
      if (hashSha256) {
        const dupCheck = await query(
          `SELECT evidence_id FROM evidence_item WHERE hash_sha256 = $1 LIMIT 1`,
          [hashSha256],
        );
        if (dupCheck.rows.length > 0) {
          return sendError(reply, 409, "DUPLICATE_EVIDENCE",
            `Evidence with identical content already exists (ID: ${dupCheck.rows[0].evidence_id})`);
        }
      }

      const result = await query(
        `INSERT INTO evidence_item (case_id, lead_id, file_name, file_size, mime_type, hash_sha256, storage_path, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [caseId || null, leadId || null, fileName, fileSize, mimeType || null, hashSha256, storagePath || null, userId],
      );

      // Log custody event: CREATED
      await query(
        `INSERT INTO custody_event (evidence_id, action, actor_id, hash_after, notes) VALUES ($1, 'CREATED', $2, $3, 'Evidence item created')`,
        [result.rows[0].evidence_id, userId, hashSha256],
      ).catch((err: unknown) => { app.log.warn(err, "Custody event write failed"); });

      reply.code(201);
      return { evidence: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create evidence item");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/evidence — list evidence items
  app.get("/api/v1/evidence", {
    schema: {
      tags: ["evidence"],
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          case_id: { type: "string", format: "uuid" },
          lead_id: { type: "string", format: "uuid" },
          legal_hold: { type: "boolean" },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { case_id, lead_id, legal_hold, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
      const limit = Math.min(Math.max(parseInt(rawLimit || "50", 10) || 50, 1), 200);
      const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);

      const result = await query(
        `SELECT evidence_id, case_id, lead_id, file_name, file_size, mime_type, hash_sha256,
                storage_path, legal_hold, integrity_status, uploaded_by, created_at,
                COUNT(*) OVER() AS total_count
         FROM evidence_item
         WHERE ($1::uuid IS NULL OR case_id = $1::uuid)
           AND ($2::uuid IS NULL OR lead_id = $2::uuid)
           AND ($3::boolean IS NULL OR legal_hold = $3::boolean)
         ORDER BY created_at DESC
         LIMIT $4 OFFSET $5`,
        [case_id || null, lead_id || null, legal_hold ?? null, limit, offset],
      );

      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      return { evidence: result.rows.map(({ total_count, ...r }: any) => r), total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list evidence items");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/evidence/:id — get single evidence item
  app.get("/api/v1/evidence/:id", {
    schema: {
      tags: ["evidence"],
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(`SELECT * FROM evidence_item WHERE evidence_id = $1`, [id]);
      if (result.rows.length === 0) return send404(reply, "EVIDENCE_NOT_FOUND", "Evidence item not found");

      // Log custody event: VIEWED
      const { userId } = request.authUser!;
      await query(
        `INSERT INTO custody_event (evidence_id, action, actor_id, notes) VALUES ($1, 'VIEWED', $2, 'Evidence viewed')`,
        [id, userId],
      ).catch((err: unknown) => { app.log.warn(err, "Custody event write failed"); });

      return { evidence: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get evidence item");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/evidence/:id/verify — re-hash and compare integrity
  app.post("/api/v1/evidence/:id/verify", {
    schema: {
      tags: ["evidence"],
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          fileContent: { type: "string", description: "Base64-encoded content to verify against stored hash" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { fileContent } = (request.body || {}) as { fileContent?: string };
      const { userId } = request.authUser!;

      const result = await query(`SELECT evidence_id, hash_sha256, storage_path, integrity_status FROM evidence_item WHERE evidence_id = $1`, [id]);
      if (result.rows.length === 0) return send404(reply, "EVIDENCE_NOT_FOUND", "Evidence item not found");

      const ev = result.rows[0];
      if (!ev.hash_sha256) {
        return { evidenceId: id, verified: false, reason: "NO_HASH_STORED", integrityStatus: ev.integrity_status };
      }

      let recomputedHash: string | null = null;
      if (fileContent) {
        const buffer = Buffer.from(fileContent, "base64");
        recomputedHash = createHash("sha256").update(buffer).digest("hex");
      } else {
        return sendError(reply, 400, "FILE_CONTENT_REQUIRED", "Provide fileContent (base64) to verify against stored hash");
      }

      const verified = recomputedHash === ev.hash_sha256;
      const newStatus = verified ? "VERIFIED" : "TAMPERED";

      await query(`UPDATE evidence_item SET integrity_status = $1, updated_at = NOW() WHERE evidence_id = $2`, [newStatus, id]);

      // Log custody event
      await query(
        `INSERT INTO custody_event (evidence_id, action, actor_id, hash_before, hash_after, notes)
         VALUES ($1, 'HASH_VERIFIED', $2, $3, $4, $5)`,
        [id, userId, ev.hash_sha256, recomputedHash, JSON.stringify({ verified, newStatus })],
      ).catch((err: unknown) => { app.log.warn(err, "Custody event write failed"); });

      return { evidenceId: id, verified, storedHash: ev.hash_sha256, recomputedHash, integrityStatus: newStatus };
    } catch (err: unknown) {
      request.log.error(err, "Failed to verify evidence");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/evidence/:id/custody-chain — list custody events
  app.get("/api/v1/evidence/:id/custody-chain", {
    schema: {
      tags: ["evidence"],
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const evCheck = await query(`SELECT 1 FROM evidence_item WHERE evidence_id = $1`, [id]);
      if (evCheck.rows.length === 0) return send404(reply, "EVIDENCE_NOT_FOUND", "Evidence item not found");

      const result = await query(
        `SELECT ce.event_id, ce.evidence_id, ce.action, ce.actor_id, ce.notes,
                ce.hash_before, ce.hash_after, ce.created_at,
                u.full_name AS actor_name
         FROM custody_event ce
         LEFT JOIN user_account u ON u.user_id = ce.actor_id
         WHERE ce.evidence_id = $1
         ORDER BY ce.created_at ASC`,
        [id],
      );
      return { events: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get custody chain");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/evidence/:id/legal-hold — toggle legal hold
  app.post("/api/v1/evidence/:id/legal-hold", {
    schema: {
      tags: ["evidence"],
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        required: ["legalHold"],
        properties: {
          legalHold: { type: "boolean" },
          reason: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { legalHold, reason } = request.body as { legalHold: boolean; reason?: string };
      const { userId } = request.authUser!;

      const result = await query(
        `UPDATE evidence_item SET legal_hold = $1, updated_at = NOW() WHERE evidence_id = $2 RETURNING *`,
        [legalHold, id],
      );
      if (result.rows.length === 0) return send404(reply, "EVIDENCE_NOT_FOUND", "Evidence item not found");

      // Log custody event
      await query(
        `INSERT INTO custody_event (evidence_id, action, actor_id, notes)
         VALUES ($1, $2, $3, $4)`,
        [id, legalHold ? "LEGAL_HOLD_APPLIED" : "LEGAL_HOLD_RELEASED", userId, reason || null],
      ).catch((err: unknown) => { app.log.warn(err, "Custody event write failed"); });

      return { evidence: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to toggle legal hold");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/evidence/:id/package — ZIP + SHA-256 manifest
  app.get("/api/v1/evidence/:id/package", {
    schema: {
      tags: ["evidence"],
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { userId } = request.authUser!;

      const result = await query(`SELECT * FROM evidence_item WHERE evidence_id = $1`, [id]);
      if (result.rows.length === 0) return send404(reply, "EVIDENCE_NOT_FOUND", "Evidence item not found");
      const ev = result.rows[0];

      if (ev.legal_hold) {
        return sendError(reply, 403, "LEGAL_HOLD_ACTIVE", "Cannot package evidence under legal hold without authorization");
      }

      // Build package items from evidence metadata
      const items: Array<{ filename: string; data: Buffer; mimeType: string; metadata?: Record<string, unknown> }> = [];
      // Create a manifest entry even without physical file
      const metadataJson = JSON.stringify({
        evidenceId: ev.evidence_id,
        fileName: ev.file_name,
        hashSha256: ev.hash_sha256,
        integrityStatus: ev.integrity_status,
        legalHold: ev.legal_hold,
        uploadedBy: ev.uploaded_by,
        createdAt: ev.created_at,
      }, null, 2);
      items.push({
        filename: "evidence-metadata.json",
        data: Buffer.from(metadataJson, "utf-8"),
        mimeType: "application/json",
        metadata: { evidenceId: ev.evidence_id, storedHash: ev.hash_sha256 },
      });

      const packager = createEvidencePackager();
      const zipBuffer = await packager.packageEvidence(ev.case_id || ev.evidence_id, userId, items);

      // Log custody event
      await query(
        `INSERT INTO custody_event (evidence_id, action, actor_id, notes)
         VALUES ($1, 'PACKAGED', $2, 'Evidence packaged as ZIP with SHA-256 manifest')`,
        [id, userId],
      ).catch((err: unknown) => { app.log.warn(err, "Custody event write failed"); });

      reply.header("Content-Type", "application/zip");
      reply.header("Content-Disposition", `attachment; filename="evidence-${id}.zip"`);
      return reply.send(zipBuffer);
    } catch (err: unknown) {
      request.log.error(err, "Failed to package evidence");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
