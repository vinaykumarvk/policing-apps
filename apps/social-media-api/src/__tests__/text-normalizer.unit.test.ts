/**
 * Pure-function unit tests for text-normalizer.
 * No database required.
 */
import { describe, it, expect } from "vitest";
import { normalizeText } from "../services/text-normalizer";

describe("normalizeText — text normalization pipeline", () => {
  describe("empty / null input", () => {
    it("returns empty result for empty string", () => {
      const result = normalizeText("");
      expect(result.normalizedText).toBe("");
      expect(result.appliedTransforms).toEqual([]);
    });
  });

  describe("zero-width character stripping", () => {
    it("strips zero-width space (U+200B)", () => {
      const result = normalizeText("co\u200Bcaine");
      expect(result.normalizedText).toBe("cocaine");
      expect(result.appliedTransforms).toContain("zero_width_strip");
    });

    it("strips zero-width joiner (U+200D)", () => {
      const result = normalizeText("her\u200Doin");
      expect(result.normalizedText).toBe("heroin");
      expect(result.appliedTransforms).toContain("zero_width_strip");
    });

    it("strips FEFF BOM", () => {
      const result = normalizeText("\uFEFFmeth");
      expect(result.normalizedText).toBe("meth");
    });
  });

  describe("Unicode NFKD normalization", () => {
    it("converts fullwidth chars to ASCII", () => {
      const result = normalizeText("\uFF48\uFF45\uFF52\uFF4F\uFF49\uFF4E"); // ｈｅｒｏｉｎ
      expect(result.normalizedText.toLowerCase()).toContain("heroin");
      expect(result.appliedTransforms).toContain("unicode_nfkd");
    });
  });

  describe("homoglyph replacement", () => {
    it("replaces Cyrillic lookalikes with Latin", () => {
      // Using Cyrillic 'с' (U+0441) for 'c' and Cyrillic 'о' (U+043E) for 'o'
      const result = normalizeText("\u0441\u043Ecaine");
      expect(result.normalizedText).toBe("cocaine");
      expect(result.appliedTransforms).toContain("homoglyph_replace");
    });

    it("replaces Greek lookalikes with Latin", () => {
      // Using Greek 'ο' (U+03BF) for 'o'
      const result = normalizeText("her\u03BFin");
      expect(result.normalizedText).toBe("heroin");
      expect(result.appliedTransforms).toContain("homoglyph_replace");
    });
  });

  describe("leetspeak decoding", () => {
    it("decodes c0caine → cocaine", () => {
      const result = normalizeText("c0caine");
      expect(result.normalizedText).toBe("cocaine");
      expect(result.appliedTransforms).toContain("leetspeak_decode");
    });

    it("decodes h3r0in → heroin", () => {
      const result = normalizeText("h3r0in");
      expect(result.normalizedText).toBe("heroin");
      expect(result.appliedTransforms).toContain("leetspeak_decode");
    });

    it("decodes m3th → meth", () => {
      const result = normalizeText("m3th");
      expect(result.normalizedText).toBe("meth");
    });

    it("does not mangle pure numbers", () => {
      const result = normalizeText("12345");
      expect(result.normalizedText).toBe("12345");
    });

    it("does not mangle normal text", () => {
      const result = normalizeText("hello world");
      expect(result.normalizedText).toBe("hello world");
      expect(result.appliedTransforms).toEqual([]);
    });
  });

  describe("separator collapse", () => {
    it("collapses c.o.c.a.i.n.e → cocaine", () => {
      const result = normalizeText("c.o.c.a.i.n.e");
      expect(result.normalizedText).toBe("cocaine");
      expect(result.appliedTransforms).toContain("separator_collapse");
    });

    it("collapses h-e-r-o-i-n → heroin", () => {
      const result = normalizeText("h-e-r-o-i-n");
      expect(result.normalizedText).toBe("heroin");
      expect(result.appliedTransforms).toContain("separator_collapse");
    });

    it("collapses m e t h → meth", () => {
      const result = normalizeText("m e t h");
      expect(result.normalizedText).toBe("meth");
    });

    it("does not collapse non-drug words", () => {
      const result = normalizeText("h.e.l.l.o");
      expect(result.normalizedText).toBe("h.e.l.l.o");
    });
  });

  describe("combined evasion techniques", () => {
    it("handles leetspeak + zero-width chars", () => {
      const result = normalizeText("c\u200B0caine");
      expect(result.normalizedText).toBe("cocaine");
    });

    it("preserves surrounding text", () => {
      const result = normalizeText("get some c0caine today");
      expect(result.normalizedText).toBe("get some cocaine today");
    });
  });

  describe("no false positives on normal text", () => {
    it("does not modify 'hello world'", () => {
      const result = normalizeText("hello world");
      expect(result.normalizedText).toBe("hello world");
      expect(result.appliedTransforms).toEqual([]);
    });

    it("does not modify normal commerce text", () => {
      const result = normalizeText("Buy our new product at $29.99");
      expect(result.normalizedText).toBe("Buy our new product at $29.99");
    });
  });
});
