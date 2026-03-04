import { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { query } from "../db";
import { sendError, send404 } from "../errors";

export async function registerEvidenceRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/v1/cases/:id/evidence", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, required: ["sourceType"], properties: { sourceType: { type: "string" }, description: { type: "string" }, filePath: { type: "string" }, fileContent: { type: "string", description: "Base64-encoded file content for hash computation" } } },
    },
  }, async (request, reply) => {
    try {
      const { id: caseId } = request.params as { id: string };
      const { sourceType, description, filePath, fileContent } = request.body as { sourceType: string; description?: string; filePath?: string; fileContent?: string };
      const { userId, unitId } = request.authUser!;

      const caseCheck = await query(`SELECT 1 FROM forensic_case WHERE case_id = $1`, [caseId]);
      if (caseCheck.rows.length === 0) {
        return send404(reply, "CASE_NOT_FOUND", "Case not found");
      }

      // Compute SHA-256 hash of the file content if provided
      let fileHash: string | null = null;
      let fileSizeBytes: number | null = null;
      if (fileContent) {
        const buffer = Buffer.from(fileContent, "base64");
        fileHash = createHash("sha256").update(buffer).digest("hex");
        fileSizeBytes = buffer.length;
      } else if (filePath) {
        // If a file path is provided without inline content, try to hash from disk
        try {
          const buffer = await readFile(filePath);
          fileHash = createHash("sha256").update(buffer).digest("hex");
          fileSizeBytes = buffer.length;
        } catch (fsErr: unknown) {
          request.log.warn(fsErr, "Could not read file for hash computation");
        }
      }

      const refResult = await query(`SELECT 'EF-EVD-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(nextval('forensic_evidence_ref_seq')::text, 6, '0') AS ref`);
      const evidenceRef = refResult.rows[0].ref;
      const result = await query(
        `INSERT INTO evidence_source (case_id, source_type, file_url, file_name, hash_sha256, file_size_bytes, evidence_ref, uploaded_by, unit_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING evidence_id, case_id, source_type, file_url, file_name, hash_sha256, file_size_bytes, evidence_ref, state_id, uploaded_by, unit_id, created_at`,
        [caseId, sourceType, filePath || null, description || null, fileHash, fileSizeBytes, evidenceRef, userId, unitId],
      );
      reply.code(201);
      return { evidence: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create evidence");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.get("/api/v1/evidence/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const unitId = request.authUser?.unitId || null;
      const result = await query(
        `SELECT evidence_id, case_id, source_type, device_info, file_url, file_name,
                file_size_bytes, hash_sha256, chain_of_custody, evidence_ref, state_id, row_version,
                uploaded_by, created_at, updated_at
         FROM evidence_source WHERE evidence_id = $1 AND ($2::uuid IS NULL OR unit_id = $2::uuid)`,
        [id, unitId],
      );
      if (result.rows.length === 0) {
        return send404(reply, "EVIDENCE_NOT_FOUND", "Evidence not found");
      }
      // Log access as custody event
      const { userId } = request.authUser!;
      await query(
        `INSERT INTO custody_event (evidence_id, event_type, actor_id, details) VALUES ($1, 'VIEWED', $2, '{}')`,
        [id, userId],
      ).catch((err: unknown) => { app.log.warn(err, "Custody event write failed"); }); // non-blocking
      return { evidence: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get evidence");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Custody log
  app.get("/api/v1/evidence/:id/custody-log", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(
        `SELECT ce.event_id, ce.evidence_id, ce.event_type, ce.actor_id, ce.details, ce.created_at, u.full_name AS actor_name
         FROM custody_event ce LEFT JOIN user_account u ON u.user_id = ce.actor_id
         WHERE ce.evidence_id = $1 ORDER BY ce.created_at DESC`,
        [id],
      );
      return { events: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get custody log");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Verify hash — recomputes SHA-256 from file on disk and compares against stored hash
  app.get("/api/v1/evidence/:id/verify", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(`SELECT evidence_id, hash_sha256, file_url, state_id FROM evidence_source WHERE evidence_id = $1`, [id]);
      if (result.rows.length === 0) return send404(reply, "EVIDENCE_NOT_FOUND", "Evidence not found");
      const ev = result.rows[0];

      if (!ev.hash_sha256) {
        return { evidenceId: ev.evidence_id, hashSha256: null, verified: false, reason: "NO_HASH_STORED", stateId: ev.state_id };
      }

      // Attempt to recompute hash from file on disk
      let recomputedHash: string | null = null;
      let verificationError: string | null = null;
      if (ev.file_url) {
        try {
          const buffer = await readFile(ev.file_url);
          recomputedHash = createHash("sha256").update(buffer).digest("hex");
        } catch (fsErr: unknown) {
          verificationError = "FILE_NOT_ACCESSIBLE";
          request.log.warn(fsErr, "Could not read evidence file for hash verification");
        }
      } else {
        verificationError = "NO_FILE_PATH";
      }

      const verified = recomputedHash !== null && recomputedHash === ev.hash_sha256;

      // Log verification attempt as custody event
      const { userId } = request.authUser!;
      await query(
        `INSERT INTO custody_event (evidence_id, event_type, actor_id, details) VALUES ($1, 'HASH_VERIFIED', $2, $3)`,
        [id, userId, JSON.stringify({ verified, storedHash: ev.hash_sha256, recomputedHash, verificationError })],
      ).catch((custodyErr: unknown) => { app.log.warn(custodyErr, "Custody event write failed"); });

      return {
        evidenceId: ev.evidence_id,
        hashSha256: ev.hash_sha256,
        recomputedHash: recomputedHash || null,
        verified,
        ...(verificationError ? { reason: verificationError } : {}),
        stateId: ev.state_id,
      };
    } catch (err: unknown) {
      request.log.error(err, "Failed to verify evidence");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
