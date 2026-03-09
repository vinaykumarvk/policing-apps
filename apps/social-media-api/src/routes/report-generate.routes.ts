/**
 * LLM-powered report generation endpoints.
 *
 * POST /api/v1/reports/generate      — generate markdown report from case data
 * POST /api/v1/reports/generate/pdf  — convert markdown to PDF
 */
import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";
import { llmComplete, isLlmAvailable } from "../services/llm-provider";
import type { LlmUseCase } from "../services/llm-provider";
import { markdownToReportTemplate } from "../services/markdown-to-template";
import { createPdfGenerator } from "@puda/api-integrations";

// ── System prompts per report type ──────────────────────────────────────────

const SYSTEM_PROMPTS: Record<string, string> = {
  case_summary: `You are a senior intelligence analyst for Punjab Police Social Media Intelligence Unit.
Generate a structured Case Summary Report in markdown format with these sections:
## Overview
## Key Findings
## Social Media Activity
## Evidence Summary
## Risk Assessment
## Recommendations

Use factual, professional language appropriate for a police intelligence report. Include specific details from the case data provided. Use bullet points for lists. If data is missing for a section, note "No data available" rather than fabricating information.`,

  legal_references: `You are a legal analyst for Punjab Police Social Media Intelligence Unit.
Generate a Legal References Report in markdown format with these sections:
## Applicable Legal Provisions
Include a markdown table with columns: | Act | Section | Description | Max Penalty |
## Legal Analysis
## Jurisdictional Notes
## Evidentiary Requirements

Reference Indian Penal Code (IPC), Bharatiya Nyaya Sanhita (BNS), Information Technology Act, NDPS Act, and other applicable statutes. Be precise with section numbers. If the case data suggests specific offences, map them to the relevant legal provisions.`,

  final_submission: `You are a senior intelligence analyst preparing a court-ready Final Submission Report for Punjab Police.
Generate a comprehensive report in markdown format with these sections:
## Case Summary
## Investigation Methodology
## Digital Evidence
## Social Media Findings
## Applicable Legal Provisions
Include a markdown table with columns: | Act | Section | Offence | Max Penalty |
## Chain of Custody
## Conclusions
## Recommendations

This document must be thorough, precise, and suitable for submission to judicial authorities. Use formal language. Reference specific evidence items, timestamps, and platform details. Note any gaps or limitations in the investigation.`,
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
    `SELECT * FROM case_record WHERE case_id = $1::uuid`,
    [caseId],
  );
  if (caseRes.rows.length === 0) return null;

  const caseRow = caseRes.rows[0];

  const [alertsRes, contentRes, evidenceRes, legalRes] = await Promise.all([
    // Alerts linked via source_alert_id
    query(
      `SELECT a.alert_id, a.title, a.priority, a.state_id, a.created_at
       FROM sm_alert a
       WHERE a.alert_id = (SELECT source_alert_id FROM case_record WHERE case_id = $1::uuid)
       ORDER BY a.created_at DESC LIMIT 50`,
      [caseId],
    ),
    // Content linked via alert's content_id or evidence items
    query(
      `SELECT ci.content_id, ci.platform, ci.author_handle AS author_username, ci.content_text AS text_content,
              cr.category AS classification, ci.threat_score AS risk_score, ci.created_at
       FROM content_item ci
       LEFT JOIN LATERAL (
         SELECT category, risk_score FROM classification_result
         WHERE entity_type = 'content_item' AND entity_id = ci.content_id
         ORDER BY created_at DESC LIMIT 1
       ) cr ON true
       WHERE ci.content_id IN (
         SELECT a.content_id FROM sm_alert a
         WHERE a.alert_id = (SELECT source_alert_id FROM case_record WHERE case_id = $1::uuid)
           AND a.content_id IS NOT NULL
         UNION
         SELECT e.content_id FROM evidence_item e WHERE e.case_id = $1::uuid AND e.content_id IS NOT NULL
       )
       ORDER BY ci.created_at DESC LIMIT 50`,
      [caseId],
    ),
    // Evidence items linked to the case
    query(
      `SELECT e.evidence_id, e.capture_type AS evidence_type, e.screenshot_url AS file_name,
              e.hash_sha256, e.capture_timestamp AS collected_at, e.captured_by AS collected_by
       FROM evidence_item e
       WHERE e.case_id = $1::uuid
       ORDER BY e.capture_timestamp DESC LIMIT 50`,
      [caseId],
    ),
    // Legal mappings via statute_library
    query(
      `SELECT sl.act_name, sl.section, sl.description, sl.penalty_summary, lm.confidence
       FROM legal_mapping lm
       JOIN statute_library sl ON sl.statute_id = lm.statute_id
       WHERE lm.entity_type = 'case_record' AND lm.entity_id = $1
       ORDER BY lm.confidence DESC`,
      [caseId],
    ).catch(() => ({ rows: [] })),
  ]);

  return {
    case: caseRow,
    alerts: alertsRes.rows,
    content: contentRes.rows,
    evidence: evidenceRes.rows,
    legalMappings: legalRes.rows,
  };
}

function buildUserPrompt(data: ReturnType<typeof gatherCaseData> extends Promise<infer T> ? NonNullable<T> : never): string {
  const c = data.case;
  let prompt = `# Case Data\n\n`;
  prompt += `**Case ID:** ${c.case_id}\n`;
  prompt += `**Case Ref:** ${c.case_ref || "N/A"}\n`;
  prompt += `**Title:** ${c.title || "Untitled"}\n`;
  prompt += `**Status:** ${c.state_id || "N/A"}\n`;
  prompt += `**Priority:** ${c.priority || "N/A"}\n`;
  prompt += `**Created:** ${c.created_at || "N/A"}\n`;
  if (c.description) prompt += `**Description:** ${c.description}\n`;
  prompt += `\n`;

  if (data.alerts.length > 0) {
    prompt += `## Linked Alerts (${data.alerts.length})\n\n`;
    for (const a of data.alerts) {
      prompt += `- **${a.title}** (Priority: ${a.priority}, Status: ${a.state_id}, Created: ${a.created_at})\n`;
    }
    prompt += `\n`;
  }

  if (data.content.length > 0) {
    prompt += `## Linked Content Items (${data.content.length})\n\n`;
    for (const ci of data.content) {
      const text = ci.text_content ? ci.text_content.slice(0, 300) : "N/A";
      prompt += `- **${ci.platform}** by @${ci.author_username} — Classification: ${ci.classification || "N/A"}, Risk: ${ci.risk_score || "N/A"}\n  > ${text}\n`;
    }
    prompt += `\n`;
  }

  if (data.evidence.length > 0) {
    prompt += `## Evidence Items (${data.evidence.length})\n\n`;
    for (const e of data.evidence) {
      prompt += `- **${e.evidence_type}**: ${e.file_name} (Hash: ${e.hash_sha256 || "N/A"}, Collected: ${e.collected_at || "N/A"} by ${e.collected_by || "N/A"})\n`;
    }
    prompt += `\n`;
  }

  if (data.legalMappings.length > 0) {
    prompt += `## Legal Mappings\n\n`;
    for (const lm of data.legalMappings) {
      prompt += `- **${lm.act_name}** Section ${lm.section}: ${lm.description} (Penalty: ${lm.penalty_summary || "N/A"}, Confidence: ${lm.confidence}%)\n`;
    }
    prompt += `\n`;
  }

  prompt += `\nGenerate the report based on the above case data.`;
  return prompt;
}

// ── Route Registration ──────────────────────────────────────────────────────

export async function registerReportGenerateRoutes(app: FastifyInstance) {
  /**
   * POST /api/v1/reports/generate
   * Generate a markdown report from case data using LLM.
   */
  app.post("/api/v1/reports/generate", async (request, reply) => {
    const { caseId, reportType } = request.body as { caseId?: string; reportType?: string };

    if (!caseId || !reportType) {
      return sendError(reply, 400, "caseId and reportType are required");
    }

    if (!SYSTEM_PROMPTS[reportType]) {
      return sendError(reply, 400, `Invalid reportType. Must be one of: ${Object.keys(SYSTEM_PROMPTS).join(", ")}`);
    }

    const available = await isLlmAvailable();
    if (!available) {
      return sendError(reply, 503, "No LLM provider is configured. Please configure an API key in Settings > Model Admin.");
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
      return sendError(reply, 502, "LLM generation failed. Please try again or check provider configuration.");
    }

    return reply.send({
      markdown: result.content,
      reportType,
      caseRef: caseData.case.case_ref || caseData.case.case_id,
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
  app.post("/api/v1/reports/generate/pdf", async (request, reply) => {
    const { markdown, reportType, caseRef, title } = request.body as {
      markdown?: string;
      reportType?: string;
      caseRef?: string;
      title?: string;
    };

    if (!markdown) {
      return sendError(reply, 400, "markdown is required");
    }

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
