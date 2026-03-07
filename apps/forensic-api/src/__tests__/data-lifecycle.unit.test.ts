import { describe, it, expect } from "vitest";

type LifecycleState = "ACTIVE" | "ARCHIVED" | "PURGE_REQUESTED" | "PURGE_APPROVED";
type HoldStatus = "NONE" | "ACTIVE" | "RELEASED";

const ALLOWED_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  ACTIVE: ["ARCHIVED"],
  ARCHIVED: ["PURGE_REQUESTED"],
  PURGE_REQUESTED: ["PURGE_APPROVED"],
  PURGE_APPROVED: [],
};

function canTransition(
  from: LifecycleState,
  to: LifecycleState,
  holdStatus: HoldStatus
): boolean {
  if (
    holdStatus === "ACTIVE" &&
    (to === "ARCHIVED" || to === "PURGE_REQUESTED" || to === "PURGE_APPROVED")
  ) {
    return false;
  }
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

describe("canTransition", () => {
  describe("happy path transitions (no hold)", () => {
    it("allows ACTIVE → ARCHIVED when no hold", () => {
      expect(canTransition("ACTIVE", "ARCHIVED", "NONE")).toBe(true);
    });

    it("allows ARCHIVED → PURGE_REQUESTED when no hold", () => {
      expect(canTransition("ARCHIVED", "PURGE_REQUESTED", "NONE")).toBe(true);
    });

    it("allows PURGE_REQUESTED → PURGE_APPROVED when no hold", () => {
      expect(canTransition("PURGE_REQUESTED", "PURGE_APPROVED", "NONE")).toBe(
        true
      );
    });

    it("allows ACTIVE → ARCHIVED when hold is RELEASED", () => {
      expect(canTransition("ACTIVE", "ARCHIVED", "RELEASED")).toBe(true);
    });
  });

  describe("invalid transitions (skipping states)", () => {
    it("blocks ACTIVE → PURGE_REQUESTED (skips ARCHIVED)", () => {
      expect(canTransition("ACTIVE", "PURGE_REQUESTED", "NONE")).toBe(false);
    });

    it("blocks ACTIVE → PURGE_APPROVED (skips two states)", () => {
      expect(canTransition("ACTIVE", "PURGE_APPROVED", "NONE")).toBe(false);
    });

    it("blocks ARCHIVED → PURGE_APPROVED (skips PURGE_REQUESTED)", () => {
      expect(canTransition("ARCHIVED", "PURGE_APPROVED", "NONE")).toBe(false);
    });

    it("blocks reverse transitions", () => {
      expect(canTransition("ARCHIVED", "ACTIVE", "NONE")).toBe(false);
      expect(canTransition("PURGE_REQUESTED", "ARCHIVED", "NONE")).toBe(false);
    });
  });

  describe("terminal state", () => {
    it("blocks all transitions from PURGE_APPROVED", () => {
      expect(canTransition("PURGE_APPROVED", "ACTIVE", "NONE")).toBe(false);
      expect(canTransition("PURGE_APPROVED", "ARCHIVED", "NONE")).toBe(false);
      expect(canTransition("PURGE_APPROVED", "PURGE_REQUESTED", "NONE")).toBe(
        false
      );
    });
  });

  describe("legal hold blocking", () => {
    it("blocks ACTIVE → ARCHIVED when legal hold is ACTIVE", () => {
      expect(canTransition("ACTIVE", "ARCHIVED", "ACTIVE")).toBe(false);
    });

    it("blocks ARCHIVED → PURGE_REQUESTED when legal hold is ACTIVE", () => {
      expect(canTransition("ARCHIVED", "PURGE_REQUESTED", "ACTIVE")).toBe(
        false
      );
    });

    it("blocks PURGE_REQUESTED → PURGE_APPROVED when legal hold is ACTIVE", () => {
      expect(canTransition("PURGE_REQUESTED", "PURGE_APPROVED", "ACTIVE")).toBe(
        false
      );
    });

    it("allows transitions when hold is RELEASED", () => {
      expect(canTransition("ACTIVE", "ARCHIVED", "RELEASED")).toBe(true);
      expect(canTransition("ARCHIVED", "PURGE_REQUESTED", "RELEASED")).toBe(
        true
      );
      expect(
        canTransition("PURGE_REQUESTED", "PURGE_APPROVED", "RELEASED")
      ).toBe(true);
    });
  });

  describe("self-transitions", () => {
    it("blocks ACTIVE → ACTIVE", () => {
      expect(canTransition("ACTIVE", "ACTIVE", "NONE")).toBe(false);
    });

    it("blocks ARCHIVED → ARCHIVED", () => {
      expect(canTransition("ARCHIVED", "ARCHIVED", "NONE")).toBe(false);
    });
  });
});
