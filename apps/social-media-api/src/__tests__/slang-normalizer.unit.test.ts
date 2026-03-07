/**
 * Pure-function unit tests for slang-normalizer utilities.
 * No database required.
 */
import { describe, it, expect } from "vitest";
import { calculateSlangRiskBonus, type SlangMatch } from "../services/slang-normalizer";

// escapeRegex is not exported from the module, so we re-implement it here for testing.
// This mirrors the exact implementation in slang-normalizer.ts.
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("calculateSlangRiskBonus — pure function tests", () => {
  it("empty matches returns 0", () => {
    expect(calculateSlangRiskBonus([])).toBe(0);
  });

  it("single match with riskWeight 2 returns 10 (2 * 5)", () => {
    const matches: SlangMatch[] = [
      { term: "ganja", normalizedForm: "cannabis", category: "DRUGS", riskWeight: 2 },
    ];
    expect(calculateSlangRiskBonus(matches)).toBe(10);
  });

  it("multiple matches sum correctly", () => {
    const matches: SlangMatch[] = [
      { term: "ganja", normalizedForm: "cannabis", category: "DRUGS", riskWeight: 1 },
      { term: "charas", normalizedForm: "hashish", category: "DRUGS", riskWeight: 2 },
    ];
    // (1 * 5) + (2 * 5) = 15
    expect(calculateSlangRiskBonus(matches)).toBe(15);
  });

  it("capped at 20 points maximum", () => {
    const matches: SlangMatch[] = [
      { term: "ganja", normalizedForm: "cannabis", category: "DRUGS", riskWeight: 3 },
      { term: "charas", normalizedForm: "hashish", category: "DRUGS", riskWeight: 3 },
    ];
    // (3 * 5) + (3 * 5) = 30, but capped at 20
    expect(calculateSlangRiskBonus(matches)).toBe(20);
  });

  it("riskWeight of 0 contributes 0", () => {
    const matches: SlangMatch[] = [
      { term: "benign", normalizedForm: "harmless", category: "OTHER", riskWeight: 0 },
    ];
    expect(calculateSlangRiskBonus(matches)).toBe(0);
  });

  it("exactly at the cap boundary (total = 20) returns 20", () => {
    const matches: SlangMatch[] = [
      { term: "term1", normalizedForm: "norm1", category: "DRUGS", riskWeight: 2 },
      { term: "term2", normalizedForm: "norm2", category: "DRUGS", riskWeight: 2 },
    ];
    // (2 * 5) + (2 * 5) = 20, exactly at cap
    expect(calculateSlangRiskBonus(matches)).toBe(20);
  });

  it("fractional riskWeight is handled correctly", () => {
    const matches: SlangMatch[] = [
      { term: "slang1", normalizedForm: "std1", category: "HATE", riskWeight: 0.5 },
    ];
    // 0.5 * 5 = 2.5
    expect(calculateSlangRiskBonus(matches)).toBe(2.5);
  });

  it("many small weights sum and cap correctly", () => {
    const matches: SlangMatch[] = Array.from({ length: 10 }, (_, i) => ({
      term: `term${i}`,
      normalizedForm: `norm${i}`,
      category: "MISC",
      riskWeight: 1,
    }));
    // 10 * (1 * 5) = 50, capped at 20
    expect(calculateSlangRiskBonus(matches)).toBe(20);
  });
});

describe("escapeRegex — regex special character escaping", () => {
  it("plain text is unchanged", () => {
    expect(escapeRegex("hello world")).toBe("hello world");
  });

  it("dots are escaped", () => {
    expect(escapeRegex("file.txt")).toBe("file\\.txt");
  });

  it("brackets are escaped", () => {
    expect(escapeRegex("[test]")).toBe("\\[test\\]");
  });

  it("multiple special characters are escaped", () => {
    expect(escapeRegex("a.*+?^${}()|[\\]b")).toBe("a\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\\\\\]b");
  });

  it("parentheses are escaped", () => {
    expect(escapeRegex("(group)")).toBe("\\(group\\)");
  });

  it("pipe is escaped", () => {
    expect(escapeRegex("a|b")).toBe("a\\|b");
  });

  it("caret and dollar are escaped", () => {
    expect(escapeRegex("^start$")).toBe("\\^start\\$");
  });

  it("curly braces are escaped", () => {
    expect(escapeRegex("a{3}")).toBe("a\\{3\\}");
  });

  it("plus and question mark are escaped", () => {
    expect(escapeRegex("a+b?c")).toBe("a\\+b\\?c");
  });

  it("backslash is escaped", () => {
    expect(escapeRegex("back\\slash")).toBe("back\\\\slash");
  });

  it("empty string returns empty string", () => {
    expect(escapeRegex("")).toBe("");
  });

  it("escaped output is safe to use in a RegExp constructor", () => {
    const dangerous = "drug (slang) [v2.0]";
    const escaped = escapeRegex(dangerous);
    // Should not throw
    const regex = new RegExp(escaped);
    expect(regex.test(dangerous)).toBe(true);
    // Should NOT match altered text
    expect(regex.test("drug slang v20")).toBe(false);
  });
});
