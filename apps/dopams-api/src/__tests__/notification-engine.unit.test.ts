import { describe, it, expect } from "vitest";

/**
 * Re-implementation of the private matchesConditions function from
 * ../services/notification-engine.ts
 *
 * Simple condition matcher: checks if all conditions in the rule match entity data.
 * Conditions format: { "field": "value" } or { "field": { "gte": 5 } }
 */
function matchesConditions(
  conditions: Record<string, unknown>,
  data: Record<string, unknown>,
): boolean {
  for (const [key, expected] of Object.entries(conditions)) {
    const actual = data[key];
    if (typeof expected === "object" && expected !== null && !Array.isArray(expected)) {
      const cond = expected as Record<string, unknown>;
      if (cond.gte !== undefined && (typeof actual !== "number" || actual < (cond.gte as number)))
        return false;
      if (cond.lte !== undefined && (typeof actual !== "number" || actual > (cond.lte as number)))
        return false;
      if (cond.in !== undefined && !Array.isArray(cond.in)) return false;
      if (cond.in !== undefined && !(cond.in as unknown[]).includes(actual)) return false;
    } else if (actual !== expected) {
      return false;
    }
  }
  return true;
}

/**
 * Re-implementation of the private interpolateTemplate function from
 * ../services/notification-engine.ts
 *
 * Replaces {{field}} placeholders with entity data values.
 */
function interpolateTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    return data[key] !== undefined ? String(data[key]) : `{{${key}}}`;
  });
}

describe("matchesConditions", () => {
  it("empty conditions match any data", () => {
    expect(matchesConditions({}, { status: "open", priority: 3 })).toBe(true);
  });

  it("simple equality match", () => {
    expect(matchesConditions({ status: "open" }, { status: "open", priority: 3 })).toBe(true);
  });

  it("simple equality mismatch", () => {
    expect(matchesConditions({ status: "closed" }, { status: "open" })).toBe(false);
  });

  it("gte operator works", () => {
    expect(matchesConditions({ priority: { gte: 3 } }, { priority: 5 })).toBe(true);
    expect(matchesConditions({ priority: { gte: 3 } }, { priority: 3 })).toBe(true);
    expect(matchesConditions({ priority: { gte: 3 } }, { priority: 1 })).toBe(false);
  });

  it("lte operator works", () => {
    expect(matchesConditions({ priority: { lte: 5 } }, { priority: 3 })).toBe(true);
    expect(matchesConditions({ priority: { lte: 5 } }, { priority: 5 })).toBe(true);
    expect(matchesConditions({ priority: { lte: 5 } }, { priority: 7 })).toBe(false);
  });

  it("in operator works", () => {
    expect(
      matchesConditions({ status: { in: ["open", "pending"] } }, { status: "open" }),
    ).toBe(true);
    expect(
      matchesConditions({ status: { in: ["open", "pending"] } }, { status: "closed" }),
    ).toBe(false);
  });

  it("multiple conditions all must match", () => {
    const conditions = { status: "open", priority: { gte: 2 } };
    expect(matchesConditions(conditions, { status: "open", priority: 3 })).toBe(true);
    expect(matchesConditions(conditions, { status: "open", priority: 1 })).toBe(false);
    expect(matchesConditions(conditions, { status: "closed", priority: 5 })).toBe(false);
  });

  it("missing key in data fails match", () => {
    expect(matchesConditions({ status: "open" }, { priority: 3 })).toBe(false);
  });
});

describe("interpolateTemplate", () => {
  it("simple replacement", () => {
    expect(interpolateTemplate("Hello {{name}}", { name: "Raj" })).toBe("Hello Raj");
  });

  it("multiple replacements", () => {
    expect(
      interpolateTemplate("Case {{caseId}} assigned to {{officer}}", {
        caseId: "C-101",
        officer: "Inspector Singh",
      }),
    ).toBe("Case C-101 assigned to Inspector Singh");
  });

  it("missing key keeps placeholder", () => {
    expect(interpolateTemplate("Status: {{status}}", {})).toBe("Status: {{status}}");
  });

  it("no placeholders returns original", () => {
    expect(interpolateTemplate("No placeholders here", { name: "Raj" })).toBe(
      "No placeholders here",
    );
  });

  it("empty template returns empty", () => {
    expect(interpolateTemplate("", { name: "Raj" })).toBe("");
  });
});
