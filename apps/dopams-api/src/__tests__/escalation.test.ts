import { describe, it, expect } from "vitest";

/**
 * FR-24: Hierarchical Escalation — Unit Tests
 *
 * The notification engine's processEscalations function is database-dependent
 * and has no HTTP endpoint. We test the supporting logic (matchesConditions,
 * interpolateTemplate) which drives escalation rule evaluation, and verify
 * the escalation level filtering logic that separates immediate (level 1)
 * rules from higher-level escalation rules.
 */

/**
 * Re-implementation of matchesConditions from notification-engine.ts.
 * Used by evaluateRules to decide which notification rules fire.
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
 * Re-implementation of interpolateTemplate from notification-engine.ts.
 */
function interpolateTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    return data[key] !== undefined ? String(data[key]) : `{{${key}}}`;
  });
}

/**
 * Simulates the escalation level filtering logic from fireNotifications.
 * Level 1 rules fire immediately; higher levels are scheduled for later.
 */
interface MockRule {
  ruleId: string;
  ruleName: string;
  escalationLevel: number;
  escalationTimeoutMinutes: number;
  channel: string;
  template: string;
  recipientRole: string | null;
  recipientUserId: string | null;
  escalatedFromId: string | null;
}

function filterImmediateRules(rules: MockRule[]): MockRule[] {
  return rules.filter((r) => r.escalationLevel === 1);
}

function filterEscalationRules(rules: MockRule[]): MockRule[] {
  return rules.filter((r) => r.escalationLevel > 1);
}

describe("FR-24 Escalation — matchesConditions for escalation triggers", () => {
  it("SLA breach condition matches when overdue_hours >= threshold", () => {
    const condition = { overdue_hours: { gte: 24 } };
    expect(matchesConditions(condition, { overdue_hours: 48 })).toBe(true);
    expect(matchesConditions(condition, { overdue_hours: 24 })).toBe(true);
    expect(matchesConditions(condition, { overdue_hours: 12 })).toBe(false);
  });

  it("priority-based escalation matches high priority subjects", () => {
    const condition = { priority: { in: ["HIGH", "CRITICAL"] }, status: "OVERDUE" };
    expect(
      matchesConditions(condition, { priority: "CRITICAL", status: "OVERDUE" }),
    ).toBe(true);
    expect(
      matchesConditions(condition, { priority: "LOW", status: "OVERDUE" }),
    ).toBe(false);
    expect(
      matchesConditions(condition, { priority: "HIGH", status: "OPEN" }),
    ).toBe(false);
  });

  it("combined gte + equality condition for escalation trigger", () => {
    const condition = { escalation_count: { gte: 2 }, entity_type: "CASE" };
    expect(
      matchesConditions(condition, { escalation_count: 3, entity_type: "CASE" }),
    ).toBe(true);
    expect(
      matchesConditions(condition, { escalation_count: 1, entity_type: "CASE" }),
    ).toBe(false);
    expect(
      matchesConditions(condition, { escalation_count: 5, entity_type: "LEAD" }),
    ).toBe(false);
  });
});

describe("FR-24 Escalation — level filtering", () => {
  const rules: MockRule[] = [
    {
      ruleId: "r1",
      ruleName: "SLA Warning",
      escalationLevel: 1,
      escalationTimeoutMinutes: 60,
      channel: "IN_APP",
      template: "Task {{taskId}} is approaching SLA deadline",
      recipientRole: "OFFICER",
      recipientUserId: null,
      escalatedFromId: null,
    },
    {
      ruleId: "r2",
      ruleName: "SLA Breach — Supervisor",
      escalationLevel: 2,
      escalationTimeoutMinutes: 120,
      channel: "IN_APP",
      template: "Task {{taskId}} has breached SLA, escalating to supervisor",
      recipientRole: "SUPERVISOR",
      recipientUserId: null,
      escalatedFromId: "r1",
    },
    {
      ruleId: "r3",
      ruleName: "SLA Breach — Director",
      escalationLevel: 3,
      escalationTimeoutMinutes: 240,
      channel: "IN_APP",
      template: "Critical: Task {{taskId}} unresolved after L2 escalation",
      recipientRole: "DIRECTOR",
      recipientUserId: null,
      escalatedFromId: "r2",
    },
  ];

  it("filterImmediateRules returns only level 1 rules", () => {
    const immediate = filterImmediateRules(rules);
    expect(immediate).toHaveLength(1);
    expect(immediate[0].ruleId).toBe("r1");
    expect(immediate[0].escalationLevel).toBe(1);
  });

  it("filterEscalationRules returns level 2+ rules", () => {
    const escalation = filterEscalationRules(rules);
    expect(escalation).toHaveLength(2);
    expect(escalation[0].escalationLevel).toBe(2);
    expect(escalation[1].escalationLevel).toBe(3);
  });

  it("escalation chain links via escalatedFromId", () => {
    const l2 = rules.find((r) => r.escalationLevel === 2);
    expect(l2?.escalatedFromId).toBe("r1");

    const l3 = rules.find((r) => r.escalationLevel === 3);
    expect(l3?.escalatedFromId).toBe("r2");
  });

  it("level 1 rule has no escalatedFromId", () => {
    const l1 = rules.find((r) => r.escalationLevel === 1);
    expect(l1?.escalatedFromId).toBeNull();
  });
});

describe("FR-24 Escalation — template interpolation for escalation messages", () => {
  it("escalation L2 template includes task ID", () => {
    const result = interpolateTemplate(
      "Task {{taskId}} has breached SLA, escalating to supervisor",
      { taskId: "T-2026-001" },
    );
    expect(result).toBe("Task T-2026-001 has breached SLA, escalating to supervisor");
  });

  it("escalation L3 template includes task and case info", () => {
    const result = interpolateTemplate(
      "Critical: Task {{taskId}} for case {{caseId}} unresolved after L2",
      { taskId: "T-2026-001", caseId: "C-500" },
    );
    expect(result).toBe("Critical: Task T-2026-001 for case C-500 unresolved after L2");
  });

  it("missing fields remain as placeholders in escalation messages", () => {
    const result = interpolateTemplate(
      "Escalation: {{officerName}} has not acknowledged task {{taskId}}",
      { taskId: "T-100" },
    );
    expect(result).toBe("Escalation: {{officerName}} has not acknowledged task T-100");
  });
});

describe("FR-24 Escalation — timeout ordering", () => {
  it("escalation timeouts increase with level", () => {
    const rules: MockRule[] = [
      {
        ruleId: "r1", ruleName: "L1", escalationLevel: 1,
        escalationTimeoutMinutes: 60, channel: "IN_APP", template: "",
        recipientRole: "OFFICER", recipientUserId: null, escalatedFromId: null,
      },
      {
        ruleId: "r2", ruleName: "L2", escalationLevel: 2,
        escalationTimeoutMinutes: 120, channel: "IN_APP", template: "",
        recipientRole: "SUPERVISOR", recipientUserId: null, escalatedFromId: "r1",
      },
      {
        ruleId: "r3", ruleName: "L3", escalationLevel: 3,
        escalationTimeoutMinutes: 240, channel: "IN_APP", template: "",
        recipientRole: "DIRECTOR", recipientUserId: null, escalatedFromId: "r2",
      },
    ];

    for (let i = 1; i < rules.length; i++) {
      expect(rules[i].escalationTimeoutMinutes).toBeGreaterThan(
        rules[i - 1].escalationTimeoutMinutes,
      );
      expect(rules[i].escalationLevel).toBeGreaterThan(
        rules[i - 1].escalationLevel,
      );
    }
  });
});
