/**
 * Pure-function unit tests for emoji-drug-decoder.
 * No database required.
 */
import { describe, it, expect } from "vitest";
import { analyzeEmojis } from "../services/emoji-drug-decoder";

describe("analyzeEmojis — emoji drug code detection", () => {
  describe("no emojis", () => {
    it("returns empty result for plain text", () => {
      const result = analyzeEmojis("hello world");
      expect(result.matches).toEqual([]);
      expect(result.combinations).toEqual([]);
      expect(result.totalRiskContribution).toBe(0);
      expect(result.hasSubstanceEmoji).toBe(false);
      expect(result.hasTransactionEmoji).toBe(false);
    });

    it("returns empty result for empty string", () => {
      const result = analyzeEmojis("");
      expect(result.matches).toEqual([]);
    });
  });

  describe("substance emojis", () => {
    it("detects snowflake as cocaine", () => {
      const result = analyzeEmojis("Got that ❄️");
      expect(result.matches.length).toBeGreaterThanOrEqual(1);
      const cocaineMatch = result.matches.find(m => m.drugCategory === "COCAINE");
      expect(cocaineMatch).toBeTruthy();
      expect(result.hasSubstanceEmoji).toBe(true);
    });

    it("detects pill emoji", () => {
      const result = analyzeEmojis("Take these 💊");
      const match = result.matches.find(m => m.drugCategory === "PILLS");
      expect(match).toBeTruthy();
    });

    it("detects diamond as meth", () => {
      const result = analyzeEmojis("💎 pure stuff");
      const match = result.matches.find(m => m.drugCategory === "METH");
      expect(match).toBeTruthy();
    });

    it("detects cannabis emojis", () => {
      const result = analyzeEmojis("🍁🌿🍃");
      const cannabisMatches = result.matches.filter(m => m.drugCategory === "CANNABIS");
      expect(cannabisMatches.length).toBe(3);
    });

    it("detects skull as fentanyl", () => {
      const result = analyzeEmojis("💀 deadly");
      const match = result.matches.find(m => m.drugCategory === "FENTANYL");
      expect(match).toBeTruthy();
    });

    it("detects mushroom as psychedelics", () => {
      const result = analyzeEmojis("🍄 trip");
      const match = result.matches.find(m => m.drugCategory === "PSYCHEDELICS");
      expect(match).toBeTruthy();
    });
  });

  describe("transaction emojis", () => {
    it("detects plug emoji as transaction", () => {
      const result = analyzeEmojis("I'm the 🔌");
      expect(result.hasTransactionEmoji).toBe(true);
      const match = result.matches.find(m => m.signalType === "TRANSACTION");
      expect(match).toBeTruthy();
    });

    it("detects money + package as transaction", () => {
      const result = analyzeEmojis("💸📦 ready");
      const txMatches = result.matches.filter(m => m.signalType === "TRANSACTION");
      expect(txMatches.length).toBe(2);
    });
  });

  describe("quality emojis", () => {
    it("detects fire as quality indicator", () => {
      const result = analyzeEmojis("This is 🔥");
      const match = result.matches.find(m => m.signalType === "QUALITY");
      expect(match).toBeTruthy();
    });
  });

  describe("combination detection", () => {
    it("detects cocaine sale with delivery (❄️+💸+📦)", () => {
      const result = analyzeEmojis("❄️💸📦 hit me up");
      expect(result.combinations.length).toBeGreaterThanOrEqual(1);
      const combo = result.combinations.find(c => c.description === "Cocaine sale with delivery");
      expect(combo).toBeTruthy();
    });

    it("detects fentanyl pills (💀+💊)", () => {
      const result = analyzeEmojis("💀💊 be careful");
      const combo = result.combinations.find(c => c.description === "Fentanyl pills");
      expect(combo).toBeTruthy();
    });
  });

  describe("risk contribution capping", () => {
    it("caps total risk contribution at 25", () => {
      // Many emojis with high risk weights
      const result = analyzeEmojis("❄️💎💊💀🔌📦💸🔥💣🚀");
      expect(result.totalRiskContribution).toBeLessThanOrEqual(25);
    });
  });

  describe("deduplication", () => {
    it("does not double-count the same emoji", () => {
      const result = analyzeEmojis("❄️❄️❄️");
      const cocaineMatches = result.matches.filter(m => m.drugCategory === "COCAINE");
      expect(cocaineMatches.length).toBe(1);
    });
  });

  describe("no false positives", () => {
    it("common emojis without drug meaning are ignored", () => {
      const result = analyzeEmojis("😀😂❤️👍🎈🎁");
      expect(result.matches.length).toBe(0);
      expect(result.hasSubstanceEmoji).toBe(false);
    });
  });
});
