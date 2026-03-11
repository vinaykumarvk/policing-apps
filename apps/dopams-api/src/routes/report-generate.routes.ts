/**
 * LLM-powered report generation endpoints for DOPAMS.
 *
 * POST /api/v1/reports/generate     — generate markdown report from case data
 * POST /api/v1/reports/generate/pdf — convert markdown to PDF
 */
import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";
import { llmComplete, isLlmAvailable } from "../services/llm-provider";
import type { LlmUseCase } from "../services/llm-provider";
import { markdownToReportTemplate } from "../services/markdown-to-template";
import { createPdfGenerator } from "@puda/api-integrations";
import { createRoleGuard } from "@puda/api-core";

// ── System prompts per report type ──────────────────────────────────────────

const SYSTEM_PROMPTS: Record<string, string> = {
  case_summary: `You are a senior intelligence analyst for Punjab Police Drug Operations Unit (DOPAMS).
Generate a structured Case Summary Report in markdown format with these sections:
## Overview
## Key Findings
## Subject Profile
## Drug Seizure Details
## Evidence Summary
## Risk Assessment
## Recommendations

Use factual, professional language appropriate for a police intelligence report. Include specific details from the case data provided. Use bullet points for lists. If data is missing for a section, note "No data available" rather than fabricating information.`,

  legal_references: `You are a legal analyst for Punjab Police Drug Operations Unit (DOPAMS).
Generate a Legal References Report in markdown format with these sections:
## Applicable Legal Provisions
Include a markdown table with columns: | Act | Section | Description | Max Penalty |
## Legal Analysis
## Jurisdictional Notes
## Evidentiary Requirements

Reference NDPS Act 1985, Bharatiya Nyaya Sanhita (BNS), Punjab Excise Act, PIT NDPS Act, and other applicable narcotic statutes. Be precise with section numbers. Map offences from the case data to relevant legal provisions.`,

  final_submission: `You are a senior intelligence analyst preparing a court-ready Final Submission Report for Punjab Police DOPAMS Unit.
Generate a comprehensive report in markdown format with these sections:
## Case Summary
## Investigation Methodology
## Subject Background
## Drug Seizure Analysis
## Digital & Physical Evidence
## Applicable Legal Provisions
Include a markdown table with columns: | Act | Section | Offence | Max Penalty |
## Chain of Custody
## Conclusions
## Recommendations

This document must be thorough, precise, and suitable for submission to judicial authorities. Use formal language. Reference specific evidence items, seizure quantities, and investigation details. Note any gaps or limitations.`,
};

const USE_CASE_MAP: Record<string, LlmUseCase> = {
  case_summary: "CASE_SUMMARY",
  legal_references: "LEGAL_REFERENCES",
  final_submission: "FINAL_SUBMISSION",
};

const REPORT_TITLES: Record<string, string> = {
  case_summary: "Case Summary Report",
  legal_references: "Legal References Report",
  final_submission: "Final Submission Report",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

async function gatherCaseData(caseId: string) {
  const caseRes = await query(
    `SELECT * FROM dopams_case WHERE case_id = $1`,
    [caseId],
  );
  if (caseRes.rows.length === 0) return null;

  const caseRow = caseRes.rows[0];

  const [alertsRes, subjectsRes, seizuresRes, evidenceRes, legalRes] = await Promise.all([
    // Alerts linked to case
    query(
      `SELECT alert_id, title, severity, alert_type, state_id, created_at
       FROM alert
       WHERE case_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [caseId],
    ).catch(() => ({ rows: [] })),
    // Subjects linked to case
    query(
      `SELECT s.subject_id, s.subject_ref, s.full_name, s.threat_level, s.offender_status,
              s.primary_drug_type, s.operating_district, s.total_seizures, s.total_cases
       FROM subject s
       WHERE s.subject_id IN (
         SELECT subject_id FROM dopams_case WHERE case_id = $1 AND subject_id IS NOT NULL
         UNION
         SELECT subject_id FROM lead WHERE case_id = $1 AND subject_id IS NOT NULL
       )
       ORDER BY s.threat_level DESC NULLS LAST LIMIT 20`,
      [caseId],
    ).catch(() => ({ rows: [] })),
    // Seizure records linked to case
    query(
      `SELECT seizure_id, seizure_ref, drug_type, quantity_grams, quantity_display,
              seizure_date, seizure_location, fsl_result, recovery_circumstance
       FROM seizure_record
       WHERE case_id = $1
       ORDER BY seizure_date DESC LIMIT 30`,
      [caseId],
    ).catch(() => ({ rows: [] })),
    // Evidence items linked to case
    query(
      `SELECT evidence_id, evidence_type, file_name,
              hash_sha256, collected_at, collected_by
       FROM evidence_item
       WHERE case_id = $1
       ORDER BY collected_at DESC LIMIT 50`,
      [caseId],
    ).catch(() => ({ rows: [] })),
    // Legal mapping rules applied
    query(
      `SELECT lmr.act_name, lmr.section_number, lmr.description, lmr.max_penalty, lmr.rule_code
       FROM legal_mapping_rule lmr
       WHERE lmr.rule_id IN (
         SELECT DISTINCT rule_id FROM case_legal_mapping WHERE case_id = $1
       )
       ORDER BY lmr.act_name, lmr.section_number`,
      [caseId],
    ).catch(() => ({ rows: [] })),
  ]);

  return {
    case: caseRow,
    alerts: alertsRes.rows,
    subjects: subjectsRes.rows,
    seizures: seizuresRes.rows,
    evidence: evidenceRes.rows,
    legalMappings: legalRes.rows,
  };
}

function buildUserPrompt(data: NonNullable<Awaited<ReturnType<typeof gatherCaseData>>>): string {
  const c = data.case;
  let prompt = `# Case Data\n\n`;
  prompt += `**Case Number:** ${c.case_number || "N/A"}\n`;
  prompt += `**Title:** ${c.title || "Untitled"}\n`;
  prompt += `**Type:** ${c.case_type || "N/A"}\n`;
  prompt += `**Status:** ${c.state_id || "N/A"}\n`;
  prompt += `**Priority:** ${c.priority || "N/A"}\n`;
  prompt += `**Created:** ${c.created_at || "N/A"}\n`;
  if (c.description) prompt += `**Description:** ${c.description}\n`;
  prompt += `\n`;

  if (data.subjects.length > 0) {
    prompt += `## Linked Subjects (${data.subjects.length})\n\n`;
    for (const s of data.subjects) {
      prompt += `- **${s.full_name}** (Ref: ${s.subject_ref}, Threat: ${s.threat_level || "N/A"}, Status: ${s.offender_status || "N/A"}, Drug: ${s.primary_drug_type || "N/A"}, District: ${s.operating_district || "N/A"}, Total Cases: ${s.total_cases || 0})\n`;
    }
    prompt += `\n`;
  }

  if (data.seizures.length > 0) {
    prompt += `## Drug Seizures (${data.seizures.length})\n\n`;
    for (const sz of data.seizures) {
      prompt += `- **${sz.drug_type || "Unknown"}**: ${sz.quantity_display || sz.quantity_grams + "g"} (Ref: ${sz.seizure_ref || "N/A"}, Date: ${sz.seizure_date || "N/A"}, Location: ${sz.seizure_location || "N/A"}, FSL: ${sz.fsl_result || "Pending"})\n`;
    }
    prompt += `\n`;
  }

  if (data.alerts.length > 0) {
    prompt += `## Linked Alerts (${data.alerts.length})\n\n`;
    for (const a of data.alerts) {
      prompt += `- **${a.title}** (Severity: ${a.severity}, Type: ${a.alert_type || "N/A"}, Status: ${a.state_id}, Created: ${a.created_at})\n`;
    }
    prompt += `\n`;
  }

  if (data.evidence.length > 0) {
    prompt += `## Evidence Items (${data.evidence.length})\n\n`;
    for (const e of data.evidence) {
      prompt += `- **${e.evidence_type || "Document"}**: ${e.file_name || "N/A"} (Hash: ${e.hash_sha256 || "N/A"}, Collected: ${e.collected_at || "N/A"} by ${e.collected_by || "N/A"})\n`;
    }
    prompt += `\n`;
  }

  if (data.legalMappings.length > 0) {
    prompt += `## Legal Provisions Applied\n\n`;
    for (const lm of data.legalMappings) {
      prompt += `- **${lm.act_name}** Section ${lm.section_number}: ${lm.description || "N/A"} (Max Penalty: ${lm.max_penalty || "N/A"})\n`;
    }
    prompt += `\n`;
  }

  prompt += `\nGenerate the report based on the above case data.`;
  return prompt;
}

// ── Route Registration ──────────────────────────────────────────────────────

export async function registerReportGenerateRoutes(app: FastifyInstance) {
  const requireReportAction = createRoleGuard(["INTELLIGENCE_ANALYST", "SUPERVISORY_OFFICER", "ADMINISTRATOR"]);
  /**
   * POST /api/v1/reports/generate
   * Generate a markdown report from case data using LLM.
   */
  app.post("/api/v1/reports/generate", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["caseId", "reportType"],
        properties: {
          caseId: { type: "string", format: "uuid" },
          reportType: { type: "string", enum: ["case_summary", "legal_references", "final_submission"] },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireReportAction(request, reply)) return;
    const { caseId, reportType } = request.body as { caseId: string; reportType: string };

    if (!SYSTEM_PROMPTS[reportType]) {
      return sendError(reply, 400, "VALIDATION_ERROR", `Invalid reportType. Must be one of: ${Object.keys(SYSTEM_PROMPTS).join(", ")}`);
    }

    const available = await isLlmAvailable();
    if (!available) {
      return sendError(reply, 503, "LLM_UNAVAILABLE", "No LLM provider is configured. Please configure an API key in Settings > Model Admin.");
    }

    const caseData = await gatherCaseData(caseId);
    if (!caseData) {
      return send404(reply, "Case not found");
    }

    const userPrompt = buildUserPrompt(caseData);
    const start = Date.now();

    const result = await llmComplete({
      messages: [
        { role: "system", content: SYSTEM_PROMPTS[reportType] },
        { role: "user", content: userPrompt },
      ],
      maxTokens: 4096,
      temperature: 0.3,
      useCase: USE_CASE_MAP[reportType],
      entityType: "case",
      entityId: caseId,
    });

    if (!result) {
      return sendError(reply, 502, "LLM_GENERATION_FAILED", "LLM generation failed. Please try again or check provider configuration.");
    }

    return reply.send({
      markdown: result.content,
      reportType,
      caseRef: caseData.case.case_number || caseData.case.case_id,
      caseTitle: caseData.case.title || "Untitled Case",
      provider: result.provider,
      model: result.model,
      latencyMs: Date.now() - start,
    });
  });

  /**
   * POST /api/v1/reports/generate/pdf
   * Convert markdown to PDF using the ReportTemplate pipeline.
   */
  app.post("/api/v1/reports/generate/pdf", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["markdown"],
        properties: {
          markdown: { type: "string", maxLength: 500000 },
          reportType: { type: "string", maxLength: 100 },
          caseRef: { type: "string", maxLength: 200 },
          title: { type: "string", maxLength: 500 },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireReportAction(request, reply)) return;
    const { markdown, reportType, caseRef, title } = request.body as {
      markdown: string;
      reportType?: string;
      caseRef?: string;
      title?: string;
    };

    const reportTitle = title || REPORT_TITLES[reportType || ""] || "Report";

    const template = markdownToReportTemplate(markdown, {
      title: reportTitle,
      subtitle: reportType ? REPORT_TITLES[reportType] : undefined,
      referenceNumber: caseRef,
    });

    const pdfGen = createPdfGenerator();
    const buffer = await pdfGen.generate(template);

    const fileName = `${reportType || "report"}_${caseRef || "unknown"}_${new Date().toISOString().slice(0, 10)}.pdf`;

    return reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `attachment; filename="${fileName}"`)
      .send(buffer);
  });
}
