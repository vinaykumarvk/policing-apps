import { query } from "../db";

type DbRow = Record<string, unknown>;

interface GraphNode {
  id: string;
  entityType: string;
  entityValue: string;
  degreeCentrality: number;
  betweennessCentrality: number;
  closenessCentrality: number;
  isKingpin: boolean;
  riskScore: number;
}

interface GraphEdge {
  from: string;
  to: string;
  type: string;
  strength: number;
}

interface GraphAnalysis {
  nodes: GraphNode[];
  edges: GraphEdge[];
  kingpins: GraphNode[];
  communities: { id: string; members: string[] }[];
}

// Build adjacency list from entity_relationship table
async function buildAdjacencyList(): Promise<Map<string, Set<string>>> {
  const result = await query(
    `SELECT from_entity_id::text, to_entity_id::text FROM entity_relationship`
  );

  const adj = new Map<string, Set<string>>();
  for (const row of result.rows) {
    if (!adj.has(row.from_entity_id)) adj.set(row.from_entity_id, new Set());
    if (!adj.has(row.to_entity_id)) adj.set(row.to_entity_id, new Set());
    adj.get(row.from_entity_id)!.add(row.to_entity_id);
    adj.get(row.to_entity_id)!.add(row.from_entity_id);
  }
  return adj;
}

// Degree centrality: normalized count of connections
function computeDegreeCentrality(adj: Map<string, Set<string>>): Map<string, number> {
  const n = adj.size;
  if (n <= 1) return new Map();

  const centrality = new Map<string, number>();
  for (const [node, neighbors] of adj) {
    centrality.set(node, neighbors.size / (n - 1));
  }
  return centrality;
}

// Betweenness centrality (Brandes algorithm)
function computeBetweennessCentrality(adj: Map<string, Set<string>>): Map<string, number> {
  const nodes = Array.from(adj.keys());
  const n = nodes.length;
  const centrality = new Map<string, number>();
  nodes.forEach(v => centrality.set(v, 0));

  for (const s of nodes) {
    const stack: string[] = [];
    const pred = new Map<string, string[]>();
    const sigma = new Map<string, number>();
    const dist = new Map<string, number>();

    nodes.forEach(v => { pred.set(v, []); sigma.set(v, 0); dist.set(v, -1); });
    sigma.set(s, 1);
    dist.set(s, 0);

    const queue = [s];
    while (queue.length > 0) {
      const v = queue.shift()!;
      stack.push(v);
      for (const w of adj.get(v) || []) {
        if (dist.get(w)! < 0) {
          queue.push(w);
          dist.set(w, dist.get(v)! + 1);
        }
        if (dist.get(w) === dist.get(v)! + 1) {
          sigma.set(w, sigma.get(w)! + sigma.get(v)!);
          pred.get(w)!.push(v);
        }
      }
    }

    const delta = new Map<string, number>();
    nodes.forEach(v => delta.set(v, 0));

    while (stack.length > 0) {
      const w = stack.pop()!;
      for (const v of pred.get(w) || []) {
        delta.set(v, delta.get(v)! + (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!));
      }
      if (w !== s) {
        centrality.set(w, centrality.get(w)! + delta.get(w)!);
      }
    }
  }

  // Normalize
  const norm = n > 2 ? (n - 1) * (n - 2) : 1;
  for (const [node, val] of centrality) {
    centrality.set(node, val / norm);
  }

  return centrality;
}

// Closeness centrality
function computeClosenessCentrality(adj: Map<string, Set<string>>): Map<string, number> {
  const nodes = Array.from(adj.keys());
  const centrality = new Map<string, number>();

  for (const s of nodes) {
    // BFS to compute distances
    const dist = new Map<string, number>();
    dist.set(s, 0);
    const queue = [s];
    let totalDist = 0;
    let reachable = 0;

    while (queue.length > 0) {
      const v = queue.shift()!;
      for (const w of adj.get(v) || []) {
        if (!dist.has(w)) {
          dist.set(w, dist.get(v)! + 1);
          totalDist += dist.get(w)!;
          reachable++;
          queue.push(w);
        }
      }
    }

    centrality.set(s, reachable > 0 ? reachable / totalDist : 0);
  }

  return centrality;
}

// Simple community detection (connected components)
function detectCommunities(adj: Map<string, Set<string>>): Map<string, string> {
  const visited = new Set<string>();
  const communityMap = new Map<string, string>();
  let communityIdx = 0;

  for (const node of adj.keys()) {
    if (visited.has(node)) continue;
    communityIdx++;
    const communityId = `community_${communityIdx}`;
    const queue = [node];

    while (queue.length > 0) {
      const v = queue.shift()!;
      if (visited.has(v)) continue;
      visited.add(v);
      communityMap.set(v, communityId);
      for (const w of adj.get(v) || []) {
        if (!visited.has(w)) queue.push(w);
      }
    }
  }

  return communityMap;
}

export async function analyzeNetwork(): Promise<GraphAnalysis> {
  const adj = await buildAdjacencyList();

  if (adj.size === 0) {
    return { nodes: [], edges: [], kingpins: [], communities: [] };
  }

  const degree = computeDegreeCentrality(adj);
  const betweenness = computeBetweennessCentrality(adj);
  const closeness = computeClosenessCentrality(adj);
  const communityMap = detectCommunities(adj);

  // Get entity details — DOPAMS uses extracted_id as PK
  const entityIds = Array.from(adj.keys());
  const entityResult = await query(
    `SELECT extracted_id::text as id, entity_type, entity_value, normalized_value FROM extracted_entity WHERE extracted_id = ANY($1::uuid[])`,
    [entityIds]
  );

  const entityMap = new Map<string, DbRow>();
  for (const row of entityResult.rows) {
    entityMap.set(row.id, row);
  }

  // Get risk scores if available
  const riskResult = await query(
    `SELECT entity_id::text as id, risk_score FROM classification_result WHERE entity_id = ANY($1::uuid[])`,
    [entityIds]
  );
  const riskMap = new Map<string, number>();
  for (const row of riskResult.rows) {
    riskMap.set(row.id, parseFloat(row.risk_score) || 0);
  }

  // Determine kingpins: high betweenness + high degree
  const kingpinThreshold = 0.1;

  const nodes: GraphNode[] = entityIds.map(id => {
    const entity = entityMap.get(id);
    const bc = betweenness.get(id) || 0;
    const dc = degree.get(id) || 0;
    const cc = closeness.get(id) || 0;
    const risk = riskMap.get(id) || 0;
    const isKingpin = bc > kingpinThreshold && dc > kingpinThreshold;

    return {
      id,
      entityType: (entity?.entity_type as string) || "UNKNOWN",
      entityValue: (entity?.entity_value as string) || id,
      degreeCentrality: Math.round(dc * 10000) / 10000,
      betweennessCentrality: Math.round(bc * 10000) / 10000,
      closenessCentrality: Math.round(cc * 10000) / 10000,
      isKingpin,
      riskScore: risk,
    };
  });

  // Get edges
  const edgeResult = await query(
    `SELECT from_entity_id::text as "from", to_entity_id::text as "to", relationship_type as type, strength FROM entity_relationship`
  );
  const edges: GraphEdge[] = edgeResult.rows;

  // Group communities
  const communityGroups = new Map<string, string[]>();
  for (const [nodeId, communityId] of communityMap) {
    if (!communityGroups.has(communityId)) communityGroups.set(communityId, []);
    communityGroups.get(communityId)!.push(nodeId);
  }
  const communities = Array.from(communityGroups.entries()).map(([id, members]) => ({ id, members }));

  // Store analysis results
  for (const node of nodes) {
    await query(
      `INSERT INTO graph_analysis_result (entity_type, entity_id, analysis_type, degree_centrality, betweenness_centrality, closeness_centrality, community_id, is_kingpin, risk_score)
       VALUES ($1, $2, 'CENTRALITY', $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING`,
      [node.entityType, node.id, node.degreeCentrality, node.betweennessCentrality, node.closenessCentrality, communityMap.get(node.id), node.isKingpin, node.riskScore]
    );
  }

  return {
    nodes,
    edges,
    kingpins: nodes.filter(n => n.isKingpin).sort((a, b) => b.betweennessCentrality - a.betweennessCentrality),
    communities,
  };
}

export async function getNodeAnalysis(entityId: string): Promise<DbRow | null> {
  const result = await query(
    `SELECT * FROM graph_analysis_result WHERE entity_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [entityId]
  );
  return result.rows[0] || null;
}

export async function getKingpins(): Promise<DbRow[]> {
  const result = await query(
    `SELECT gar.*, ee.entity_type as extracted_type, ee.entity_value
     FROM graph_analysis_result gar
     LEFT JOIN extracted_entity ee ON ee.extracted_id = gar.entity_id
     WHERE gar.is_kingpin = true
     ORDER BY gar.betweenness_centrality DESC`
  );
  return result.rows;
}
