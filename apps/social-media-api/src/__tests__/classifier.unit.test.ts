/**
 * Pure-function unit tests for classifyContent and classifyContentWithActorHistory.
 * No database required.
 */
import { describe, it, expect } from "vitest";
import { classifyContent, classifyContentWithActorHistory } from "../services/classifier";

describe("classifyContent — pure function tests", () => {
  it("empty text returns low risk score and UNCATEGORIZED", () => {
    const result = classifyContent("");
    expect(result.category).toBe("UNCATEGORIZED");
    expect(result.riskScore).toBe(0);
    expect(result.factors).toHaveLength(0);
  });

  it("text with hate speech keywords returns HATE_SPEECH category", () => {
    const result = classifyContent("this message contains hate and threat of violence");
    expect(result.category).toBe("HATE_SPEECH");
    expect(result.riskScore).toBeGreaterThan(0);
    const hateFactor = result.factors.find(f => f.factor === "keyword_match_hate_speech");
    expect(hateFactor).toBeDefined();
    expect(hateFactor!.detail).toContain("hate");
  });

  it("text with drug keywords returns DRUGS category", () => {
    const result = classifyContent("drug trafficking and narcotic distribution ring");
    expect(result.category).toBe("DRUGS");
    expect(result.riskScore).toBeGreaterThan(0);
    const drugFactor = result.factors.find(f => f.factor === "keyword_match_drugs");
    expect(drugFactor).toBeDefined();
  });

  it("risk score is between 0 and 100 for any input", () => {
    const inputs = [
      "",
      "normal weather text",
      "hate threat kill attack violence extremist",
      "drug narcotic cocaine heroin meth cannabis ganja scam fraud fake phishing hack malware bomb terror",
    ];
    for (const text of inputs) {
      const result = classifyContent(text);
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
    }
  });

  it("multiple category keywords returns highest match category", () => {
    // 4 TERRORISM keywords vs 1 FRAUD keyword => TERRORISM wins
    const result = classifyContent("terror bomb radicali jihad report of a scam");
    expect(result.category).toBe("TERRORISM");
    // FRAUD factor should also be present
    const fraudFactor = result.factors.find(f => f.factor === "keyword_match_fraud");
    expect(fraudFactor).toBeDefined();
  });

  it("factors array is populated when keywords found", () => {
    const result = classifyContent("hack into systems using malware and ransomware");
    expect(result.factors.length).toBeGreaterThan(0);
    const cyberFactor = result.factors.find(f => f.factor === "keyword_match_cyber_crime");
    expect(cyberFactor).toBeDefined();
    expect(cyberFactor!.weight).toBe(0.3);
    expect(cyberFactor!.score).toBeGreaterThan(0);
    expect(cyberFactor!.detail).toContain("hack");
    expect(cyberFactor!.detail).toContain("malware");
    expect(cyberFactor!.detail).toContain("ransomware");
  });

  it("is case-insensitive", () => {
    const lower = classifyContent("drug trafficking");
    const upper = classifyContent("DRUG TRAFFICKING");
    const mixed = classifyContent("Drug Trafficking");
    expect(lower.category).toBe(upper.category);
    expect(lower.riskScore).toBe(upper.riskScore);
    expect(lower.riskScore).toBe(mixed.riskScore);
  });

  it("adds lengthy_content factor for text exceeding 500 characters", () => {
    const longText = "threat " + "x".repeat(500);
    const result = classifyContent(longText);
    const lengthFactor = result.factors.find(f => f.factor === "lengthy_content");
    expect(lengthFactor).toBeDefined();
    expect(lengthFactor!.score).toBe(30);
  });

  it("does not add lengthy_content factor for short text", () => {
    const result = classifyContent("threat in short text");
    const lengthFactor = result.factors.find(f => f.factor === "lengthy_content");
    expect(lengthFactor).toBeUndefined();
  });

  it("handles null-ish input gracefully", () => {
    const result = classifyContent(null as unknown as string);
    expect(result.category).toBe("UNCATEGORIZED");
    expect(result.riskScore).toBe(0);
  });

  it("detects HARASSMENT keywords", () => {
    const result = classifyContent("harass and stalk and bully the victim");
    expect(result.category).toBe("HARASSMENT");
  });

  it("detects FRAUD keywords", () => {
    const result = classifyContent("this is a scam and fraud operation with phishing");
    expect(result.category).toBe("FRAUD");
  });

  it("more keyword matches produce a higher risk score", () => {
    const single = classifyContent("a scam was reported");
    const multiple = classifyContent("scam fraud fake phishing money laundering ring");
    expect(multiple.riskScore).toBeGreaterThan(single.riskScore);
  });

  it("each factor has score capped at 100", () => {
    // Even with many matches in one category, individual factor score is capped via Math.min(..., 100)
    const result = classifyContent("hate threat violence kill attack extremist");
    const hateFactor = result.factors.find(f => f.factor === "keyword_match_hate_speech");
    expect(hateFactor).toBeDefined();
    expect(hateFactor!.score).toBeLessThanOrEqual(100);
  });
});

describe("classifyContentWithActorHistory — pure function tests", () => {
  it("repeat offender gets bonus risk factor added", () => {
    const result = classifyContentWithActorHistory("drug trafficking network", 5, true);
    const historyFactor = result.factors.find(f => f.factor === "repeat_offender_history");
    expect(historyFactor).toBeDefined();
    expect(historyFactor!.detail).toContain("repeat_offender=true");
    expect(historyFactor!.detail).toContain("5 flagged posts");
  });

  it("actor with 3+ flagged posts gets bonus even if not marked repeat offender", () => {
    const result = classifyContentWithActorHistory("drug trafficking", 4, false);
    const historyFactor = result.factors.find(f => f.factor === "repeat_offender_history");
    expect(historyFactor).toBeDefined();
    expect(historyFactor!.detail).toContain("repeat_offender=false");
    expect(historyFactor!.detail).toContain("4 flagged posts");
  });

  it("non-repeat offender with 0 flagged posts gets no bonus", () => {
    const result = classifyContentWithActorHistory("drug trafficking", 0, false);
    const historyFactor = result.factors.find(f => f.factor === "repeat_offender_history");
    expect(historyFactor).toBeUndefined();
  });

  it("non-repeat offender with fewer than 3 flagged posts gets no bonus", () => {
    const result = classifyContentWithActorHistory("drug trafficking", 2, false);
    const historyFactor = result.factors.find(f => f.factor === "repeat_offender_history");
    expect(historyFactor).toBeUndefined();
  });

  it("bonus is capped so score does not exceed 100", () => {
    // Use highly-loaded text to push base score high, then add repeat offender bonus
    const heavyText = "hate threat violence kill attack extremist terror bomb radicali jihad drug narcotic cocaine heroin meth";
    const result = classifyContentWithActorHistory(heavyText, 100, true);
    expect(result.riskScore).toBeLessThanOrEqual(100);
  });

  it("repeat offender bonus weight is 0.4", () => {
    const result = classifyContentWithActorHistory("drug trafficking", 5, true);
    const historyFactor = result.factors.find(f => f.factor === "repeat_offender_history");
    expect(historyFactor).toBeDefined();
    expect(historyFactor!.weight).toBe(0.4);
  });

  it("bonus score is actorFlaggedPosts * 5, capped at 30", () => {
    // 5 flagged posts => 25
    const result5 = classifyContentWithActorHistory("drug trafficking", 5, true);
    const factor5 = result5.factors.find(f => f.factor === "repeat_offender_history");
    expect(factor5!.score).toBe(25);

    // 7 flagged posts => 35, capped to 30
    const result7 = classifyContentWithActorHistory("drug trafficking", 7, true);
    const factor7 = result7.factors.find(f => f.factor === "repeat_offender_history");
    expect(factor7!.score).toBe(30);

    // 3 flagged posts => 15
    const result3 = classifyContentWithActorHistory("drug trafficking", 3, false);
    const factor3 = result3.factors.find(f => f.factor === "repeat_offender_history");
    expect(factor3!.score).toBe(15);
  });

  it("with actor history, risk score is recalculated as weighted average", () => {
    const base = classifyContent("drug trafficking");
    const withHistory = classifyContentWithActorHistory("drug trafficking", 5, true);
    // The score should differ because of the added factor
    expect(withHistory.riskScore).not.toBe(base.riskScore);
    // It should still be a valid number in range
    expect(withHistory.riskScore).toBeGreaterThanOrEqual(0);
    expect(withHistory.riskScore).toBeLessThanOrEqual(100);
  });

  it("empty text with repeat offender still adds bonus factor", () => {
    const result = classifyContentWithActorHistory("", 5, true);
    const historyFactor = result.factors.find(f => f.factor === "repeat_offender_history");
    expect(historyFactor).toBeDefined();
    // Even though base had 0 factors, the repeat offender factor is added
    expect(result.factors).toHaveLength(1);
  });
});
