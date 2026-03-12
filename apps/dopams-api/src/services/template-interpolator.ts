import type { ReportTemplate, ReportSection } from "@puda/api-integrations";

/**
 * Interpolate {{placeholder}} patterns in a string with variable values.
 */
export function interpolate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return key in variables ? variables[key] : `{{${key}}}`;
  });
}

/**
 * Extract all {{placeholder}} names from a template string.
 */
export function extractPlaceholders(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  const names = matches.map((m) => m.slice(2, -2));
  return [...new Set(names)];
}

/**
 * Walk all string values in a ReportTemplate and interpolate placeholders.
 */
export function interpolateTemplate(
  template: ReportTemplate,
  vars: Record<string, string>,
): ReportTemplate {
  const interpStr = (s: string | undefined): string | undefined =>
    s ? interpolate(s, vars) : s;

  const header = {
    ...template.header,
    title: interpolate(template.header.title, vars),
    subtitle: interpStr(template.header.subtitle),
    department: interpStr(template.header.department),
    generatedBy: interpStr(template.header.generatedBy),
    generatedAt: interpStr(template.header.generatedAt),
    referenceNumber: interpStr(template.header.referenceNumber),
  };

  const sections: ReportSection[] = template.sections.map((sec) => {
    const result: ReportSection = { ...sec };
    if (sec.title) result.title = interpolate(sec.title, vars);
    if (sec.content) result.content = interpolate(sec.content, vars);
    if (sec.entries) {
      result.entries = sec.entries.map((e) => ({
        label: interpolate(e.label, vars),
        value: interpolate(e.value, vars),
      }));
    }
    if (sec.rows) {
      result.rows = sec.rows.map((row) => row.map((cell) => interpolate(cell, vars)));
    }
    if (sec.headers) {
      result.headers = sec.headers.map((h) => interpolate(h, vars));
    }
    return result;
  });

  const footer = template.footer
    ? {
        ...template.footer,
        text: interpStr(template.footer.text),
        confidentiality: interpStr(template.footer.confidentiality),
      }
    : undefined;

  return { ...template, header, sections, footer };
}
