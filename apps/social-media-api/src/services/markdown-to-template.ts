/**
 * Converts LLM-generated markdown into a ReportTemplate structure
 * compatible with createPdfGenerator().generate().
 */
import type { ReportTemplate, ReportSection } from "@puda/api-integrations";

interface TemplateMetadata {
  title: string;
  subtitle?: string;
  referenceNumber?: string;
  department?: string;
  generatedBy?: string;
}

/**
 * Parse a markdown table block into headers and rows.
 * Expects lines like: `| H1 | H2 |` with a separator line `| --- | --- |`.
 */
function parseMarkdownTable(lines: string[]): { headers: string[]; rows: string[][] } | null {
  if (lines.length < 2) return null;

  const parseLine = (line: string): string[] =>
    line.split("|").map((c) => c.trim()).filter((c) => c.length > 0);

  const headers = parseLine(lines[0]);
  if (headers.length === 0) return null;

  // Skip separator line (line with dashes)
  const startIdx = lines[1].replace(/[\s|:-]/g, "").length === 0 ? 2 : 1;

  const rows: string[][] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    if (cells.length > 0) rows.push(cells);
  }

  return { headers, rows };
}

export function markdownToReportTemplate(
  markdown: string,
  metadata: TemplateMetadata,
): ReportTemplate {
  const sections: ReportSection[] = [];
  const lines = markdown.split("\n");

  let currentTitle: string | undefined;
  let currentLines: string[] = [];

  const flushSection = () => {
    if (currentLines.length === 0 && !currentTitle) return;

    const text = currentLines.join("\n").trim();
    if (!text && !currentTitle) return;

    // Check if this section is primarily a table
    const tableLines = currentLines.filter((l) => l.trim().startsWith("|") && l.trim().endsWith("|"));
    const nonTableText = currentLines
      .filter((l) => !(l.trim().startsWith("|") && l.trim().endsWith("|")))
      .join("\n")
      .trim();

    if (tableLines.length >= 2) {
      // Has a table — emit any preceding text first
      if (nonTableText) {
        sections.push({ type: "text", title: currentTitle, content: nonTableText });
        // Table becomes a separate section without repeating title
        const table = parseMarkdownTable(tableLines);
        if (table) {
          sections.push({ type: "table", headers: table.headers, rows: table.rows });
        }
      } else {
        const table = parseMarkdownTable(tableLines);
        if (table) {
          sections.push({ type: "table", title: currentTitle, headers: table.headers, rows: table.rows });
        }
      }
    } else if (text) {
      sections.push({ type: "text", title: currentTitle, content: text });
    }

    currentTitle = undefined;
    currentLines = [];
  };

  for (const line of lines) {
    // Match ## headings (level 2)
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      flushSection();
      currentTitle = h2Match[1].trim();
      continue;
    }

    // Match ### headings (level 3) — treat as sub-section
    const h3Match = line.match(/^###\s+(.+)$/);
    if (h3Match) {
      flushSection();
      currentTitle = h3Match[1].trim();
      continue;
    }

    // Skip top-level # heading (used as document title, already in header)
    if (line.match(/^#\s+/)) continue;

    currentLines.push(line);
  }

  flushSection();

  return {
    header: {
      title: metadata.title,
      subtitle: metadata.subtitle,
      referenceNumber: metadata.referenceNumber,
      department: metadata.department || "Punjab Police — Social Media Intelligence",
      generatedBy: metadata.generatedBy,
      generatedAt: new Date().toISOString(),
    },
    sections,
    footer: {
      confidentiality: "CONFIDENTIAL — For Official Use Only",
      pageNumbers: true,
    },
  };
}
