import { query } from "../db";
import { createPdfGenerator, createDocxGenerator } from "@puda/api-integrations";
import type { ReportTemplate, ReportSection } from "@puda/api-integrations";

type DbRow = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContentSection {
  type: "text" | "table" | "keyValue";
  title: string;
  content?: string;
  entries?: Array<{ label: string; value: string }>;
  headers?: string[];
  rows?: string[][];
}

export interface DossierAssembleResult {
  dossierId: string;
  stateId: string;
  assembledAt: string;
  contentSections: ContentSection[];
}

export interface DossierExportResult {
  buffer: Buffer;
  format: "PDF" | "DOCX";
  contentType: string;
}

// ---------------------------------------------------------------------------
// assembleDossier
// ---------------------------------------------------------------------------

/**
 * Load subject data, criminal history, associated cases, leads, and
 * classification results. Build content_sections JSONB. Mark state ASSEMBLED.
 */
export async function assembleDossier(dossierId: string): Promise<DossierAssembleResult> {
  // Fetch the dossier row first to get subject_id and case_id
  const dossierResult = await query(
    `SELECT dossier_id, title, subject_id, case_id, state_id
     FROM dossier WHERE dossier_id = $1`,
    [dossierId],
  );

  if (dossierResult.rows.length === 0) {
    throw new Error("DOSSIER_NOT_FOUND");
  }

  const dossier = dossierResult.rows[0] as DbRow;
  const subjectId = dossier.subject_id as string | null;
  const caseId = dossier.case_id as string | null;

  const sections: ContentSection[] = [];

  // ---- Section 1: Personal Information (from subject_profile) ----
  if (subjectId) {
    const subjectResult = await query(
      `SELECT * FROM subject_profile WHERE subject_id = $1`,
      [subjectId],
    );
    if (subjectResult.rows.length > 0) {
      const s = subjectResult.rows[0] as DbRow;
      const entries: Array<{ label: string; value: string }> = [];

      const fieldMap: Array<[string, string]> = [
        ["full_name", "Full Name"],
        ["alias_names", "Aliases"],
        ["date_of_birth", "Date of Birth"],
        ["gender", "Gender"],
        ["nationality", "Nationality"],
        ["national_id", "National ID"],
        ["passport_number", "Passport Number"],
        ["address", "Address"],
        ["phone_numbers", "Phone Numbers"],
        ["email_addresses", "Email Addresses"],
        ["occupation", "Occupation"],
        ["employer", "Employer"],
        ["risk_score", "Risk Score"],
        ["risk_level", "Risk Level"],
        ["classification_label", "Classification"],
        ["known_associates_count", "Known Associates Count"],
        ["created_at", "Record Created"],
      ];

      for (const [col, label] of fieldMap) {
        const val = s[col];
        if (val !== null && val !== undefined) {
          const displayVal = Array.isArray(val)
            ? (val as unknown[]).join(", ")
            : typeof val === "object"
            ? JSON.stringify(val)
            : String(val);
          entries.push({ label, value: displayVal });
        }
      }

      sections.push({
        type: "keyValue",
        title: "Personal Information",
        entries,
      });
    }
  }

  // ---- Section 2: Criminal History ----
  if (subjectId) {
    const histResult = await query(
      `SELECT crime_type, description, incident_date, conviction_date,
              sentence, court_name, case_reference, state_id
       FROM criminal_history
       WHERE subject_id = $1
       ORDER BY incident_date DESC NULLS LAST`,
      [subjectId],
    );
    if (histResult.rows.length > 0) {
      sections.push({
        type: "table",
        title: "Criminal History",
        headers: ["Crime Type", "Description", "Incident Date", "Conviction Date", "Sentence", "Court", "Case Ref", "Status"],
        rows: histResult.rows.map((r) => {
          const row = r as DbRow;
          return [
            String(row.crime_type || ""),
            String(row.description || ""),
            row.incident_date ? String(row.incident_date).slice(0, 10) : "",
            row.conviction_date ? String(row.conviction_date).slice(0, 10) : "",
            String(row.sentence || ""),
            String(row.court_name || ""),
            String(row.case_reference || ""),
            String(row.state_id || ""),
          ];
        }),
      });
    } else {
      sections.push({
        type: "text",
        title: "Criminal History",
        content: "No criminal history records found.",
      });
    }
  }

  // ---- Section 3: Associated Cases ----
  if (subjectId) {
    const casesResult = await query(
      `SELECT dc.case_id, dc.case_number, dc.title, dc.case_type,
              dc.priority, dc.state_id, dc.created_at, cs.role
       FROM case_subject cs
       JOIN dopams_case dc ON dc.case_id = cs.case_id
       WHERE cs.subject_id = $1
       ORDER BY dc.created_at DESC`,
      [subjectId],
    );
    if (casesResult.rows.length > 0) {
      sections.push({
        type: "table",
        title: "Associated Cases",
        headers: ["Case Number", "Title", "Type", "Priority", "Status", "Role", "Date"],
        rows: casesResult.rows.map((r) => {
          const row = r as DbRow;
          return [
            String(row.case_number || ""),
            String(row.title || ""),
            String(row.case_type || ""),
            String(row.priority || ""),
            String(row.state_id || ""),
            String(row.role || ""),
            row.created_at ? String(row.created_at).slice(0, 10) : "",
          ];
        }),
      });
    }
  }

  // ---- Section 4: Leads ----
  if (subjectId) {
    const leadsResult = await query(
      `SELECT lead_ref, source_type, summary, priority, state_id, created_at
       FROM lead
       WHERE subject_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [subjectId],
    );
    if (leadsResult.rows.length > 0) {
      sections.push({
        type: "table",
        title: "Associated Leads",
        headers: ["Lead Ref", "Source", "Summary", "Priority", "Status", "Date"],
        rows: leadsResult.rows.map((r) => {
          const row = r as DbRow;
          return [
            String(row.lead_ref || ""),
            String(row.source_type || ""),
            String(row.summary || "").slice(0, 120),
            String(row.priority || ""),
            String(row.state_id || ""),
            row.created_at ? String(row.created_at).slice(0, 10) : "",
          ];
        }),
      });
    }
  }

  // ---- Section 5: Classification Results ----
  if (subjectId) {
    const classifyResult = await query(
      `SELECT classifier_type, label, confidence, metadata, created_at
       FROM subject_classification
       WHERE subject_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [subjectId],
    );
    if (classifyResult.rows.length > 0) {
      sections.push({
        type: "table",
        title: "Classification Results",
        headers: ["Classifier", "Label", "Confidence", "Date"],
        rows: classifyResult.rows.map((r) => {
          const row = r as DbRow;
          const conf = row.confidence !== null && row.confidence !== undefined
            ? `${(parseFloat(String(row.confidence)) * 100).toFixed(1)}%`
            : "";
          return [
            String(row.classifier_type || ""),
            String(row.label || ""),
            conf,
            row.created_at ? String(row.created_at).slice(0, 10) : "",
          ];
        }),
      });
    }
  }

  // ---- Section 6: Intelligence Summary (case context) ----
  if (caseId) {
    const caseResult = await query(
      `SELECT case_number, title, description, case_type, priority, state_id, created_at
       FROM dopams_case WHERE case_id = $1`,
      [caseId],
    );
    if (caseResult.rows.length > 0) {
      const c = caseResult.rows[0] as DbRow;
      sections.push({
        type: "keyValue",
        title: "Linked Case",
        entries: [
          { label: "Case Number", value: String(c.case_number || "") },
          { label: "Title", value: String(c.title || "") },
          { label: "Type", value: String(c.case_type || "") },
          { label: "Priority", value: String(c.priority || "") },
          { label: "Status", value: String(c.state_id || "") },
          { label: "Opened", value: c.created_at ? String(c.created_at).slice(0, 10) : "" },
          { label: "Description", value: String(c.description || "") },
        ],
      });
    }
  }

  // Persist content_sections and advance to ASSEMBLED
  const updateResult = await query(
    `UPDATE dossier
     SET content_sections = $2::jsonb,
         state_id = 'ASSEMBLED',
         assembled_at = NOW(),
         updated_at = NOW(),
         row_version = row_version + 1
     WHERE dossier_id = $1
     RETURNING dossier_id, state_id, assembled_at`,
    [dossierId, JSON.stringify(sections)],
  );

  const updated = updateResult.rows[0] as DbRow;

  return {
    dossierId: updated.dossier_id as string,
    stateId: updated.state_id as string,
    assembledAt: String(updated.assembled_at),
    contentSections: sections,
  };
}

// ---------------------------------------------------------------------------
// exportDossier
// ---------------------------------------------------------------------------

/**
 * Build a ReportTemplate from the dossier's content_sections and render it
 * to PDF or DOCX. Returns the raw Buffer and marks the dossier EXPORTED.
 */
export async function exportDossier(
  dossierId: string,
  format: "PDF" | "DOCX",
): Promise<DossierExportResult> {
  const result = await query(
    `SELECT dossier_id, dossier_ref, title, subject_id, case_id,
            content_sections, state_id, assembled_at, created_by
     FROM dossier WHERE dossier_id = $1`,
    [dossierId],
  );

  if (result.rows.length === 0) {
    throw new Error("DOSSIER_NOT_FOUND");
  }

  const dossier = result.rows[0] as DbRow;

  if (dossier.state_id === "DRAFT") {
    throw new Error("DOSSIER_NOT_ASSEMBLED");
  }

  // Parse stored content_sections
  let storedSections: ContentSection[] = [];
  try {
    const raw = dossier.content_sections;
    storedSections = typeof raw === "string"
      ? (JSON.parse(raw) as ContentSection[])
      : (raw as ContentSection[]);
  } catch {
    storedSections = [];
  }

  // Map ContentSection[] -> ReportSection[]
  const reportSections: ReportSection[] = storedSections.map((cs) => {
    const rs: ReportSection = { type: cs.type, title: cs.title };
    if (cs.content !== undefined) rs.content = cs.content;
    if (cs.entries !== undefined) rs.entries = cs.entries;
    if (cs.headers !== undefined) rs.headers = cs.headers;
    if (cs.rows !== undefined) rs.rows = cs.rows;
    return rs;
  });

  const template: ReportTemplate = {
    header: {
      title: String(dossier.title),
      subtitle: "Intelligence Dossier — DOPAMS",
      department: "Punjab Police — Drug Operations Planning, Analysis and Management System",
      referenceNumber: dossier.dossier_ref ? String(dossier.dossier_ref) : dossierId,
      generatedAt: new Date().toISOString().slice(0, 10),
    },
    sections: reportSections,
    footer: {
      confidentiality: "CONFIDENTIAL — For Authorised Personnel Only",
      pageNumbers: true,
    },
    watermark: "CONFIDENTIAL",
  };

  let buffer: Buffer;
  let contentType: string;

  if (format === "PDF") {
    const generator = createPdfGenerator();
    buffer = await generator.generate(template);
    contentType = "application/pdf";
  } else {
    const generator = createDocxGenerator();
    buffer = await generator.generate(template);
    contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  // Mark EXPORTED
  await query(
    `UPDATE dossier
     SET state_id = 'EXPORTED',
         exported_format = $2,
         updated_at = NOW(),
         row_version = row_version + 1
     WHERE dossier_id = $1`,
    [dossierId, format],
  );

  return { buffer, format, contentType };
}

// ---------------------------------------------------------------------------
// exportDossierPdfWithWatermark — FR-09
// ---------------------------------------------------------------------------

/**
 * Export a dossier as PDF with a user-specific watermark:
 * "CONFIDENTIAL - [username] - [timestamp]"
 */
export async function exportDossierPdfWithWatermark(
  dossierId: string,
  username: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const result = await query(
    `SELECT dossier_id, dossier_ref, title, subject_id, case_id,
            content_sections, state_id, assembled_at, created_by
     FROM dossier WHERE dossier_id = $1`,
    [dossierId],
  );

  if (result.rows.length === 0) {
    throw new Error("DOSSIER_NOT_FOUND");
  }

  const dossier = result.rows[0] as DbRow;

  if (dossier.state_id === "DRAFT") {
    throw new Error("DOSSIER_NOT_ASSEMBLED");
  }

  // Parse stored content_sections
  let storedSections: ContentSection[] = [];
  try {
    const raw = dossier.content_sections;
    storedSections = typeof raw === "string"
      ? (JSON.parse(raw) as ContentSection[])
      : (raw as ContentSection[]);
  } catch {
    storedSections = [];
  }

  // Map ContentSection[] -> ReportSection[]
  const reportSections: ReportSection[] = storedSections.map((cs) => {
    const rs: ReportSection = { type: cs.type, title: cs.title };
    if (cs.content !== undefined) rs.content = cs.content;
    if (cs.entries !== undefined) rs.entries = cs.entries;
    if (cs.headers !== undefined) rs.headers = cs.headers;
    if (cs.rows !== undefined) rs.rows = cs.rows;
    return rs;
  });

  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  const watermarkText = `CONFIDENTIAL - ${username} - ${timestamp}`;

  const template: ReportTemplate = {
    header: {
      title: String(dossier.title),
      subtitle: "Intelligence Dossier — DOPAMS",
      department: "Punjab Police — Drug Operations Planning, Analysis and Management System",
      referenceNumber: dossier.dossier_ref ? String(dossier.dossier_ref) : dossierId,
      generatedAt: new Date().toISOString().slice(0, 10),
    },
    sections: reportSections,
    footer: {
      confidentiality: "CONFIDENTIAL — For Authorised Personnel Only",
      pageNumbers: true,
    },
    watermark: watermarkText,
  };

  const generator = createPdfGenerator();
  const buffer = await generator.generate(template);

  return { buffer, contentType: "application/pdf" };
}

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

export async function listDossiers(filters: {
  subjectId?: string | null;
  stateId?: string | null;
  limit: number;
  offset: number;
}): Promise<{ dossiers: DbRow[]; total: number }> {
  const result = await query(
    `SELECT dossier_id, dossier_ref, title, subject_id, case_id,
            state_id, assembled_at, exported_format, created_by, created_at, updated_at,
            COUNT(*) OVER() AS total_count
     FROM dossier
     WHERE ($1::uuid IS NULL OR subject_id = $1::uuid)
       AND ($2::text IS NULL OR state_id = $2)
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`,
    [filters.subjectId || null, filters.stateId || null, filters.limit, filters.offset],
  );
  const total = result.rows.length > 0 ? parseInt(String(result.rows[0].total_count), 10) : 0;
  const dossiers = result.rows.map(({ total_count: _, ...r }) => r);
  return { dossiers, total };
}

export async function getDossier(dossierId: string): Promise<DbRow | null> {
  const result = await query(
    `SELECT dossier_id, dossier_ref, title, subject_id, case_id,
            content_sections, state_id, assembled_at, exported_format,
            row_version, created_by, created_at, updated_at
     FROM dossier WHERE dossier_id = $1`,
    [dossierId],
  );
  return result.rows[0] || null;
}

export async function createDossier(data: {
  title: string;
  subjectId?: string | null;
  caseId?: string | null;
  userId: string;
}): Promise<DbRow> {
  const refResult = await query(
    `SELECT 'DOP-DOS-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(nextval('dopams_dossier_ref_seq')::text, 6, '0') AS ref`,
  );
  const dossierRef: string = refResult.rows.length > 0
    ? String(refResult.rows[0].ref)
    : `DOP-DOS-${Date.now()}`;

  const result = await query(
    `INSERT INTO dossier (dossier_ref, title, subject_id, case_id, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING dossier_id, dossier_ref, title, subject_id, case_id,
               state_id, content_sections, created_by, created_at`,
    [
      dossierRef,
      data.title,
      data.subjectId || null,
      data.caseId || null,
      data.userId,
    ],
  );
  return result.rows[0];
}
