import { describe, it, expect } from "vitest";

interface Entity {
  id: string;
  type: string;
  value: string;
  isMerged: boolean;
  mergedIntoId: string | null;
}

function applyMerge(
  target: Entity,
  source: Entity
): { target: Entity; source: Entity } {
  return {
    target: { ...target },
    source: { ...source, isMerged: true, mergedIntoId: target.id },
  };
}

function applySplit(
  original: Entity,
  newValues: Array<{ type: string; value: string }>
): Entity[] {
  return newValues.map((v, i) => ({
    id: `${original.id}-split-${i}`,
    type: v.type,
    value: v.value,
    isMerged: false,
    mergedIntoId: null,
  }));
}

function validateMerge(source: Entity): { valid: boolean; error?: string } {
  if (source.isMerged) {
    return { valid: false, error: "Cannot merge an already-merged entity" };
  }
  return { valid: true };
}

describe("applyMerge", () => {
  const target: Entity = {
    id: "ent-001",
    type: "PHONE",
    value: "+91-9876543210",
    isMerged: false,
    mergedIntoId: null,
  };

  const source: Entity = {
    id: "ent-002",
    type: "PHONE",
    value: "+91-9876543210",
    isMerged: false,
    mergedIntoId: null,
  };

  it("marks source as merged with target ID", () => {
    const result = applyMerge(target, source);
    expect(result.source.isMerged).toBe(true);
    expect(result.source.mergedIntoId).toBe("ent-001");
  });

  it("does not modify target's isMerged flag", () => {
    const result = applyMerge(target, source);
    expect(result.target.isMerged).toBe(false);
    expect(result.target.mergedIntoId).toBeNull();
  });

  it("preserves source's original fields", () => {
    const result = applyMerge(target, source);
    expect(result.source.id).toBe("ent-002");
    expect(result.source.type).toBe("PHONE");
    expect(result.source.value).toBe("+91-9876543210");
  });

  it("preserves target's original fields", () => {
    const result = applyMerge(target, source);
    expect(result.target.id).toBe("ent-001");
    expect(result.target.type).toBe("PHONE");
    expect(result.target.value).toBe("+91-9876543210");
  });

  it("returns new objects (does not mutate originals)", () => {
    const result = applyMerge(target, source);
    expect(result.target).not.toBe(target);
    expect(result.source).not.toBe(source);
    expect(source.isMerged).toBe(false);
    expect(source.mergedIntoId).toBeNull();
  });
});

describe("applySplit", () => {
  const original: Entity = {
    id: "ent-100",
    type: "ADDRESS",
    value: "123 Main St, City A / 456 Side Rd, City B",
    isMerged: false,
    mergedIntoId: null,
  };

  const newValues = [
    { type: "ADDRESS", value: "123 Main St, City A" },
    { type: "ADDRESS", value: "456 Side Rd, City B" },
  ];

  it("creates the correct number of entities", () => {
    const result = applySplit(original, newValues);
    expect(result).toHaveLength(2);
  });

  it("assigns correct IDs with split index suffix", () => {
    const result = applySplit(original, newValues);
    expect(result[0].id).toBe("ent-100-split-0");
    expect(result[1].id).toBe("ent-100-split-1");
  });

  it("assigns correct types and values", () => {
    const result = applySplit(original, newValues);
    expect(result[0].type).toBe("ADDRESS");
    expect(result[0].value).toBe("123 Main St, City A");
    expect(result[1].type).toBe("ADDRESS");
    expect(result[1].value).toBe("456 Side Rd, City B");
  });

  it("creates entities that are not merged", () => {
    const result = applySplit(original, newValues);
    for (const entity of result) {
      expect(entity.isMerged).toBe(false);
      expect(entity.mergedIntoId).toBeNull();
    }
  });

  it("handles single-value split", () => {
    const result = applySplit(original, [
      { type: "ADDRESS", value: "Only address" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("ent-100-split-0");
  });

  it("handles many-value split", () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      type: "PHONE",
      value: `+91-900000000${i}`,
    }));
    const result = applySplit(original, many);
    expect(result).toHaveLength(5);
    expect(result[4].id).toBe("ent-100-split-4");
  });
});

describe("validateMerge", () => {
  it("rejects merge of already-merged entity", () => {
    const mergedSource: Entity = {
      id: "ent-003",
      type: "EMAIL",
      value: "test@example.com",
      isMerged: true,
      mergedIntoId: "ent-001",
    };
    const result = validateMerge(mergedSource);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Cannot merge an already-merged entity");
  });

  it("allows merge of non-merged entity", () => {
    const source: Entity = {
      id: "ent-004",
      type: "EMAIL",
      value: "other@example.com",
      isMerged: false,
      mergedIntoId: null,
    };
    const result = validateMerge(source);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });
});
