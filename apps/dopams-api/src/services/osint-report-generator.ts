import { query } from "../db";
import { createPdfGenerator } from "@puda/api-integrations";
import type { ReportTemplate } from "@puda/api-integrations";

interface OsintReportData {
  evidenceId: string;
  caseId?: string;
  officerName: string;
  officerBadge?: string;
}

/** Generate a court-ready OSINT evidence collection PDF report */
export async function generateOsintCollectionReport(data: OsintReportData): Promise<Buffer> {
  // Fetch evidence details
  const evResult = await query(
    `SELECT e.evidence_id, e.evidence_ref, e.hash_sha256, e.hash_algorithm,
            e.hash_verification_result, e.verified_by, e.verified_at,
            e.capture_method, e.capture_tool_version, e.capture_timestamp,
            e.source_platform, e.source_url, e.source_post_id, e.source_author_handle,
            e.state_id, e.created_at,
            v.full_name AS verifier_name
     FROM evidence e
     LEFT JOIN user_account v ON v.user_id = e.verified_by
     WHERE e.evidence_id = $1`,
    [data.evidenceId],
  );

  if (evResult.rows.length === 0) {
    throw new Error("Evidence not found");
  }
  const ev = evResult.rows[0];

  // Fetch custody chain
  const custodyResult = await query(
    `SELECT ce.event_type, ce.details, ce.created_at, u.full_name AS actor_name
     FROM custody_event ce
     LEFT JOIN user_account u ON u.user_id = ce.actor_id
     WHERE ce.evidence_id = $1
     ORDER BY ce.created_at ASC`,
    [data.evidenceId],
  );

  const custodyRows = custodyResult.rows.map((e: Record<string, unknown>) => [
    new Date(e.created_at as string).toISOString(),
    String(e.event_type),
    String(e.actor_name || "System"),
  ]);

  const template: ReportTemplate = {
    header: {
      title: "OSINT Evidence Collection Report",
      subtitle: "Court-Ready Evidence Documentation (ISO 27037)",
      department: "DOPAMS Intelligence Unit",
      generatedBy: data.officerName,
      generatedAt: new Date().toISOString(),
      referenceNumber: ev.evidence_ref || ev.evidence_id,
    },
    sections: [
      {
        type: "keyValue",
        title: "Case Information",
        entries: [
          { label: "Evidence Reference", value: ev.evidence_ref || ev.evidence_id },
          ...(data.caseId ? [{ label: "Case ID", value: data.caseId }] : []),
        ],
      },
      {
        type: "keyValue",
        title: "Evidence Metadata",
        entries: [
          { label: "Platform", value: ev.source_platform || "N/A" },
          { label: "Source URL", value: ev.source_url || "N/A" },
          { label: "Post ID", value: ev.source_post_id || "N/A" },
          { label: "Author Handle", value: ev.source_author_handle || "N/A" },
          { label: "Capture Method", value: ev.capture_method || "N/A" },
          { label: "Capture Tool", value: ev.capture_tool_version || "N/A" },
          { label: "Capture Timestamp", value: ev.capture_timestamp || ev.created_at },
        ],
      },
      {
        type: "keyValue",
        title: "Integrity Verification",
        entries: [
          { label: "Hash Algorithm", value: ev.hash_algorithm || "SHA-256" },
          { label: "Hash Value", value: ev.hash_sha256 || "N/A" },
          { label: "Verification Result", value: ev.hash_verification_result || "NOT VERIFIED" },
          { label: "Verified By", value: ev.verifier_name || "N/A" },
          { label: "Verified At", value: ev.verified_at || "N/A" },
        ],
      },
      {
        type: "table",
        title: "Chain of Custody",
        headers: ["Timestamp", "Event", "Actor"],
        rows: custodyRows,
      },
      {
        type: "text",
        title: "Officer Declaration",
        content:
          `I, ${data.officerName}, hereby declare that the above evidence was collected in accordance with ` +
          `established OSINT procedures and ISO 27037 digital evidence handling standards. The evidence ` +
          `has not been altered, modified, or tampered with since the time of collection.\n\n` +
          `Officer Name: ${data.officerName}\n` +
          (data.officerBadge ? `Badge/ID: ${data.officerBadge}\n` : "") +
          `Date: ${new Date().toISOString().split("T")[0]}\n\n` +
          `Signature: ____________________`,
      },
    ],
    footer: {
      confidentiality: "CONFIDENTIAL — Law Enforcement Use Only",
      pageNumbers: true,
    },
  };

  const pdf = createPdfGenerator();
  return pdf.generate(template);
}
