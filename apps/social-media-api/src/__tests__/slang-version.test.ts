/**
 * Tests for FR-05 AC-04: Slang dictionary version in normalize response.
 */
import { describe, it, expect } from "vitest";
import { calculateSlangRiskBonus } from "../services/slang-normalizer";
import type { SlangMatch } from "../services/slang-normalizer";

describe("Slang Risk Bonus Calculation", () => {
  it("returns 0 for empty matches", () => {
    expect(calculateSlangRiskBonus([])).toBe(0);
  });

  it("calculates risk bonus from slang matches", () => {
    const matches: SlangMatch[] = [
      { term: "bruh", normalizedForm: "brother", category: "COLLOQUIAL", riskWeight: 0.5 },
      { term: "opps", normalizedForm: "opposition/enemy", category: "THREAT", riskWeight: 2.0 },
    ];
    const bonus = calculateSlangRiskBonus(matches);
    // 0.5*5 + 2.0*5 = 2.5 + 10 = 12.5
    expect(bonus).toBe(12.5);
  });

  it("caps risk bonus at 20", () => {
    const matches: SlangMatch[] = [
      { term: "a", normalizedForm: "x", category: "HIGH", riskWeight: 3.0 },
      { term: "b", normalizedForm: "y", category: "HIGH", riskWeight: 3.0 },
      { term: "c", normalizedForm: "z", category: "HIGH", riskWeight: 3.0 },
    ];
    const bonus = calculateSlangRiskBonus(matches);
    // 3*5 + 3*5 + 3*5 = 45, capped at 20
    expect(bonus).toBe(20);
  });
});
