import { query, getClient } from "../db";

/**
 * Graph Projector — materializes link tables into canonical network_node/network_edge.
 * Maintains a typed graph projection for FR-11 network analysis.
 */

interface ProjectionStats {
  nodesUpserted: number;
  edgesUpserted: number;
}

/**
 * Upsert a network node. Returns the node_id.
 */
async function upsertNode(
  nodeType: string,
  entityId: string,
  label: string,
  properties: Record<string, unknown> = {},
  clientOrQuery: { query: (sql: string, params: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> } | typeof query = query,
): Promise<string> {
  const fn = typeof clientOrQuery === "function" ? clientOrQuery : clientOrQuery.query.bind(clientOrQuery);
  const result = await fn(
    `INSERT INTO network_node (node_type, entity_id, label, properties)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (node_type, entity_id) DO UPDATE SET label = EXCLUDED.label, properties = EXCLUDED.properties, updated_at = NOW()
     RETURNING node_id`,
    [nodeType, entityId, label, JSON.stringify(properties)],
  );
  return result.rows[0].node_id as string;
}

/**
 * Upsert a network edge between two nodes.
 */
async function upsertEdge(
  fromNodeId: string,
  toNodeId: string,
  edgeType: string,
  opts: { isInferred?: boolean; confidence?: number; strength?: number; evidenceCount?: number } = {},
  clientOrQuery: { query: (sql: string, params: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> } | typeof query = query,
): Promise<void> {
  const fn = typeof clientOrQuery === "function" ? clientOrQuery : clientOrQuery.query.bind(clientOrQuery);
  await fn(
    `INSERT INTO network_edge (from_node_id, to_node_id, edge_type, is_inferred, confidence, strength, evidence_count, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (from_node_id, to_node_id, edge_type) DO UPDATE
       SET evidence_count = network_edge.evidence_count + 1, last_seen_at = NOW(),
           confidence = GREATEST(network_edge.confidence, EXCLUDED.confidence),
           strength = GREATEST(network_edge.strength, EXCLUDED.strength)`,
    [
      fromNodeId, toNodeId, edgeType,
      opts.isInferred ?? false,
      opts.confidence ?? 100,
      opts.strength ?? 50,
      opts.evidenceCount ?? 1,
    ],
  );
}

/**
 * Project a single subject and all its linked entities into the graph.
 */
export async function projectSubject(subjectId: string): Promise<ProjectionStats> {
  let nodesUpserted = 0;
  let edgesUpserted = 0;

  // 1. Get subject info
  const subjectResult = await query(
    `SELECT subject_id, full_name, threat_level, monitoring_status FROM subject_profile WHERE subject_id = $1`,
    [subjectId],
  );
  if (subjectResult.rows.length === 0) return { nodesUpserted: 0, edgesUpserted: 0 };
  const subject = subjectResult.rows[0];

  const subjectNodeId = await upsertNode("SUBJECT", subjectId, subject.full_name as string, {
    threat_level: subject.threat_level,
    monitoring_status: subject.monitoring_status,
  });
  nodesUpserted++;

  // 2. Project phone links
  const phones = await query(
    `SELECT pn.phone_id, pn.normalized_value, pn.phone_type, spl.relationship, spl.confidence
     FROM subject_phone_link spl JOIN phone_number pn ON pn.phone_id = spl.phone_id
     WHERE spl.subject_id = $1`, [subjectId],
  );
  for (const phone of phones.rows) {
    const phoneNodeId = await upsertNode("PHONE", phone.phone_id as string, phone.normalized_value as string, { phone_type: phone.phone_type });
    await upsertEdge(subjectNodeId, phoneNodeId, "HAS_PHONE", { confidence: phone.confidence as number });
    nodesUpserted++;
    edgesUpserted++;
  }

  // 3. Project identity links
  const identities = await query(
    `SELECT id.document_pk, id.document_type, id.normalized_value, sil.confidence
     FROM subject_identity_link sil JOIN identity_document id ON id.document_pk = sil.document_pk
     WHERE sil.subject_id = $1`, [subjectId],
  );
  for (const doc of identities.rows) {
    const docNodeId = await upsertNode("IDENTITY_DOC", doc.document_pk as string, `${doc.document_type}:${doc.normalized_value}`, { document_type: doc.document_type });
    await upsertEdge(subjectNodeId, docNodeId, "HAS_IDENTITY", { confidence: doc.confidence as number });
    nodesUpserted++;
    edgesUpserted++;
  }

  // 4. Project device links
  const devices = await query(
    `SELECT d.device_id, d.normalized_imei, d.device_model, sdl.confidence
     FROM subject_device_link sdl JOIN device d ON d.device_id = sdl.device_id
     WHERE sdl.subject_id = $1`, [subjectId],
  );
  for (const dev of devices.rows) {
    const devNodeId = await upsertNode("DEVICE", dev.device_id as string, dev.normalized_imei as string, { model: dev.device_model });
    await upsertEdge(subjectNodeId, devNodeId, "HAS_DEVICE", { confidence: dev.confidence as number });
    nodesUpserted++;
    edgesUpserted++;
  }

  // 5. Project vehicle links
  const vehicles = await query(
    `SELECT v.vehicle_id, v.normalized_reg, v.make, v.model, svl.confidence
     FROM subject_vehicle_link svl JOIN vehicle v ON v.vehicle_id = svl.vehicle_id
     WHERE svl.subject_id = $1`, [subjectId],
  );
  for (const veh of vehicles.rows) {
    const vehNodeId = await upsertNode("VEHICLE", veh.vehicle_id as string, veh.normalized_reg as string, { make: veh.make, model: veh.model });
    await upsertEdge(subjectNodeId, vehNodeId, "HAS_VEHICLE", { confidence: veh.confidence as number });
    nodesUpserted++;
    edgesUpserted++;
  }

  // 6. Project bank account links
  const accounts = await query(
    `SELECT ba.account_id, ba.normalized_key, ba.bank_name, sal.confidence
     FROM subject_account_link sal JOIN bank_account ba ON ba.account_id = sal.account_id
     WHERE sal.subject_id = $1`, [subjectId],
  );
  for (const acc of accounts.rows) {
    const accNodeId = await upsertNode("BANK_ACCOUNT", acc.account_id as string, acc.normalized_key as string, { bank_name: acc.bank_name });
    await upsertEdge(subjectNodeId, accNodeId, "HAS_ACCOUNT", { confidence: acc.confidence as number });
    nodesUpserted++;
    edgesUpserted++;
  }

  // 7. Project UPI account links
  const upiAccounts = await query(
    `SELECT ua.upi_id, ua.vpa, ua.provider_app, sul.confidence
     FROM subject_upi_link sul JOIN upi_account ua ON ua.upi_id = sul.upi_id
     WHERE sul.subject_id = $1`, [subjectId],
  );
  for (const upi of upiAccounts.rows) {
    const upiNodeId = await upsertNode("UPI_ACCOUNT", upi.upi_id as string, upi.vpa as string, { provider_app: upi.provider_app });
    await upsertEdge(subjectNodeId, upiNodeId, "HAS_UPI", { confidence: upi.confidence as number });
    nodesUpserted++;
    edgesUpserted++;
  }

  // 8. Project social account links (formerly section 7)
  const socials = await query(
    `SELECT sa.social_id, sa.platform, sa.normalized_handle, socl.confidence
     FROM subject_social_link socl JOIN social_account sa ON sa.social_id = socl.social_id
     WHERE socl.subject_id = $1`, [subjectId],
  );
  for (const soc of socials.rows) {
    const socNodeId = await upsertNode("SOCIAL_ACCOUNT", soc.social_id as string, `${soc.platform}:${soc.normalized_handle}`, { platform: soc.platform });
    await upsertEdge(subjectNodeId, socNodeId, "HAS_SOCIAL", { confidence: soc.confidence as number });
    nodesUpserted++;
    edgesUpserted++;
  }

  // 8. Project subject-subject links
  const associates = await query(
    `SELECT subject_id_a, subject_id_b, relationship, strength FROM subject_subject_link
     WHERE subject_id_a = $1 OR subject_id_b = $1`, [subjectId],
  );
  for (const assoc of associates.rows) {
    const otherSubjectId = assoc.subject_id_a === subjectId ? assoc.subject_id_b : assoc.subject_id_a;
    // Ensure the other subject node exists
    const otherResult = await query(
      `SELECT full_name, threat_level FROM subject_profile WHERE subject_id = $1 AND is_merged = FALSE`,
      [otherSubjectId],
    );
    if (otherResult.rows.length > 0) {
      const otherNodeId = await upsertNode("SUBJECT", otherSubjectId as string, otherResult.rows[0].full_name as string, { threat_level: otherResult.rows[0].threat_level });
      // Edge type matches the relationship — map UNKNOWN to ASSOCIATE for graph CHECK constraint
      const rawRelationship = (assoc.relationship as string) || "ASSOCIATE";
      const edgeType = rawRelationship === "UNKNOWN" ? "ASSOCIATE" : rawRelationship;
      await upsertEdge(subjectNodeId, otherNodeId, edgeType, { strength: assoc.strength as number });
      nodesUpserted++;
      edgesUpserted++;
    }
  }

  // 10. Infer shared-entity edges (subjects sharing a phone/device)
  const sharedPhones = await query(
    `SELECT DISTINCT spl2.subject_id AS other_subject_id
     FROM subject_phone_link spl1
     JOIN subject_phone_link spl2 ON spl1.phone_id = spl2.phone_id AND spl1.subject_id != spl2.subject_id
     JOIN subject_profile sp ON sp.subject_id = spl2.subject_id AND sp.is_merged = FALSE
     WHERE spl1.subject_id = $1`, [subjectId],
  );
  for (const shared of sharedPhones.rows) {
    const otherResult = await query(
      `SELECT full_name FROM subject_profile WHERE subject_id = $1`, [shared.other_subject_id],
    );
    if (otherResult.rows.length > 0) {
      const otherNodeId = await upsertNode("SUBJECT", shared.other_subject_id as string, otherResult.rows[0].full_name as string);
      await upsertEdge(subjectNodeId, otherNodeId, "SHARED_DEVICE", { isInferred: true, strength: 70 });
      edgesUpserted++;
    }
  }

  // 11. Infer SHARED_ACCOUNT edges (subjects sharing bank accounts)
  const sharedAccounts = await query(
    `SELECT DISTINCT sal2.subject_id AS other_subject_id
     FROM subject_account_link sal1
     JOIN subject_account_link sal2 ON sal1.account_id = sal2.account_id AND sal1.subject_id != sal2.subject_id
     JOIN subject_profile sp ON sp.subject_id = sal2.subject_id AND sp.is_merged = FALSE
     WHERE sal1.subject_id = $1`, [subjectId],
  );
  for (const shared of sharedAccounts.rows) {
    const otherResult = await query(
      `SELECT full_name FROM subject_profile WHERE subject_id = $1`, [shared.other_subject_id],
    );
    if (otherResult.rows.length > 0) {
      const otherNodeId = await upsertNode("SUBJECT", shared.other_subject_id as string, otherResult.rows[0].full_name as string);
      await upsertEdge(subjectNodeId, otherNodeId, "SHARED_ACCOUNT", { isInferred: true, strength: 80 });
      edgesUpserted++;
    }
  }

  return { nodesUpserted, edgesUpserted };
}

/**
 * Full graph rebuild — project all non-merged subjects.
 */
export async function rebuildGraph(): Promise<ProjectionStats> {
  const subjects = await query(
    `SELECT subject_id FROM subject_profile WHERE is_merged = FALSE`,
  );
  let totalNodes = 0;
  let totalEdges = 0;
  for (const row of subjects.rows) {
    const stats = await projectSubject(row.subject_id as string);
    totalNodes += stats.nodesUpserted;
    totalEdges += stats.edgesUpserted;
  }
  return { nodesUpserted: totalNodes, edgesUpserted: totalEdges };
}

/**
 * Get graph neighborhood for a node — returns nodes and edges within given depth.
 */
export async function getNeighborhood(
  nodeId: string,
  depth: number = 2,
): Promise<{ nodes: Record<string, unknown>[]; edges: Record<string, unknown>[] }> {
  // Use recursive CTE for breadth-first traversal, expose min_depth per node
  const result = await query(
    `WITH RECURSIVE neighborhood AS (
       SELECT $1::uuid AS node_id, 0 AS depth
       UNION
       SELECT
         CASE WHEN ne.from_node_id = n.node_id THEN ne.to_node_id ELSE ne.from_node_id END,
         n.depth + 1
       FROM neighborhood n
       JOIN network_edge ne ON ne.from_node_id = n.node_id OR ne.to_node_id = n.node_id
       WHERE n.depth < $2
     )
     SELECT nn.*, nb.min_depth
     FROM network_node nn
     JOIN (SELECT node_id, MIN(depth) AS min_depth FROM neighborhood GROUP BY node_id) nb
       ON nn.node_id = nb.node_id`,
    [nodeId, depth],
  );

  const nodeIds = result.rows.map((r) => r.node_id);
  if (nodeIds.length === 0) return { nodes: [], edges: [] };

  const edges = await query(
    `SELECT * FROM network_edge
     WHERE from_node_id = ANY($1::uuid[]) AND to_node_id = ANY($1::uuid[])`,
    [nodeIds],
  );

  return { nodes: result.rows, edges: edges.rows };
}
