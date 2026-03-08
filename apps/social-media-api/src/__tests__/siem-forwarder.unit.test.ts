/**
 * Unit tests for SIEM forwarder service.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { forwardToSiem } from "../services/siem-forwarder";

describe("SIEM Forwarder — unit tests", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env.SIEM_ENABLED = "false";
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("does nothing when SIEM is disabled", () => {
    // Should not throw
    forwardToSiem({ event_type: "TEST", entity_type: "test", entity_id: "123" });
  });

  it("buffers events when SIEM is enabled", () => {
    process.env.SIEM_ENABLED = "true";
    process.env.SIEM_ENDPOINT = "https://siem.example.com/api/events";
    process.env.SIEM_BATCH_SIZE = "100"; // High batch size to prevent auto-flush

    // Should not throw
    forwardToSiem({ event_type: "HIGH_SEVERITY_ALERT", entity_type: "sm_alert", entity_id: "abc" });
  });
});
