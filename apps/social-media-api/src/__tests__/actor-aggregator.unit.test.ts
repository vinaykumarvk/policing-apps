/**
 * Pure data-transformation unit tests for actor-aggregator linking logic.
 * No database required — mergeHandles and detectCrossPlatformLinks are
 * defined inline mirroring the logic used in the crossPlatformLink service.
 */
import { describe, it, expect } from "vitest";

// ---- Types ----

interface ActorHandle {
  platform: string;
  handle: string;
}

// ---- Pure functions extracted from actor-aggregator crossPlatformLink logic ----

/**
 * Merge two handle arrays, deduplicating on platform:handle key.
 * Preserves insertion order: all of `a` first, then unique entries from `b`.
 */
function mergeHandles(a: ActorHandle[], b: ActorHandle[]): ActorHandle[] {
  const seen = new Set<string>();
  const result: ActorHandle[] = [];
  for (const h of [...a, ...b]) {
    const key = `${h.platform}:${h.handle}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(h);
    }
  }
  return result;
}

/**
 * Detect cross-platform links: actors that share the same handle (case-insensitive)
 * across different entries. Returns pairs of actor IDs.
 */
function detectCrossPlatformLinks(
  actors: Array<{ id: string; handles: ActorHandle[]; displayName: string | null }>,
): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < actors.length; i++) {
    for (let j = i + 1; j < actors.length; j++) {
      const aNames = actors[i].handles.map(h => h.handle.toLowerCase());
      const bNames = actors[j].handles.map(h => h.handle.toLowerCase());
      if (aNames.some(n => bNames.includes(n))) {
        pairs.push([actors[i].id, actors[j].id]);
      }
    }
  }
  return pairs;
}

// ---- Tests ----

describe("mergeHandles — deduplicating handle merge", () => {
  it("merges non-overlapping handles", () => {
    const a: ActorHandle[] = [{ platform: "twitter", handle: "@alice" }];
    const b: ActorHandle[] = [{ platform: "facebook", handle: "alice.fb" }];
    const merged = mergeHandles(a, b);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toEqual({ platform: "twitter", handle: "@alice" });
    expect(merged[1]).toEqual({ platform: "facebook", handle: "alice.fb" });
  });

  it("deduplicates same platform:handle", () => {
    const a: ActorHandle[] = [{ platform: "twitter", handle: "@alice" }];
    const b: ActorHandle[] = [{ platform: "twitter", handle: "@alice" }];
    const merged = mergeHandles(a, b);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual({ platform: "twitter", handle: "@alice" });
  });

  it("preserves order — a first, then unique entries from b", () => {
    const a: ActorHandle[] = [
      { platform: "twitter", handle: "@alice" },
      { platform: "reddit", handle: "alice_r" },
    ];
    const b: ActorHandle[] = [
      { platform: "twitter", handle: "@alice" }, // duplicate, should be skipped
      { platform: "youtube", handle: "AliceYT" },
    ];
    const merged = mergeHandles(a, b);
    expect(merged).toHaveLength(3);
    expect(merged[0]).toEqual({ platform: "twitter", handle: "@alice" });
    expect(merged[1]).toEqual({ platform: "reddit", handle: "alice_r" });
    expect(merged[2]).toEqual({ platform: "youtube", handle: "AliceYT" });
  });

  it("handles empty arrays", () => {
    expect(mergeHandles([], [])).toEqual([]);
    expect(mergeHandles([], [{ platform: "twitter", handle: "@x" }])).toEqual([
      { platform: "twitter", handle: "@x" },
    ]);
    expect(mergeHandles([{ platform: "twitter", handle: "@x" }], [])).toEqual([
      { platform: "twitter", handle: "@x" },
    ]);
  });

  it("same handle on different platforms is NOT deduplicated", () => {
    const a: ActorHandle[] = [{ platform: "twitter", handle: "alice" }];
    const b: ActorHandle[] = [{ platform: "facebook", handle: "alice" }];
    const merged = mergeHandles(a, b);
    expect(merged).toHaveLength(2);
  });

  it("handles large arrays with many duplicates", () => {
    const a: ActorHandle[] = Array.from({ length: 50 }, (_, i) => ({
      platform: "twitter",
      handle: `user${i % 10}`,
    }));
    const b: ActorHandle[] = Array.from({ length: 50 }, (_, i) => ({
      platform: "twitter",
      handle: `user${i % 10}`,
    }));
    const merged = mergeHandles(a, b);
    // Only 10 unique twitter:userN entries
    expect(merged).toHaveLength(10);
  });

  it("deduplication is case-sensitive on handle (matching source behavior)", () => {
    const a: ActorHandle[] = [{ platform: "twitter", handle: "Alice" }];
    const b: ActorHandle[] = [{ platform: "twitter", handle: "alice" }];
    const merged = mergeHandles(a, b);
    // key is platform:handle which is case-sensitive, so both are kept
    expect(merged).toHaveLength(2);
  });
});

describe("detectCrossPlatformLinks — shared handle detection", () => {
  it("same handle across platforms is detected", () => {
    const actors = [
      { id: "a1", handles: [{ platform: "twitter", handle: "alice" }], displayName: "Alice" },
      { id: "a2", handles: [{ platform: "facebook", handle: "alice" }], displayName: "Alice FB" },
    ];
    const pairs = detectCrossPlatformLinks(actors);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toEqual(["a1", "a2"]);
  });

  it("different handles produce no match", () => {
    const actors = [
      { id: "a1", handles: [{ platform: "twitter", handle: "alice" }], displayName: "Alice" },
      { id: "a2", handles: [{ platform: "facebook", handle: "bob" }], displayName: "Bob" },
    ];
    const pairs = detectCrossPlatformLinks(actors);
    expect(pairs).toHaveLength(0);
  });

  it("multiple actors with shared handles produce all matching pairs", () => {
    const actors = [
      { id: "a1", handles: [{ platform: "twitter", handle: "suspect1" }], displayName: null },
      { id: "a2", handles: [{ platform: "facebook", handle: "suspect1" }], displayName: null },
      { id: "a3", handles: [{ platform: "reddit", handle: "suspect1" }], displayName: null },
    ];
    const pairs = detectCrossPlatformLinks(actors);
    // a1-a2, a1-a3, a2-a3
    expect(pairs).toHaveLength(3);
    expect(pairs).toContainEqual(["a1", "a2"]);
    expect(pairs).toContainEqual(["a1", "a3"]);
    expect(pairs).toContainEqual(["a2", "a3"]);
  });

  it("case insensitive matching", () => {
    const actors = [
      { id: "a1", handles: [{ platform: "twitter", handle: "CrimeWatch" }], displayName: null },
      { id: "a2", handles: [{ platform: "facebook", handle: "crimewatch" }], displayName: null },
    ];
    const pairs = detectCrossPlatformLinks(actors);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toEqual(["a1", "a2"]);
  });

  it("empty actors list returns no pairs", () => {
    expect(detectCrossPlatformLinks([])).toEqual([]);
  });

  it("single actor returns no pairs", () => {
    const actors = [
      { id: "a1", handles: [{ platform: "twitter", handle: "solo" }], displayName: "Solo" },
    ];
    expect(detectCrossPlatformLinks(actors)).toEqual([]);
  });

  it("actor with multiple handles can match different actors", () => {
    const actors = [
      {
        id: "a1",
        handles: [
          { platform: "twitter", handle: "alice" },
          { platform: "reddit", handle: "alice_r" },
        ],
        displayName: "Alice",
      },
      { id: "a2", handles: [{ platform: "facebook", handle: "alice" }], displayName: "Alice FB" },
      { id: "a3", handles: [{ platform: "youtube", handle: "alice_r" }], displayName: "Alice YT" },
    ];
    const pairs = detectCrossPlatformLinks(actors);
    // a1-a2 (shared "alice"), a1-a3 (shared "alice_r")
    expect(pairs).toContainEqual(["a1", "a2"]);
    expect(pairs).toContainEqual(["a1", "a3"]);
    // a2 and a3 do NOT share a handle
    expect(pairs).not.toContainEqual(["a2", "a3"]);
    expect(pairs).toHaveLength(2);
  });

  it("actors with no handles produce no matches", () => {
    const actors = [
      { id: "a1", handles: [], displayName: "Ghost 1" },
      { id: "a2", handles: [], displayName: "Ghost 2" },
    ];
    const pairs = detectCrossPlatformLinks(actors);
    expect(pairs).toHaveLength(0);
  });

  it("displayName is not used for matching — only handles matter", () => {
    const actors = [
      { id: "a1", handles: [{ platform: "twitter", handle: "handle_x" }], displayName: "Same Name" },
      { id: "a2", handles: [{ platform: "facebook", handle: "handle_y" }], displayName: "Same Name" },
    ];
    const pairs = detectCrossPlatformLinks(actors);
    // Same displayName but different handles => no link
    expect(pairs).toHaveLength(0);
  });
});
