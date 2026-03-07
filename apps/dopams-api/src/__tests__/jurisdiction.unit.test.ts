import { describe, it, expect } from "vitest";

interface OrgUnit {
  unitId: string;
  parentUnitId: string | null;
  name: string;
}

/**
 * Walk up the tree from a starting unit, collecting ancestor IDs.
 */
function buildAncestorChain(units: OrgUnit[], startId: string): string[] {
  const map = new Map(units.map((u) => [u.unitId, u]));
  const ancestors: string[] = [];
  let current = map.get(startId);
  while (current?.parentUnitId) {
    ancestors.push(current.parentUnitId);
    current = map.get(current.parentUnitId);
  }
  return ancestors;
}

/**
 * Recursively collect all descendant unit IDs below a given parent.
 */
function getDescendants(units: OrgUnit[], parentId: string): string[] {
  const children = units.filter((u) => u.parentUnitId === parentId);
  return children.flatMap((c) => [c.unitId, ...getDescendants(units, c.unitId)]);
}

/*
  Hierarchy used in tests:

    STATE (root)
      ├── RANGE
      │     ├── DISTRICT_A
      │     └── DISTRICT_B
      └── RANGE_2
            └── DISTRICT_C
*/
const units: OrgUnit[] = [
  { unitId: "STATE", parentUnitId: null, name: "State HQ" },
  { unitId: "RANGE", parentUnitId: "STATE", name: "Range Office" },
  { unitId: "RANGE_2", parentUnitId: "STATE", name: "Range 2 Office" },
  { unitId: "DISTRICT_A", parentUnitId: "RANGE", name: "District A" },
  { unitId: "DISTRICT_B", parentUnitId: "RANGE", name: "District B" },
  { unitId: "DISTRICT_C", parentUnitId: "RANGE_2", name: "District C" },
];

describe("buildAncestorChain", () => {
  it("root unit has no ancestors", () => {
    expect(buildAncestorChain(units, "STATE")).toEqual([]);
  });

  it("leaf unit has full ancestor chain", () => {
    const ancestors = buildAncestorChain(units, "DISTRICT_A");
    expect(ancestors).toEqual(["RANGE", "STATE"]);
  });

  it("handles missing unit gracefully (returns empty)", () => {
    expect(buildAncestorChain(units, "NONEXISTENT")).toEqual([]);
  });
});

describe("getDescendants", () => {
  it("top unit has all descendants", () => {
    const desc = getDescendants(units, "STATE");
    expect(desc).toContain("RANGE");
    expect(desc).toContain("RANGE_2");
    expect(desc).toContain("DISTRICT_A");
    expect(desc).toContain("DISTRICT_B");
    expect(desc).toContain("DISTRICT_C");
    expect(desc).toHaveLength(5);
  });

  it("intermediate unit returns its subtree", () => {
    const desc = getDescendants(units, "RANGE");
    expect(desc).toEqual(expect.arrayContaining(["DISTRICT_A", "DISTRICT_B"]));
    expect(desc).toHaveLength(2);
  });

  it("leaf unit has no descendants", () => {
    expect(getDescendants(units, "DISTRICT_A")).toEqual([]);
  });
});
