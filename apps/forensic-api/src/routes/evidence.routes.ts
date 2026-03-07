import { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { query } from "../db";
import { sendError, send403, send404 } from "../errors";
import { validateFilePath } from "@puda/api-core";
import { createEvidencePackager, createPdfGenerator } from "@puda/api-integrations";

const EVIDENCE_BASE_DIR = process.env.EVIDENCE_STORAGE_DIR || "/data/evidence";

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
        const safePath = validateFilePath(filePath, EVIDENCE_BASE_DIR);
        if (!safePath) {
          return sendError(reply, 400, "INVALID_FILE_PATH", "File path is outside the allowed storage directory");
        }
        try {
          const buffer = await readFile(safePath);
          fileHash = createHash("sha256").update(buffer).digest("hex");
          fileSizeBytes = buffer.length;
        } catch (fsErr: unknown) {
          request.log.warn(fsErr, "Could not read file for hash computation");
        }
      }

      // Dedup check: if same hash already exists for this case, flag as DUPLICATE
      let dedupStatus = "UNIQUE";
      if (fileHash) {
        const dupeCheck = await query(
          `SELECT evidence_id, evidence_ref FROM evidence_source WHERE hash_sha256 = $1 AND case_id = $2`,
          [fileHash, caseId],
        );
        if (dupeCheck.rows.length > 0) {
          dedupStatus = "DUPLICATE";
        }
      }

      const refResult = await query(`SELECT 'EF-EVD-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(nextval('forensic_evidence_ref_seq')::text, 6, '0') AS ref`);
      const evidenceRef = refResult.rows[0].ref;
      const result = await query(
        `INSERT INTO evidence_source (case_id, source_type, file_url, file_name, hash_sha256, file_size_bytes, evidence_ref, uploaded_by, unit_id, dedup_status, quarantine_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'CLEAR')
         RETURNING evidence_id, case_id, source_type, file_url, file_name, hash_sha256, file_size_bytes, evidence_ref, dedup_status, quarantine_status, state_id, uploaded_by, unit_id, created_at`,
        [caseId, sourceType, filePath || null, description || null, fileHash, fileSizeBytes, evidenceRef, userId, unitId, dedupStatus],
      );
      reply.code(201);
      return { evidence: result.rows[0], ...(dedupStatus === "DUPLICATE" ? { warning: "Duplicate hash detected for this case" } : {}) };
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
                quarantine_status, quarantine_reason, quarantine_approved_by,
                extraction_detail, extraction_language,
                uploaded_by, created_at, updated_at
         FROM evidence_source WHERE evidence_id = $1 AND (unit_id = $2::uuid)`,
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
        const safePath = validateFilePath(ev.file_url, EVIDENCE_BASE_DIR);
        if (!safePath) {
          verificationError = "INVALID_FILE_PATH";
        } else try {
          const buffer = await readFile(safePath);
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

  // Package evidence as ZIP with SHA-256 manifest
  app.post("/api/v1/evidence/:id/package", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { userId } = request.authUser!;
      const unitId = request.authUser?.unitId || null;

      // Get evidence and its case
      const result = await query(
        `SELECT e.evidence_id, e.case_id, e.source_type, e.file_url, e.file_name, e.hash_sha256,
                e.file_size_bytes, e.evidence_ref, c.case_number
         FROM evidence_source e
         JOIN forensic_case c ON c.case_id = e.case_id
         WHERE e.evidence_id = $1 AND e.unit_id = $2::uuid`,
        [id, unitId],
      );
      if (result.rows.length === 0) return send404(reply, "EVIDENCE_NOT_FOUND", "Evidence not found");
      const ev = result.rows[0];

      // Read the evidence file from disk
      const items: Array<{ filename: string; data: Buffer; mimeType: string; metadata?: Record<string, unknown> }> = [];
      if (ev.file_url) {
        const safePath = validateFilePath(ev.file_url, EVIDENCE_BASE_DIR);
        if (!safePath) {
          return sendError(reply, 400, "INVALID_FILE_PATH", "Evidence file path is outside the allowed storage directory");
        }
        try {
          const buffer = await readFile(safePath);
          const filename = ev.file_name || ev.file_url.split("/").pop() || "evidence-file";
          items.push({
            filename,
            data: buffer,
            mimeType: ev.source_type || "application/octet-stream",
            metadata: { evidenceRef: ev.evidence_ref, storedHash: ev.hash_sha256 },
          });
        } catch (fsErr: unknown) {
          request.log.warn(fsErr, "Could not read evidence file for packaging");
          return sendError(reply, 422, "FILE_NOT_ACCESSIBLE", "Evidence file could not be read from storage");
        }
      } else {
        return sendError(reply, 422, "NO_FILE_PATH", "Evidence has no associated file to package");
      }

      const packager = createEvidencePackager();
      const zipBuffer = await packager.packageEvidence(ev.case_number || ev.case_id, userId, items);

      // Log packaging event
      await query(
        `INSERT INTO custody_event (evidence_id, event_type, actor_id, details) VALUES ($1, 'PACKAGED', $2, $3)`,
        [id, userId, JSON.stringify({ format: "ZIP+SHA256", itemCount: items.length })],
      ).catch((err: unknown) => { app.log.warn(err, "Custody event write failed"); });

      reply.header("Content-Type", "application/zip");
      reply.header("Content-Disposition", `attachment; filename="evidence-${ev.evidence_ref}.zip"`);
      return reply.send(zipBuffer);
    } catch (err: unknown) {
      request.log.error(err, "Failed to package evidence");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // ── Quarantine Flow (FR-02) ──

  // Quarantine evidence
  app.post("/api/v1/evidence/:id/quarantine", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, required: ["reason"], properties: { reason: { type: "string" } } },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { reason } = request.body as { reason: string };
      const { userId } = request.authUser!;

      const result = await query(
        `UPDATE evidence_source SET quarantine_status = 'QUARANTINED', quarantine_reason = $2, updated_at = NOW()
         WHERE evidence_id = $1 AND quarantine_status != 'QUARANTINED'
         RETURNING evidence_id, quarantine_status, quarantine_reason`,
        [id, reason],
      );
      if (result.rows.length === 0) {
        const check = await query(`SELECT evidence_id, quarantine_status FROM evidence_source WHERE evidence_id = $1`, [id]);
        if (check.rows.length === 0) return send404(reply, "EVIDENCE_NOT_FOUND", "Evidence not found");
        return sendError(reply, 409, "ALREADY_QUARANTINED", "Evidence is already quarantined");
      }

      // Log quarantine event
      await query(
        `INSERT INTO custody_event (evidence_id, event_type, actor_id, details) VALUES ($1, 'QUARANTINED', $2, $3)`,
        [id, userId, JSON.stringify({ reason })],
      ).catch((err: unknown) => { app.log.warn(err, "Custody event write failed"); });

      return { evidence: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to quarantine evidence");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Supervisor approval for quarantined evidence
  app.post("/api/v1/evidence/:id/quarantine/approve", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { userId, roles } = request.authUser!;

      // Supervisor-only check
      if (!roles.includes("SUPERVISOR") && !roles.includes("ADMINISTRATOR")) {
        return send403(reply, "FORBIDDEN", "Only supervisors can approve quarantined evidence");
      }

      const result = await query(
        `UPDATE evidence_source SET quarantine_status = 'APPROVED', quarantine_approved_by = $2, updated_at = NOW()
         WHERE evidence_id = $1 AND quarantine_status = 'QUARANTINED'
         RETURNING evidence_id, quarantine_status, quarantine_approved_by`,
        [id, userId],
      );
      if (result.rows.length === 0) {
        const check = await query(`SELECT evidence_id, quarantine_status FROM evidence_source WHERE evidence_id = $1`, [id]);
        if (check.rows.length === 0) return send404(reply, "EVIDENCE_NOT_FOUND", "Evidence not found");
        return sendError(reply, 409, "INVALID_STATE", "Evidence must be QUARANTINED to approve");
      }

      // Log approval event
      await query(
        `INSERT INTO custody_event (evidence_id, event_type, actor_id, details) VALUES ($1, 'QUARANTINE_APPROVED', $2, '{}')`,
        [id, userId],
      ).catch((err: unknown) => { app.log.warn(err, "Custody event write failed"); });

      return { evidence: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to approve quarantined evidence");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // ── Extraction Detail (FR-06) ──

  // Store extraction detail on evidence
  app.post("/api/v1/evidence/:id/extraction", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        required: ["extractionDetail"],
        properties: {
          extractionDetail: { type: "object", description: "Structured JSON with names, dates, locations, phone numbers" },
          language: { type: "string", enum: ["en", "te", "hi", "pa"], default: "en" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { extractionDetail, language } = request.body as { extractionDetail: Record<string, unknown>; language?: string };

      const result = await query(
        `UPDATE evidence_source SET extraction_detail = $2, extraction_language = $3, updated_at = NOW()
         WHERE evidence_id = $1
         RETURNING evidence_id, extraction_detail, extraction_language`,
        [id, JSON.stringify(extractionDetail), language || "en"],
      );
      if (result.rows.length === 0) return send404(reply, "EVIDENCE_NOT_FOUND", "Evidence not found");
      return { evidence: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to store extraction detail");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Chain of custody PDF export
  app.get("/api/v1/evidence/:id/custody-log/pdf", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      // Get evidence details
      const evResult = await query(
        `SELECT evidence_id, evidence_ref, case_id, source_type, hash_sha256, state_id, created_at
         FROM evidence_source WHERE evidence_id = $1`,
        [id],
      );
      if (evResult.rows.length === 0) return send404(reply, "EVIDENCE_NOT_FOUND", "Evidence not found");
      const ev = evResult.rows[0];

      // Get all custody events
      const events = await query(
        `SELECT ce.event_id, ce.event_type, ce.actor_id, ce.details, ce.created_at, u.full_name AS actor_name
         FROM custody_event ce LEFT JOIN user_account u ON u.user_id = ce.actor_id
         WHERE ce.evidence_id = $1 ORDER BY ce.created_at ASC`,
        [id],
      );

      const pdfGen = createPdfGenerator();
      const buffer = await pdfGen.generate({
        header: {
          title: "Chain of Custody Report",
          subtitle: `Evidence: ${ev.evidence_ref || ev.evidence_id}`,
          department: "E-Forensic Lab",
          generatedAt: new Date().toISOString(),
          generatedBy: request.authUser?.userId,
          referenceNumber: ev.evidence_ref,
        },
        sections: [
          {
            type: "keyValue",
            title: "Evidence Details",
            entries: [
              { label: "Evidence ID", value: ev.evidence_id },
              { label: "Reference", value: ev.evidence_ref || "N/A" },
              { label: "Source Type", value: ev.source_type || "N/A" },
              { label: "SHA-256 Hash", value: ev.hash_sha256 || "N/A" },
              { label: "State", value: ev.state_id },
              { label: "Created", value: String(ev.created_at) },
            ],
          },
          {
            type: "table",
            title: "Custody Events",
            headers: ["#", "Event Type", "Actor", "Date/Time", "Details"],
            rows: events.rows.map((e: any, i: number) => [
              String(i + 1),
              e.event_type,
              e.actor_name || e.actor_id || "System",
              String(e.created_at),
              typeof e.details === "string" ? e.details : JSON.stringify(e.details || {}),
            ]),
          },
        ],
        footer: {
          text: "Generated by E-Forensic Lab Management System",
          confidentiality: "CONFIDENTIAL — Chain of Custody Document",
          pageNumbers: true,
        },
      });

      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", `attachment; filename="custody-chain-${ev.evidence_ref || id}.pdf"`);
      return reply.send(buffer);
    } catch (err: unknown) {
      request.log.error(err, "Failed to generate custody chain PDF");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
