import { describe, it, expect } from "vitest";

function matchesConditions(
  conditions: Record<string, unknown>,
  data: Record<string, unknown>
): boolean {
  for (const [key, expected] of Object.entries(conditions)) {
    const actual = data[key];
    if (
      typeof expected === "object" &&
      expected !== null &&
      !Array.isArray(expected)
    ) {
      const cond = expected as Record<string, unknown>;
      if (
        cond.gte !== undefined &&
        (typeof actual !== "number" || actual < (cond.gte as number))
      )
        return false;
      if (
        cond.lte !== undefined &&
        (typeof actual !== "number" || actual > (cond.lte as number))
      )
        return false;
      if (
        cond.in !== undefined &&
        !(cond.in as unknown[]).includes(actual)
      )
        return false;
    } else if (actual !== expected) {
      return false;
    }
  }
  return true;
}

function calculateSlaDeadline(now: Date, slaHours: number): Date {
  return new Date(now.getTime() + slaHours * 60 * 60 * 1000);
}

describe("matchesConditions", () => {
  describe("empty conditions", () => {
    it("matches any data when conditions are empty", () => {
      expect(matchesConditions({}, { foo: "bar", count: 42 })).toBe(true);
    });

    it("matches empty data when conditions are empty", () => {
      expect(matchesConditions({}, {})).toBe(true);
    });
  });

  describe("equality matching", () => {
    it("matches when value equals expected", () => {
      expect(
        matchesConditions({ status: "CRITICAL" }, { status: "CRITICAL" })
      ).toBe(true);
    });

    it("fails when value does not equal expected", () => {
      expect(
        matchesConditions({ status: "CRITICAL" }, { status: "LOW" })
      ).toBe(false);
    });

    it("fails when key is missing from data", () => {
      expect(matchesConditions({ status: "CRITICAL" }, {})).toBe(false);
    });

    it("matches numeric equality", () => {
      expect(matchesConditions({ priority: 1 }, { priority: 1 })).toBe(true);
    });

    it("fails on type mismatch", () => {
      expect(matchesConditions({ priority: 1 }, { priority: "1" })).toBe(
        false
      );
    });
  });

  describe("gte operator", () => {
    it("matches when actual >= threshold", () => {
      expect(
        matchesConditions({ score: { gte: 80 } }, { score: 85 })
      ).toBe(true);
    });

    it("matches when actual equals threshold", () => {
      expect(
        matchesConditions({ score: { gte: 80 } }, { score: 80 })
      ).toBe(true);
    });

    it("fails when actual < threshold", () => {
      expect(
        matchesConditions({ score: { gte: 80 } }, { score: 79 })
      ).toBe(false);
    });

    it("fails when actual is not a number", () => {
      expect(
        matchesConditions({ score: { gte: 80 } }, { score: "high" })
      ).toBe(false);
    });
  });

  describe("lte operator", () => {
    it("matches when actual <= threshold", () => {
      expect(
        matchesConditions({ risk: { lte: 50 } }, { risk: 30 })
      ).toBe(true);
    });

    it("matches when actual equals threshold", () => {
      expect(
        matchesConditions({ risk: { lte: 50 } }, { risk: 50 })
      ).toBe(true);
    });

    it("fails when actual > threshold", () => {
      expect(
        matchesConditions({ risk: { lte: 50 } }, { risk: 51 })
      ).toBe(false);
    });
  });

  describe("in operator", () => {
    it("matches when actual is in the list", () => {
      expect(
        matchesConditions(
          { category: { in: ["DRUGS", "WEAPONS", "FRAUD"] } },
          { category: "WEAPONS" }
        )
      ).toBe(true);
    });

    it("fails when actual is not in the list", () => {
      expect(
        matchesConditions(
          { category: { in: ["DRUGS", "WEAPONS"] } },
          { category: "THEFT" }
        )
      ).toBe(false);
    });

    it("fails when key is missing", () => {
      expect(
        matchesConditions({ category: { in: ["DRUGS"] } }, {})
      ).toBe(false);
    });
  });

  describe("combined range operators", () => {
    it("matches when value is within gte and lte range", () => {
      expect(
        matchesConditions(
          { confidence: { gte: 0.5, lte: 1.0 } },
          { confidence: 0.75 }
        )
      ).toBe(true);
    });

    it("fails when value is below range", () => {
      expect(
        matchesConditions(
          { confidence: { gte: 0.5, lte: 1.0 } },
          { confidence: 0.3 }
        )
      ).toBe(false);
    });

    it("fails when value is above range", () => {
      expect(
        matchesConditions(
          { confidence: { gte: 0.5, lte: 1.0 } },
          { confidence: 1.5 }
        )
      ).toBe(false);
    });
  });

  describe("multiple conditions", () => {
    it("matches when all conditions are met", () => {
      expect(
        matchesConditions(
          { status: "ACTIVE", priority: { gte: 3 }, type: { in: ["A", "B"] } },
          { status: "ACTIVE", priority: 5, type: "A" }
        )
      ).toBe(true);
    });

    it("fails when one condition is not met", () => {
      expect(
        matchesConditions(
          { status: "ACTIVE", priority: { gte: 3 } },
          { status: "ACTIVE", priority: 2 }
        )
      ).toBe(false);
    });

    it("fails when first condition fails (short-circuit)", () => {
      expect(
        matchesConditions(
          { status: "CLOSED", priority: { gte: 1 } },
          { status: "ACTIVE", priority: 5 }
        )
      ).toBe(false);
    });
  });
});

describe("calculateSlaDeadline", () => {
  it("adds 24 hours (one day)", () => {
    const now = new Date("2026-03-07T10:00:00Z");
    const deadline = calculateSlaDeadline(now, 24);
    expect(deadline.toISOString()).toBe("2026-03-08T10:00:00.000Z");
  });

  it("returns the same time for 0 hours", () => {
    const now = new Date("2026-03-07T10:00:00Z");
    const deadline = calculateSlaDeadline(now, 0);
    expect(deadline.getTime()).toBe(now.getTime());
  });

  it("adds 48 hours (two days)", () => {
    const now = new Date("2026-03-07T10:00:00Z");
    const deadline = calculateSlaDeadline(now, 48);
    expect(deadline.toISOString()).toBe("2026-03-09T10:00:00.000Z");
  });

  it("handles fractional hours", () => {
    const now = new Date("2026-03-07T10:00:00Z");
    const deadline = calculateSlaDeadline(now, 1.5);
    expect(deadline.toISOString()).toBe("2026-03-07T11:30:00.000Z");
  });

  it("does not mutate the input date", () => {
    const now = new Date("2026-03-07T10:00:00Z");
    const originalTime = now.getTime();
    calculateSlaDeadline(now, 24);
    expect(now.getTime()).toBe(originalTime);
  });
});
