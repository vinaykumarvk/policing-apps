/**
 * Pure-function unit tests for transaction-signal-detector.
 * No database required.
 */
import { describe, it, expect } from "vitest";
import { detectTransactionSignals } from "../services/transaction-signal-detector";

describe("detectTransactionSignals — transaction signal detection", () => {
  describe("no drug term present", () => {
    it("returns empty signals when hasDrugTerm is false", () => {
      const result = detectTransactionSignals("DM me for delivery in stock", false);
      expect(result.signals).toEqual([]);
      expect(result.activityType).toBe("NONE");
      expect(result.activityMultiplier).toBe(1.0);
    });
  });

  describe("empty input", () => {
    it("returns empty result for empty string", () => {
      const result = detectTransactionSignals("", true);
      expect(result.activityType).toBe("NONE");
    });
  });

  describe("purchase signals", () => {
    it("detects 'DM me'", () => {
      const result = detectTransactionSignals("DM me for some stuff", true);
      const purchase = result.signals.find(s => s.signalType === "PURCHASE");
      expect(purchase).toBeTruthy();
      expect(result.activityType).toBe("PURCHASE");
      expect(result.activityMultiplier).toBe(1.5);
    });

    it("detects 'hit me up' / 'HMU'", () => {
      const result = detectTransactionSignals("HMU if you got some", true);
      const purchase = result.signals.find(s => s.signalType === "PURCHASE");
      expect(purchase).toBeTruthy();
    });

    it("detects 'looking for'", () => {
      const result = detectTransactionSignals("looking for something good", true);
      const purchase = result.signals.find(s => s.signalType === "PURCHASE");
      expect(purchase).toBeTruthy();
    });
  });

  describe("sale signals", () => {
    it("detects 'on deck'", () => {
      const result = detectTransactionSignals("on deck right now", true);
      const sale = result.signals.find(s => s.signalType === "SALE");
      expect(sale).toBeTruthy();
      expect(result.activityType).toBe("ACTIVE_SALE");
      expect(result.activityMultiplier).toBe(2.5);
    });

    it("detects 'in stock'", () => {
      const result = detectTransactionSignals("in stock fresh batch", true);
      const sale = result.signals.find(s => s.signalType === "SALE");
      expect(sale).toBeTruthy();
    });

    it("detects 'just landed'", () => {
      const result = detectTransactionSignals("just landed new pack", true);
      const sale = result.signals.find(s => s.signalType === "SALE");
      expect(sale).toBeTruthy();
    });

    it("detects 'delivery'", () => {
      const result = detectTransactionSignals("delivery available", true);
      const sale = result.signals.find(s => s.signalType === "SALE");
      expect(sale).toBeTruthy();
    });
  });

  describe("quantity terms", () => {
    it("detects 'eight ball'", () => {
      const result = detectTransactionSignals("got an eight ball", true);
      expect(result.hasQuantity).toBe(true);
    });

    it("detects 'QP'", () => {
      const result = detectTransactionSignals("need a QP", true);
      expect(result.hasQuantity).toBe(true);
    });

    it("detects 'gram'", () => {
      const result = detectTransactionSignals("selling by the gram", true);
      expect(result.hasQuantity).toBe(true);
    });
  });

  describe("price patterns", () => {
    it("detects dollar amounts", () => {
      const result = detectTransactionSignals("only $50 per g", true);
      expect(result.hasPrice).toBe(true);
    });

    it("detects price per unit", () => {
      const result = detectTransactionSignals("200 per oz available", true);
      expect(result.hasPrice).toBe(true);
    });

    it("detects rupee amounts", () => {
      const result = detectTransactionSignals("₹5000 for good stuff", true);
      expect(result.hasPrice).toBe(true);
    });
  });

  describe("contact patterns", () => {
    it("detects wickr handle", () => {
      const result = detectTransactionSignals("wickr: myhandle123", true);
      expect(result.hasContact).toBe(true);
    });

    it("detects telegram handle", () => {
      const result = detectTransactionSignals("telegram @dealer99", true);
      expect(result.hasContact).toBe(true);
    });

    it("detects 'DM for menu'", () => {
      const result = detectTransactionSignals("DM for menu", true);
      expect(result.hasContact).toBe(true);
    });
  });

  describe("activity type escalation", () => {
    it("DISTRIBUTION when sale + quantity signals", () => {
      const result = detectTransactionSignals("in stock got a QP serving now", true);
      expect(result.activityType).toBe("DISTRIBUTION");
      expect(result.activityMultiplier).toBe(3.0);
    });

    it("DISTRIBUTION when sale + price signals", () => {
      const result = detectTransactionSignals("on deck $50 per gram delivery", true);
      expect(result.activityType).toBe("DISTRIBUTION");
      expect(result.activityMultiplier).toBe(3.0);
    });

    it("ACTIVE_SALE when sale signals without quantity/price/contact", () => {
      const result = detectTransactionSignals("just landed fresh batch", true);
      expect(result.activityType).toBe("ACTIVE_SALE");
      expect(result.activityMultiplier).toBe(2.5);
    });

    it("PURCHASE when only purchase signals", () => {
      const result = detectTransactionSignals("looking for some stuff HMU", true);
      expect(result.activityType).toBe("PURCHASE");
      expect(result.activityMultiplier).toBe(1.5);
    });
  });

  describe("no false positives", () => {
    it("normal commerce text with no drug term returns no signals", () => {
      const result = detectTransactionSignals("Buy our product, in stock, delivery available, $29.99", false);
      expect(result.signals).toEqual([]);
      expect(result.activityType).toBe("NONE");
    });
  });
});
