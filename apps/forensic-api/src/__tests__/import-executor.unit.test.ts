import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";

function computeChecksum(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

describe("computeChecksum", () => {
  it("produces known SHA-256 hash for empty buffer", () => {
    const hash = computeChecksum(Buffer.alloc(0));
    // SHA-256 of empty input is a well-known constant
    expect(hash).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  it("produces the same hash for the same content", () => {
    const content = Buffer.from("forensic evidence data");
    const hash1 = computeChecksum(content);
    const hash2 = computeChecksum(Buffer.from("forensic evidence data"));
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different content", () => {
    const hash1 = computeChecksum(Buffer.from("file-a-contents"));
    const hash2 = computeChecksum(Buffer.from("file-b-contents"));
    expect(hash1).not.toBe(hash2);
  });

  it("returns a 64-character hex string", () => {
    const hash = computeChecksum(Buffer.from("some binary data"));
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("handles binary data", () => {
    const binary = Buffer.from([0x00, 0xff, 0x7f, 0x80, 0x01]);
    const hash = computeChecksum(binary);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic across multiple calls", () => {
    const data = Buffer.from("repeat-test");
    const hashes = Array.from({ length: 5 }, () => computeChecksum(data));
    expect(new Set(hashes).size).toBe(1);
  });
});
