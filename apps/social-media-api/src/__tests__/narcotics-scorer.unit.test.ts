/**
 * Unit tests for narcotics-scorer.
 * Mocks the slang normalizer (DB-dependent) to test scoring logic in isolation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the slang normalizer to avoid DB dependency
vi.mock("../services/slang-normalizer", () => ({
  normalizeSlangCached: vi.fn().mockResolvedValue({
    normalizedText: "",
    matches: [],
    dictionaryVersion: "v0-test",
  }),
  calculateSlangRiskBonus: vi.fn().mockReturnValue(0),
}));

import { classifyNarcotics } from "../services/narcotics-scorer";
import { normalizeSlangCached, calculateSlangRiskBonus } from "../services/slang-normalizer";

const mockNormalizeSlangCached = vi.mocked(normalizeSlangCached);
const mockCalculateSlangRiskBonus = vi.mocked(calculateSlangRiskBonus);

beforeEach(() => {
  vi.clearAllMocks();
  // Default: return text as-is, no slang matches
  mockNormalizeSlangCached.mockImplementation(async (text: string) => ({
    normalizedText: text,
    matches: [],
    dictionaryVersion: "v0-test",
  }));
  mockCalculateSlangRiskBonus.mockReturnValue(0);
});

describe("classifyNarcotics — narcotics scoring pipeline", () => {
  describe("no drug content", () => {
    it("returns score 0 for normal text", async () => {
      const result = await classifyNarcotics("hello world, nice weather today");
      expect(result.narcoticsScore).toBe(0);
      expect(result.substanceCategory).toBeNull();
      expect(result.activityType).toBe("NONE");
    });

    it("returns score 0 for empty text", async () => {
      const result = await classifyNarcotics("");
      expect(result.narcoticsScore).toBe(0);
    });
  });

  describe("substance detection", () => {
    it("detects cocaine with severity 80", async () => {
      const result = await classifyNarcotics("selling cocaine here");
      expect(result.narcoticsScore).toBeGreaterThanOrEqual(80);
      expect(result.substanceCategory).toBe("COCAINE");
    });

    it("detects heroin with severity 80", async () => {
      const result = await classifyNarcotics("heroin is dangerous");
      expect(result.narcoticsScore).toBeGreaterThanOrEqual(80);
      expect(result.substanceCategory).toBe("HEROIN");
    });

    it("detects fentanyl with severity 100", async () => {
      const result = await classifyNarcotics("fentanyl laced pills");
      expect(result.narcoticsScore).toBe(100);
      expect(result.substanceCategory).toBe("FENTANYL");
    });

    it("detects cannabis with severity 40", async () => {
      const result = await classifyNarcotics("smoking cannabis");
      expect(result.narcoticsScore).toBe(40);
      expect(result.substanceCategory).toBe("CANNABIS");
    });

    it("detects meth with severity 80", async () => {
      const result = await classifyNarcotics("crystal meth lab");
      expect(result.narcoticsScore).toBeGreaterThanOrEqual(80);
      expect(result.substanceCategory).toBe("METH");
    });
  });

  describe("leetspeak evasion detection", () => {
    it("detects c0caine through leetspeak normalization", async () => {
      const result = await classifyNarcotics("c0caine delivery");
      expect(result.narcoticsScore).toBeGreaterThan(0);
      expect(result.normalizationsApplied).toContain("leetspeak_decode");
    });

    it("detects h3r0in through leetspeak normalization", async () => {
      const result = await classifyNarcotics("h3r0in is bad");
      expect(result.narcoticsScore).toBeGreaterThan(0);
    });
  });

  describe("emoji detection", () => {
    it("scores cocaine emoji (❄️) with substance context", async () => {
      const result = await classifyNarcotics("Got that pure ❄️ on deck");
      // "pure" won't match, but emoji + "on deck" (sale signal) should contribute
      expect(result.narcoticsScore).toBeGreaterThan(0);
    });

    it("scores high for cocaine sale emojis (❄️💸📦)", async () => {
      const result = await classifyNarcotics("❄️💸📦 DM me");
      expect(result.narcoticsScore).toBeGreaterThan(0);
    });
  });

  describe("activity multiplier", () => {
    it("multiplies score for sale signals", async () => {
      const saleResult = await classifyNarcotics("cocaine on deck serving now");
      const baseResult = await classifyNarcotics("cocaine mentioned");
      expect(saleResult.narcoticsScore).toBeGreaterThan(baseResult.narcoticsScore);
    });

    it("distribution signals give highest multiplier", async () => {
      const result = await classifyNarcotics("cocaine in stock $50 per gram delivery available wickr: dealer");
      expect(result.activityType).toBe("DISTRIBUTION");
      expect(result.narcoticsScore).toBe(100); // Should hit cap
    });
  });

  describe("context boosters", () => {
    it("adds bonus for quantity terms", async () => {
      const withQuantity = await classifyNarcotics("cocaine eight ball");
      const withoutQuantity = await classifyNarcotics("cocaine mentioned");
      expect(withQuantity.narcoticsScore).toBeGreaterThan(withoutQuantity.narcoticsScore);
    });

    it("adds bonus for price patterns", async () => {
      const withPrice = await classifyNarcotics("cocaine $50");
      const withoutPrice = await classifyNarcotics("cocaine mentioned");
      expect(withPrice.narcoticsScore).toBeGreaterThan(withoutPrice.narcoticsScore);
    });

    it("adds bonus for repeat offender", async () => {
      const repeatResult = await classifyNarcotics("cannabis for sale", 5, true);
      const normalResult = await classifyNarcotics("cannabis for sale", 0, false);
      expect(repeatResult.narcoticsScore).toBeGreaterThan(normalResult.narcoticsScore);
    });
  });

  describe("slang integration", () => {
    it("adds slang risk bonus when slang matches found", async () => {
      mockNormalizeSlangCached.mockResolvedValue({
        normalizedText: "chitta [heroin] is available",
        matches: [{ term: "chitta", normalizedForm: "heroin", category: "NARCOTICS", riskWeight: 2.0 }],
        dictionaryVersion: "v10-2026-03-08",
      });
      mockCalculateSlangRiskBonus.mockReturnValue(10);

      const result = await classifyNarcotics("chitta is available");
      expect(result.narcoticsScore).toBeGreaterThan(0);
      const slangFactor = result.riskFactors.find(f => f.factor === "slang_match");
      expect(slangFactor).toBeTruthy();
      expect(slangFactor!.contribution).toBe(10);
    });
  });

  describe("score capping", () => {
    it("never exceeds 100", async () => {
      const result = await classifyNarcotics(
        "fentanyl cocaine heroin meth in stock delivery $100 per gram QP eight ball wickr: dealer DM for menu ❄️💸📦💀💊",
        10,
        true,
      );
      expect(result.narcoticsScore).toBeLessThanOrEqual(100);
    });
  });

  describe("risk factors reported", () => {
    it("reports substance severity factor", async () => {
      const result = await classifyNarcotics("cocaine deal");
      const factor = result.riskFactors.find(f => f.factor === "substance_severity");
      expect(factor).toBeTruthy();
      expect(factor!.contribution).toBe(80);
    });

    it("includes normalizations applied", async () => {
      const result = await classifyNarcotics("c0caine");
      expect(result.normalizationsApplied).toContain("leetspeak_decode");
    });
  });

  describe("sample posts from plan verification", () => {
    it("'c0caine delivery DM me ❄️📦' → should score CRITICAL (≥85)", async () => {
      const result = await classifyNarcotics("c0caine delivery DM me ❄️📦");
      expect(result.narcoticsScore).toBeGreaterThanOrEqual(85);
    });

    it("normal text like 'hello world' → should score 0", async () => {
      const result = await classifyNarcotics("hello world");
      expect(result.narcoticsScore).toBe(0);
    });
  });
});
