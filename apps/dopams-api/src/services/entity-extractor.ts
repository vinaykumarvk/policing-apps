import { query } from "../db";

interface ExtractedEntity {
  entityType: string;
  entityValue: string;
  normalizedValue: string;
  confidence: number;
}

// Regex-based Named Entity Recognition
const PATTERNS: { type: string; regex: RegExp; normalize: (match: string) => string }[] = [
  {
    type: "PHONE",
    regex: /(?:\+91[\s-]?)?(?:\d{10}|\d{5}[\s-]\d{5}|\d{4}[\s-]\d{3}[\s-]\d{3})/g,
    normalize: (m) => m.replace(/[\s-]/g, "").replace(/^\+91/, ""),
  },
  {
    type: "EMAIL",
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    normalize: (m) => m.toLowerCase(),
  },
  {
    type: "HANDLE",
    regex: /@[a-zA-Z0-9_]{1,30}/g,
    normalize: (m) => m.toLowerCase(),
  },
  {
    type: "VEHICLE",
    regex: /[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{1,3}[\s-]?\d{1,4}/gi,
    normalize: (m) => m.replace(/[\s-]/g, "").toUpperCase(),
  },
  {
    type: "AADHAAR",
    regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    normalize: (m) => m.replace(/[\s-]/g, ""),
  },
  {
    type: "PAN",
    regex: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
    normalize: (m) => m.toUpperCase(),
  },
];

export function extractEntities(text: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const seen = new Set<string>();

  for (const pattern of PATTERNS) {
    const matches = text.matchAll(pattern.regex);
    for (const match of matches) {
      const value = match[0];
      const normalized = pattern.normalize(value);
      const key = `${pattern.type}:${normalized}`;
      if (!seen.has(key)) {
        seen.add(key);
        entities.push({
          entityType: pattern.type,
          entityValue: value,
          normalizedValue: normalized,
          confidence: 95,
        });
      }
    }
  }

  return entities;
}

type DbRow = Record<string, unknown>;

export async function extractAndStore(
  sourceEntityType: string,
  sourceEntityId: string,
  text: string,
): Promise<DbRow[]> {
  const entities = extractEntities(text);
  const stored: DbRow[] = [];

  for (const entity of entities) {
    const result = await query(
      `INSERT INTO extracted_entity (source_entity_type, source_entity_id, entity_type, entity_value, normalized_value, confidence)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [sourceEntityType, sourceEntityId, entity.entityType, entity.entityValue, entity.normalizedValue, entity.confidence],
    );
    stored.push(result.rows[0]);
  }

  // Auto-link entities with same normalized value
  for (const entity of stored) {
    const matches = await query(
      `SELECT extracted_id, source_entity_type, source_entity_id FROM extracted_entity
       WHERE entity_type = $1 AND normalized_value = $2 AND extracted_id != $3`,
      [entity.entity_type, entity.normalized_value, entity.extracted_id],
    );
    for (const match of matches.rows) {
      const existing = await query(
        `SELECT 1 FROM entity_relationship WHERE
         (from_entity_id = $1 AND to_entity_id = $2) OR (from_entity_id = $2 AND to_entity_id = $1)`,
        [entity.extracted_id, match.extracted_id],
      );
      if (existing.rows.length === 0) {
        await query(
          `INSERT INTO entity_relationship (from_entity_id, to_entity_id, relationship_type, strength)
           VALUES ($1, $2, 'SAME_AS', 100)`,
          [entity.extracted_id, match.extracted_id],
        );
      }
    }
  }

  return stored;
}

export async function getEntityGraph(entityId: string, depth: number = 2): Promise<{ nodes: DbRow[]; edges: DbRow[] }> {
  const nodes: DbRow[] = [];
  const edges: DbRow[] = [];
  const visited = new Set<string>();

  async function traverse(currentId: string, currentDepth: number) {
    if (currentDepth > depth || visited.has(currentId)) return;
    visited.add(currentId);

    const entity = await query(`SELECT * FROM extracted_entity WHERE extracted_id = $1`, [currentId]);
    if (entity.rows.length > 0) nodes.push(entity.rows[0]);

    const rels = await query(
      `SELECT r.*, e1.entity_type as from_type, e1.entity_value as from_value,
              e2.entity_type as to_type, e2.entity_value as to_value
       FROM entity_relationship r
       JOIN extracted_entity e1 ON e1.extracted_id = r.from_entity_id
       JOIN extracted_entity e2 ON e2.extracted_id = r.to_entity_id
       WHERE r.from_entity_id = $1 OR r.to_entity_id = $1`,
      [currentId],
    );

    for (const rel of rels.rows) {
      edges.push(rel);
      const nextId = rel.from_entity_id === currentId ? rel.to_entity_id : rel.from_entity_id;
      await traverse(nextId, currentDepth + 1);
    }
  }

  await traverse(entityId, 0);
  return { nodes, edges };
}

export async function getEntitiesForSource(
  sourceEntityType: string,
  sourceEntityId: string,
): Promise<DbRow[]> {
  const result = await query(
    `SELECT * FROM extracted_entity WHERE source_entity_type = $1 AND source_entity_id = $2 ORDER BY created_at DESC`,
    [sourceEntityType, sourceEntityId],
  );
  return result.rows;
}
