import { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { query } from "../db";
import { sendError, send404 } from "../errors";
import { validateFilePath, createRoleGuard } from "@puda/api-core";
import { executeTransition } from "../workflow-bridge";
import { getAvailableTransitions } from "../workflow-bridge/transitions";
import { createEvidencePackager } from "@puda/api-integrations";
import { generateAndLogWatermark } from "../services/watermark";
import { getRetentionDashboardStats } from "../services/retention-enforcer";
import { generateOsintCollectionReport } from "../services/osint-report-generator";

const requireAnalyst = createRoleGuard(["ANALYST", "SUPERVISOR", "PLATFORM_ADMINISTRATOR"]);
const requireCustodian = createRoleGuard(["EVIDENCE_CUSTODIAN", "LEGAL_REVIEWER", "SUPERVISOR", "PLATFORM_ADMINISTRATOR"]);
const EVIDENCE_BASE_DIR = process.env.EVIDENCE_STORAGE_DIR || "/data/evidence";

export async function registerEvidenceRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/v1/evidence/capture", {
    schema: { body: { type: "object", additionalProperties: false, required: ["contentId"], properties: { contentId: { type: "string", format: "uuid" }, captureType: { type: "string" }, notes: { type: "string" }, screenshotUrl: { type: "string" }, archiveUrl: { type: "string" }, fileContent: { type: "string", description: "Base64-encoded file content for hash computation" } } } },
  }, async (request, reply) => {
    try {
      const { contentId, captureType, notes, screenshotUrl, archiveUrl, fileContent } = request.body as { contentId: string; captureType?: string; notes?: string; screenshotUrl?: string; archiveUrl?: string; fileContent?: string };
      const { userId } = request.authUser!;
      const unitId = request.authUser?.unitId || null;

      // Compute SHA-256 hash of the file content if provided
      let fileHash: string | null = null;
      if (fileContent) {
        const buffer = Buffer.from(fileContent, "base64");
        fileHash = createHash("sha256").update(buffer).digest("hex");
      } else if (screenshotUrl) {
        // If a screenshot path is provided without inline content, try to hash from disk
        const safePath = validateFilePath(screenshotUrl, EVIDENCE_BASE_DIR);
        if (!safePath) {
          return sendError(reply, 400, "INVALID_FILE_PATH", "File path is outside the allowed storage directory");
        }
        try {
          const buffer = await readFile(safePath);
          fileHash = createHash("sha256").update(buffer).digest("hex");
        } catch (fsErr: unknown) {
          request.log.warn(fsErr, "Could not read file for hash computation");
        }
      } else if (archiveUrl) {
        const safeArchivePath = validateFilePath(archiveUrl, EVIDENCE_BASE_DIR);
        if (!safeArchivePath) {
          return sendError(reply, 400, "INVALID_FILE_PATH", "File path is outside the allowed storage directory");
        }
        try {
          const buffer = await readFile(safeArchivePath);
          fileHash = createHash("sha256").update(buffer).digest("hex");
        } catch (fsErr: unknown) {
          request.log.warn(fsErr, "Could not read archive for hash computation");
        }
      }

      const refResult = await query(`SELECT 'TEF-EVD-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(nextval('sm_evidence_ref_seq')::text, 6, '0') AS ref`);
      const evidenceRef = refResult.rows[0].ref;
      const result = await query(
        `INSERT INTO evidence_item (content_id, capture_type, screenshot_url, archive_url, hash_sha256, captured_by, unit_id, evidence_ref)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING evidence_id, evidence_ref, content_id, capture_type, hash_sha256, state_id, captured_by, created_at`,
        [contentId, captureType || "MANUAL", screenshotUrl || null, archiveUrl || null, fileHash, userId, unitId, evidenceRef],
      );
      reply.code(201);
      return { evidence: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to capture evidence");
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
        `SELECT evidence_id, evidence_ref, content_id, alert_id, case_id, capture_type, screenshot_url,
                archive_url, hash_sha256, chain_of_custody, state_id, row_version,
                captured_by, created_at, updated_at
         FROM evidence_item WHERE evidence_id = $1 AND (unit_id = $2::uuid)`,
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

  // Serve evidence file (screenshot or archive) to frontend
  app.get("/api/v1/evidence/:id/file", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const unitId = request.authUser?.unitId || null;
      const result = await query(
        `SELECT evidence_id, screenshot_url, archive_url FROM evidence_item WHERE evidence_id = $1 AND (unit_id = $2::uuid OR unit_id IS NULL)`,
        [id, unitId],
      );
      if (result.rows.length === 0) return send404(reply, "EVIDENCE_NOT_FOUND", "Evidence not found");
      const ev = result.rows[0];

      const fileUrl = ev.screenshot_url || ev.archive_url;
      if (!fileUrl) return sendError(reply, 404, "NO_FILE", "No file associated with this evidence");

      // fileUrl may be relative (e.g. "screenshots/xxx.png") — join with base dir
      const fullPath = fileUrl.startsWith("/") ? fileUrl : join(EVIDENCE_BASE_DIR, fileUrl);
      const safePath = validateFilePath(fullPath, EVIDENCE_BASE_DIR);
      if (!safePath) return sendError(reply, 400, "INVALID_FILE_PATH", "File path is outside the allowed storage directory");

      let buffer: Buffer;
      try {
        buffer = await readFile(safePath);
      } catch {
        return sendError(reply, 404, "FILE_NOT_FOUND", "Evidence file not found on disk");
      }

      // Log access as custody event
      const { userId } = request.authUser!;
      await query(
        `INSERT INTO custody_event (evidence_id, event_type, actor_id, details) VALUES ($1, 'FILE_ACCESSED', $2, '{}')`,
        [id, userId],
      ).catch((err: unknown) => { app.log.warn(err, "Custody event write failed"); });

      const ext = safePath.split(".").pop()?.toLowerCase();
      const mimeMap: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", pdf: "application/pdf", zip: "application/zip" };
      const contentType = mimeMap[ext || ""] || "application/octet-stream";
      const filename = safePath.split("/").pop() || "evidence-file";

      reply.header("Content-Type", contentType);
      reply.header("Content-Disposition", `inline; filename="${filename}"`);
      reply.header("Cache-Control", "private, max-age=300");
      return reply.send(buffer);
    } catch (err: unknown) {
      request.log.error(err, "Failed to serve evidence file");
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
      const result = await query(`SELECT evidence_id, hash_sha256, screenshot_url, archive_url, state_id FROM evidence_item WHERE evidence_id = $1`, [id]);
      if (result.rows.length === 0) return send404(reply, "EVIDENCE_NOT_FOUND", "Evidence not found");
      const ev = result.rows[0];

      if (!ev.hash_sha256) {
        return { evidenceId: ev.evidence_id, hashSha256: null, verified: false, reason: "NO_HASH_STORED", stateId: ev.state_id };
      }

      // Attempt to recompute hash from file on disk (try screenshot first, then archive)
      let recomputedHash: string | null = null;
      let verificationError: string | null = null;
      const fileUrl = ev.screenshot_url || ev.archive_url;
      if (fileUrl) {
        const safePath = validateFilePath(fileUrl, EVIDENCE_BASE_DIR);
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

      // Determine verification result enum
      const hashVerificationResult = !ev.hash_sha256 ? "NO_HASH"
        : !fileUrl ? "NO_FILE"
        : verified ? "MATCH" : "MISMATCH";

      // Persist verification result to evidence_item (ISO 27037)
      const { userId } = request.authUser!;
      await query(
        `UPDATE evidence_item SET verified_by = $2, verified_at = NOW(), hash_verification_result = $3 WHERE evidence_id = $1`,
        [id, userId, hashVerificationResult],
      ).catch((err: unknown) => { app.log.warn(err, "Verification result persist failed"); });

      // Log verification attempt as custody event
      await query(
        `INSERT INTO custody_event (evidence_id, event_type, actor_id, details) VALUES ($1, 'HASH_VERIFIED', $2, $3)`,
        [id, userId, JSON.stringify({ verified, storedHash: ev.hash_sha256, recomputedHash, verificationError, hashVerificationResult })],
      ).catch((custodyErr: unknown) => { app.log.warn(custodyErr, "Custody event write failed"); });

      return {
        evidenceId: ev.evidence_id,
        hashSha256: ev.hash_sha256,
        recomputedHash: recomputedHash || null,
        verified,
        hashVerificationResult,
        ...(verificationError ? { reason: verificationError } : {}),
        stateId: ev.state_id,
      };
    } catch (err: unknown) {
      request.log.error(err, "Failed to verify evidence hash");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.get("/api/v1/evidence/:id/transitions", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(`SELECT state_id FROM evidence_item WHERE evidence_id = $1`, [id]);
      if (result.rows.length === 0) return send404(reply, "EVIDENCE_NOT_FOUND", "Evidence not found");
      return { transitions: getAvailableTransitions("sm_evidence", result.rows[0].state_id) };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get evidence transitions");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.post("/api/v1/evidence/:id/transition", {
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
        id, "sm_evidence", transitionId, userId, "OFFICER", roles, remarks,
      );
      if (!result.success) {
        if (result.error === "ENTITY_NOT_FOUND") return send404(reply, "EVIDENCE_NOT_FOUND", "Evidence not found");
        return sendError(reply, 409, result.error || "TRANSITION_FAILED", "Evidence transition failed");
      }
      return { success: true, newStateId: result.newStateId };
    } catch (err: unknown) {
      request.log.error(err, "Failed to execute evidence transition");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Package evidence as ZIP with SHA-256 manifest
  app.post("/api/v1/evidence/:id/package", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    if (!requireAnalyst(request, reply)) return;
    try {
      const { id } = request.params as { id: string };
      const { userId } = request.authUser!;
      const unitId = request.authUser?.unitId || null;

      const result = await query(
        `SELECT e.evidence_id, e.evidence_ref, e.content_id, e.case_id, e.capture_type,
                e.screenshot_url, e.archive_url, e.hash_sha256
         FROM evidence_item e
         WHERE e.evidence_id = $1 AND e.unit_id = $2::uuid`,
        [id, unitId],
      );
      if (result.rows.length === 0) return send404(reply, "EVIDENCE_NOT_FOUND", "Evidence not found");
      const ev = result.rows[0];

      const items: Array<{ filename: string; data: Buffer; mimeType: string; metadata?: Record<string, unknown> }> = [];
      const fileUrl = ev.screenshot_url || ev.archive_url;
      if (fileUrl) {
        const safePath = validateFilePath(fileUrl, EVIDENCE_BASE_DIR);
        if (!safePath) {
          return sendError(reply, 400, "INVALID_FILE_PATH", "Evidence file path is outside the allowed storage directory");
        }
        try {
          const buffer = await readFile(safePath);
          const filename = fileUrl.split("/").pop() || "evidence-file";
          const mimeType = ev.screenshot_url ? "image/png" : "application/octet-stream";
          items.push({
            filename,
            data: buffer,
            mimeType,
            metadata: { evidenceRef: ev.evidence_ref, storedHash: ev.hash_sha256 },
          });
        } catch (fsErr: unknown) {
          request.log.warn(fsErr, "Could not read evidence file for packaging");
          return sendError(reply, 422, "FILE_NOT_ACCESSIBLE", "Evidence file could not be read from storage");
        }
      } else {
        return sendError(reply, 422, "NO_FILE_PATH", "Evidence has no associated file to package");
      }

      // FR-10: Apply watermark on evidence export/share
      const watermarkText = await generateAndLogWatermark(userId, "sm_evidence", id, "EVIDENCE_PACKAGE");

      const caseId = ev.case_id || ev.content_id || "unknown";
      const packager = createEvidencePackager();
      const zipBuffer = await packager.packageEvidence(caseId, userId, items);

      await query(
        `INSERT INTO custody_event (evidence_id, event_type, actor_id, details) VALUES ($1, 'PACKAGED', $2, $3)`,
        [id, userId, JSON.stringify({ format: "ZIP+SHA256", itemCount: items.length, watermark: watermarkText })],
      ).catch((err: unknown) => { app.log.warn(err, "Custody event write failed"); });

      reply.header("Content-Type", "application/zip");
      reply.header("Content-Disposition", `attachment; filename="evidence-${ev.evidence_ref}.zip"`);
      reply.header("X-Watermark", watermarkText);
      return reply.send(zipBuffer);
    } catch (err: unknown) {
      request.log.error(err, "Failed to package evidence");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Apply legal hold to evidence
  app.post("/api/v1/evidence/:id/legal-hold", {
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", required: ["holdReason"], properties: { holdReason: { type: "string" }, legalReference: { type: "string" } } },
    },
  }, async (request, reply) => {
    if (!requireCustodian(request, reply)) return;
    try {
      const { id } = request.params as { id: string };
      const { holdReason, legalReference } = request.body as { holdReason: string; legalReference?: string };
      const { userId } = request.authUser!;

      const result = await query(
        `INSERT INTO evidence_legal_hold (evidence_id, hold_reason, legal_reference, held_by)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [id, holdReason, legalReference || null, userId],
      );

      await query(
        `INSERT INTO custody_event (evidence_id, event_type, actor_id, details) VALUES ($1, 'LEGAL_HOLD_APPLIED', $2, $3)`,
        [id, userId, JSON.stringify({ holdReason, legalReference })],
      ).catch((err: unknown) => { app.log.warn(err, "Custody event write failed"); });

      reply.code(201);
      return { hold: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to apply legal hold");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Release legal hold
  app.post("/api/v1/evidence/:id/legal-hold/:holdId/release", {
    schema: {
      params: { type: "object", required: ["id", "holdId"], properties: { id: { type: "string", format: "uuid" }, holdId: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    if (!requireCustodian(request, reply)) return;
    try {
      const { id, holdId } = request.params as { id: string; holdId: string };
      const { userId } = request.authUser!;

      const result = await query(
        `UPDATE evidence_legal_hold SET is_active = FALSE, released_by = $2, released_at = NOW(), updated_at = NOW()
         WHERE hold_id = $1 AND is_active = TRUE RETURNING *`,
        [holdId, userId],
      );
      if (result.rowCount === 0) return send404(reply, "HOLD_NOT_FOUND", "Active legal hold not found");

      await query(
        `INSERT INTO custody_event (evidence_id, event_type, actor_id, details) VALUES ($1, 'LEGAL_HOLD_RELEASED', $2, $3)`,
        [id, userId, JSON.stringify({ holdId })],
      ).catch((err: unknown) => { app.log.warn(err, "Custody event write failed"); });

      return { hold: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to release legal hold");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get legal holds for evidence
  app.get("/api/v1/evidence/:id/legal-holds", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(
        `SELECT elh.*, hb.full_name AS held_by_name, rb.full_name AS released_by_name
         FROM evidence_legal_hold elh
         LEFT JOIN user_account hb ON hb.user_id = elh.held_by
         LEFT JOIN user_account rb ON rb.user_id = elh.released_by
         WHERE elh.evidence_id = $1 ORDER BY elh.held_at DESC`,
        [id],
      );
      return { holds: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get legal holds");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Copy evidence (creates derivative with parent link)
  app.post("/api/v1/evidence/:id/copy", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    if (!requireAnalyst(request, reply)) return;
    try {
      const { id } = request.params as { id: string };
      const { userId } = request.authUser!;
      const unitId = request.authUser?.unitId || null;

      const original = await query("SELECT * FROM evidence_item WHERE evidence_id = $1", [id]);
      if (original.rows.length === 0) return send404(reply, "EVIDENCE_NOT_FOUND", "Evidence not found");
      const ev = original.rows[0];

      const refResult = await query(`SELECT 'TEF-EVD-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(nextval('sm_evidence_ref_seq')::text, 6, '0') AS ref`);
      const result = await query(
        `INSERT INTO evidence_item (content_id, capture_type, screenshot_url, archive_url, hash_sha256, captured_by, unit_id, evidence_ref, is_original, parent_evidence_id, hash_algorithm)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, $9, $10)
         RETURNING evidence_id, evidence_ref`,
        [ev.content_id, ev.capture_type, ev.screenshot_url, ev.archive_url, ev.hash_sha256, userId, unitId, refResult.rows[0].ref, id, ev.hash_algorithm || "SHA-256"],
      );

      reply.code(201);
      return { copy: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to copy evidence");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Retention dashboard stats
  app.get("/api/v1/dashboard/retention", async (request, reply) => {
    try {
      const stats = await getRetentionDashboardStats();
      return { retention: stats };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get retention stats");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Court export: ZIP with evidence file + OSINT report PDF + custody CSV
  app.post("/api/v1/evidence/:id/court-export", {
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", properties: { officerName: { type: "string" }, officerBadge: { type: "string" }, caseId: { type: "string" } } },
    },
  }, async (request, reply) => {
    if (!requireAnalyst(request, reply)) return;
    try {
      const { id } = request.params as { id: string };
      const { userId } = request.authUser!;
      const body = request.body as { officerName?: string; officerBadge?: string; caseId?: string };
      const unitId = request.authUser?.unitId || null;

      const evResult = await query(
        `SELECT e.*, u.full_name AS captured_by_name
         FROM evidence_item e LEFT JOIN user_account u ON u.user_id = e.captured_by
         WHERE e.evidence_id = $1 AND e.unit_id = $2::uuid`,
        [id, unitId],
      );
      if (evResult.rows.length === 0) return send404(reply, "EVIDENCE_NOT_FOUND", "Evidence not found");
      const ev = evResult.rows[0];

      // Generate OSINT report PDF
      const reportPdf = await generateOsintCollectionReport({
        evidenceId: id,
        caseId: body.caseId || ev.case_id,
        officerName: body.officerName || ev.captured_by_name || "Officer",
        officerBadge: body.officerBadge,
      });

      const items: Array<{ filename: string; data: Buffer; mimeType: string; metadata?: Record<string, unknown> }> = [];
      items.push({ filename: "osint-report.pdf", data: reportPdf, mimeType: "application/pdf" });

      // Include evidence file if available
      const fileUrl = ev.screenshot_url || ev.archive_url;
      if (fileUrl) {
        const safePath = validateFilePath(fileUrl, EVIDENCE_BASE_DIR);
        if (safePath) {
          try {
            const buffer = await readFile(safePath);
            items.push({ filename: fileUrl.split("/").pop() || "evidence-file", data: buffer, mimeType: "application/octet-stream" });
          } catch { /* file may not be accessible */ }
        }
      }

      const watermarkText = await generateAndLogWatermark(userId, "sm_evidence", id, "COURT_EXPORT");
      const packager = createEvidencePackager();
      const zipBuffer = await packager.packageEvidence(ev.case_id || id, userId, items);

      await query(
        `INSERT INTO custody_event (evidence_id, event_type, actor_id, details) VALUES ($1, 'COURT_EXPORTED', $2, $3)`,
        [id, userId, JSON.stringify({ format: "ZIP+PDF+SHA256", watermark: watermarkText })],
      ).catch((err: unknown) => { app.log.warn(err, "Custody event write failed"); });

      reply.header("Content-Type", "application/zip");
      reply.header("Content-Disposition", `attachment; filename="court-export-${ev.evidence_ref || id}.zip"`);
      return reply.send(zipBuffer);
    } catch (err: unknown) {
      request.log.error(err, "Failed to generate court export");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // OSINT metadata for an evidence item
  app.get("/api/v1/evidence/:id/osint-metadata", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(
        `SELECT evidence_id, capture_method, capture_tool_version, capture_timestamp,
                source_platform, source_url, source_post_id, source_author_handle,
                hash_algorithm, hash_sha256, hash_verification_result, is_original, parent_evidence_id
         FROM evidence_item WHERE evidence_id = $1`,
        [id],
      );
      if (result.rows.length === 0) return send404(reply, "EVIDENCE_NOT_FOUND", "Evidence not found");
      return { metadata: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get OSINT metadata");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
