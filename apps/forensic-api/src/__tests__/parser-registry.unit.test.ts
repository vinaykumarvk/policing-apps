import { describe, it, expect } from "vitest";

const PARSER_REGISTRY = new Map<string, { parserType: string; extensions: string[] }>([
  ["UFED", { parserType: "UFED", extensions: [".ufdr", ".xml", ".zip"] }],
  ["XRY", { parserType: "XRY", extensions: [".xry", ".xml", ".zip"] }],
  ["OXYGEN", { parserType: "OXYGEN", extensions: [".ofb", ".xml", ".zip"] }],
  ["FTK", { parserType: "FTK", extensions: [".ad1", ".e01", ".zip"] }],
  ["AXIOM", { parserType: "AXIOM", extensions: [".case", ".xml", ".zip"] }],
  ["BELKASOFT", { parserType: "BELKASOFT", extensions: [".bec", ".xml", ".zip"] }],
]);

function detectParserType(filename: string): string | null {
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  for (const [, entry] of PARSER_REGISTRY) {
    if (entry.extensions.includes(ext)) return entry.parserType;
  }
  return null;
}

describe("detectParserType", () => {
  it("detects .ufdr as UFED", () => {
    expect(detectParserType("evidence.ufdr")).toBe("UFED");
  });

  it("detects .xry as XRY", () => {
    expect(detectParserType("extraction.xry")).toBe("XRY");
  });

  it("detects .ofb as OXYGEN", () => {
    expect(detectParserType("backup.ofb")).toBe("OXYGEN");
  });

  it("detects .ad1 as FTK", () => {
    expect(detectParserType("image.ad1")).toBe("FTK");
  });

  it("detects .case as AXIOM", () => {
    expect(detectParserType("investigation.case")).toBe("AXIOM");
  });

  it("detects .bec as BELKASOFT", () => {
    expect(detectParserType("capture.bec")).toBe("BELKASOFT");
  });

  it("returns null for unknown extensions", () => {
    expect(detectParserType("document.unknown")).toBeNull();
    expect(detectParserType("file.pdf")).toBeNull();
    expect(detectParserType("data.csv")).toBeNull();
  });

  it("handles case-insensitive filenames", () => {
    expect(detectParserType("EVIDENCE.UFDR")).toBe("UFED");
    expect(detectParserType("Extraction.XRY")).toBe("XRY");
    expect(detectParserType("Backup.OFB")).toBe("OXYGEN");
    expect(detectParserType("Image.AD1")).toBe("FTK");
    expect(detectParserType("Investigation.CASE")).toBe("AXIOM");
    expect(detectParserType("Capture.BEC")).toBe("BELKASOFT");
  });

  it("handles filenames with multiple dots", () => {
    expect(detectParserType("my.evidence.file.ufdr")).toBe("UFED");
    expect(detectParserType("case.2024.01.xry")).toBe("XRY");
  });

  it("detects .e01 as FTK", () => {
    expect(detectParserType("disk.e01")).toBe("FTK");
  });
});
