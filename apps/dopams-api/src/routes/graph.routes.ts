import { FastifyInstance } from "fastify";
import { analyzeNetwork, getNodeAnalysis, getKingpins } from "../services/graph-analysis";
import { sendError, send404 } from "../errors";
import { createRoleGuard } from "@puda/api-core";
import { projectSubject, rebuildGraph, getNeighborhood } from "../services/graph-projector";
import { query } from "../db";

export async function registerGraphRoutes(app: FastifyInstance): Promise<void> {
  const requireGraphAnalysis = createRoleGuard(["INTELLIGENCE_ANALYST", "SUPERVISORY_OFFICER", "ADMINISTRATOR"]);

  // FR-11 AC-04/05: Run full network analysis with configurable depth and factor params
  app.post("/api/v1/graph/analyze", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          maxDepth: { type: "integer", minimum: 1, maximum: 10, default: 3 },
          rootEntityId: { type: "string", format: "uuid" },
          factors: {
            type: "object",
            additionalProperties: false,
            properties: {
              includeFinancial: { type: "boolean", default: true },
              includeCommunication: { type: "boolean", default: true },
              includeAssociation: { type: "boolean", default: true },
              minWeight: { type: "number", minimum: 0, maximum: 1, default: 0 },
            },
          },
          dateFrom: { type: "string", format: "date" },
          dateTo: { type: "string", format: "date" },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireGraphAnalysis(request, reply)) return;
    try {
      const { maxDepth, rootEntityId, factors, dateFrom, dateTo } = (request.body || {}) as {
        maxDepth?: number; rootEntityId?: string;
        factors?: { includeFinancial?: boolean; includeCommunication?: boolean; includeAssociation?: boolean; minWeight?: number };
        dateFrom?: string; dateTo?: string;
      };
      const depth = Math.min(maxDepth || 3, 10);

      // For deep analysis (depth > 5), create an async job instead
      if (depth > 5) {
        const { createAnalysisJob } = await import("../services/cdr-analysis");
        const { userId } = request.authUser!;
        const job = await createAnalysisJob("GRAPH_ANALYSIS", rootEntityId || null, { maxDepth: depth }, userId);
        reply.code(202);
        return { message: "Deep analysis queued as async job", job };
      }

      const result = await analyzeNetwork(depth);
      return result;
    } catch (err: unknown) {
      request.log.error(err, "Network analysis failed");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // FR-11 AC-04: Get analysis for a specific node with optional date filters
  app.get("/api/v1/graph/node/:entityId", {
    schema: {
      params: {
        type: "object",
        additionalProperties: false,
        required: ["entityId"],
        properties: {
          entityId: { type: "string", format: "uuid" },
        },
      },
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          dateFrom: { type: "string", format: "date" },
          dateTo: { type: "string", format: "date" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { entityId } = request.params as { entityId: string };
      const { dateFrom, dateTo } = (request.query || {}) as { dateFrom?: string; dateTo?: string };
      const analysis = await getNodeAnalysis(entityId, dateFrom, dateTo);
      if (!analysis) return reply.code(404).send({ error: "NOT_FOUND", message: "No analysis found for this entity" });
      return analysis;
    } catch (err: unknown) {
      request.log.error(err, "Failed to get node analysis");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get kingpins
  app.get("/api/v1/graph/kingpins", async (request, reply) => {
    if (!requireGraphAnalysis(request, reply)) return;
    try {
      const kingpins = await getKingpins();
      return { kingpins };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get kingpins");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // ── Canonical Graph Projection endpoints (FR-11) ──────────────────────────

  // Project a subject into the canonical network_node/network_edge graph
  app.post("/api/v1/graph/project/:subjectId", {
    schema: {
      params: { type: "object", required: ["subjectId"], properties: { subjectId: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    if (!requireGraphAnalysis(request, reply)) return;
    try {
      const { subjectId } = request.params as { subjectId: string };
      const stats = await projectSubject(subjectId);
      return { success: true, ...stats };
    } catch (err: unknown) {
      request.log.error(err, "Failed to project subject into graph");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Full graph rebuild (admin only — expensive)
  app.post("/api/v1/graph/rebuild", async (request, reply) => {
    const requireAdmin = createRoleGuard(["ADMINISTRATOR"]);
    if (!requireAdmin(request, reply)) return;
    try {
      reply.code(202);
      // Run asynchronously for large datasets
      const stats = await rebuildGraph();
      return { success: true, ...stats };
    } catch (err: unknown) {
      request.log.error(err, "Failed to rebuild graph");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get graph neighborhood from canonical network_node/network_edge
  app.get("/api/v1/graph/network/:nodeId", {
    schema: {
      params: { type: "object", required: ["nodeId"], properties: { nodeId: { type: "string", format: "uuid" } } },
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          depth: { type: "integer", minimum: 1, maximum: 5, default: 2 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { nodeId } = request.params as { nodeId: string };
      const { depth = 2 } = (request.query || {}) as { depth?: number };
      const result = await getNeighborhood(nodeId, Math.min(depth, 5));
      if (result.nodes.length === 0) {
        return send404(reply, "NODE_NOT_FOUND", "Network node not found");
      }
      return result;
    } catch (err: unknown) {
      request.log.error(err, "Failed to get graph neighborhood");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Convenience: resolve subject_id → node_id and return neighborhood
  app.get("/api/v1/graph/subject-network/:subjectId", {
    schema: {
      params: { type: "object", required: ["subjectId"], properties: { subjectId: { type: "string", format: "uuid" } } },
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          depth: { type: "integer", minimum: 1, maximum: 5, default: 2 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { subjectId } = request.params as { subjectId: string };
      const { depth = 2 } = (request.query || {}) as { depth?: number };

      // Resolve subject → network node
      let nodeResult = await query(
        `SELECT node_id FROM network_node WHERE node_type = 'SUBJECT' AND entity_id = $1 LIMIT 1`,
        [subjectId],
      );

      // Auto-project if not yet in graph
      if (nodeResult.rows.length === 0) {
        await projectSubject(subjectId);
        nodeResult = await query(
          `SELECT node_id FROM network_node WHERE node_type = 'SUBJECT' AND entity_id = $1 LIMIT 1`,
          [subjectId],
        );
      }

      if (nodeResult.rows.length === 0) {
        return send404(reply, "SUBJECT_NOT_FOUND", "Subject not found in network graph");
      }

      const nodeId = nodeResult.rows[0].node_id as string;
      const result = await getNeighborhood(nodeId, Math.min(depth, 5));
      return result;
    } catch (err: unknown) {
      request.log.error(err, "Failed to get subject network");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // ── Transaction Network endpoint (FR-11 financial graph) ──────────────────
  app.get("/api/v1/graph/transaction-network", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        required: ["txnType"],
        properties: {
          txnType: { type: "string", enum: ["UPI", "BANK"] },
          subjectId: { type: "string", format: "uuid" },
          dateFrom: { type: "string", format: "date" },
          dateTo: { type: "string", format: "date" },
          minAmount: { type: "number", minimum: 0 },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireGraphAnalysis(request, reply)) return;
    try {
      const qs = request.query as {
        txnType: "UPI" | "BANK";
        subjectId?: string;
        dateFrom?: string;
        dateTo?: string;
        minAmount?: number;
      };

      const params: unknown[] = [];
      let paramIdx = 0;
      const nextParam = () => `$${++paramIdx}`;

      // Build WHERE clauses
      const whereClauses: string[] = [];

      if (qs.txnType === "UPI") {
        whereClauses.push(`ft.txn_type = 'UPI'`);
        whereClauses.push(`ft.sender_upi_id IS NOT NULL AND ft.receiver_upi_id IS NOT NULL`);
      } else {
        whereClauses.push(`ft.txn_type IN ('NEFT', 'RTGS', 'IMPS')`);
        whereClauses.push(`ft.sender_account_id IS NOT NULL AND ft.receiver_account_id IS NOT NULL`);
      }

      if (qs.subjectId) {
        whereClauses.push(`ft.subject_id = ${nextParam()}`);
        params.push(qs.subjectId);
      }
      if (qs.dateFrom) {
        whereClauses.push(`ft.occurred_at >= ${nextParam()}::date`);
        params.push(qs.dateFrom);
      }
      if (qs.dateTo) {
        whereClauses.push(`ft.occurred_at <= ${nextParam()}::date + INTERVAL '1 day'`);
        params.push(qs.dateTo);
      }
      if (qs.minAmount != null) {
        whereClauses.push(`ft.amount >= ${nextParam()}`);
        params.push(qs.minAmount);
      }

      const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      let aggregateQuery: string;
      if (qs.txnType === "UPI") {
        aggregateQuery = `
          SELECT
            ft.sender_upi_id AS sender_entity_id,
            ft.receiver_upi_id AS receiver_entity_id,
            su_s.vpa AS sender_label,
            su_r.vpa AS receiver_label,
            'UPI_ACCOUNT' AS sender_type,
            'UPI_ACCOUNT' AS receiver_type,
            su_s.provider_app AS sender_props_provider,
            su_r.provider_app AS receiver_props_provider,
            SUM(ft.amount) AS total_amount,
            COUNT(*) AS txn_count,
            MIN(ft.occurred_at) AS first_txn,
            MAX(ft.occurred_at) AS last_txn,
            BOOL_OR(ft.is_suspicious) AS has_suspicious,
            COUNT(*) FILTER (WHERE ft.is_suspicious) AS suspicious_count
          FROM financial_transaction ft
          JOIN upi_account su_s ON su_s.upi_id = ft.sender_upi_id
          JOIN upi_account su_r ON su_r.upi_id = ft.receiver_upi_id
          ${whereSQL}
          GROUP BY ft.sender_upi_id, ft.receiver_upi_id, su_s.vpa, su_r.vpa, su_s.provider_app, su_r.provider_app
          ORDER BY total_amount DESC
          LIMIT 100`;
      } else {
        aggregateQuery = `
          SELECT
            ft.sender_account_id AS sender_entity_id,
            ft.receiver_account_id AS receiver_entity_id,
            ba_s.bank_name || ' *' || RIGHT(ba_s.account_number, 4) AS sender_label,
            ba_r.bank_name || ' *' || RIGHT(ba_r.account_number, 4) AS receiver_label,
            'BANK_ACCOUNT' AS sender_type,
            'BANK_ACCOUNT' AS receiver_type,
            ba_s.bank_name AS sender_props_bank,
            ba_r.bank_name AS receiver_props_bank,
            SUM(ft.amount) AS total_amount,
            COUNT(*) AS txn_count,
            MIN(ft.occurred_at) AS first_txn,
            MAX(ft.occurred_at) AS last_txn,
            BOOL_OR(ft.is_suspicious) AS has_suspicious,
            COUNT(*) FILTER (WHERE ft.is_suspicious) AS suspicious_count
          FROM financial_transaction ft
          JOIN bank_account ba_s ON ba_s.account_id = ft.sender_account_id
          JOIN bank_account ba_r ON ba_r.account_id = ft.receiver_account_id
          ${whereSQL}
          GROUP BY ft.sender_account_id, ft.receiver_account_id, ba_s.bank_name, ba_s.account_number, ba_r.bank_name, ba_r.account_number
          ORDER BY total_amount DESC
          LIMIT 100`;
      }

      const txnRows = await query(aggregateQuery, params);

      // Build nodes and edges
      const nodesMap = new Map<string, {
        id: string; type: string; label: string;
        properties: Record<string, unknown>;
      }>();
      const edgesList: {
        id: string; from: string; to: string; edgeType: string;
        properties: Record<string, unknown>;
      }[] = [];

      let totalVolume = 0;
      let suspiciousTotal = 0;

      // Resolve subject links for entity IDs
      const entityToSubject = new Map<string, { subject_id: string; full_name: string; threat_level: string }>();

      if (txnRows.rows.length > 0) {
        const allEntityIds = new Set<string>();
        for (const row of txnRows.rows) {
          allEntityIds.add(row.sender_entity_id as string);
          allEntityIds.add(row.receiver_entity_id as string);
        }
        const entityIdArr = Array.from(allEntityIds);

        // Resolve subject ownership
        let subjectLinkQuery: string;
        if (qs.txnType === "UPI") {
          subjectLinkQuery = `
            SELECT sul.upi_id AS entity_id, sp.subject_id, sp.full_name, sp.threat_level
            FROM subject_upi_link sul
            JOIN subject_profile sp ON sp.subject_id = sul.subject_id AND sp.is_merged = FALSE
            WHERE sul.upi_id = ANY($1::uuid[])`;
        } else {
          subjectLinkQuery = `
            SELECT sal.account_id AS entity_id, sp.subject_id, sp.full_name, sp.threat_level
            FROM subject_account_link sal
            JOIN subject_profile sp ON sp.subject_id = sal.subject_id AND sp.is_merged = FALSE
            WHERE sal.account_id = ANY($1::uuid[])`;
        }
        const subjectLinks = await query(subjectLinkQuery, [entityIdArr]);
        for (const sl of subjectLinks.rows) {
          entityToSubject.set(sl.entity_id as string, {
            subject_id: sl.subject_id as string,
            full_name: sl.full_name as string,
            threat_level: sl.threat_level as string,
          });
        }
      }

      for (const row of txnRows.rows) {
        const senderId = row.sender_entity_id as string;
        const receiverId = row.receiver_entity_id as string;
        const amount = parseFloat(row.total_amount as string);
        const txnCount = parseInt(row.txn_count as string, 10);
        const suspCount = parseInt(row.suspicious_count as string, 10);
        totalVolume += amount;
        suspiciousTotal += suspCount;

        // Add account nodes
        if (!nodesMap.has(senderId)) {
          const subj = entityToSubject.get(senderId);
          nodesMap.set(senderId, {
            id: senderId,
            type: row.sender_type as string,
            label: row.sender_label as string,
            properties: {
              ...(row.sender_props_provider ? { provider_app: row.sender_props_provider } : {}),
              ...(row.sender_props_bank ? { bank_name: row.sender_props_bank } : {}),
              ...(subj ? { subject_id: subj.subject_id, subject_name: subj.full_name } : {}),
            },
          });
        }
        if (!nodesMap.has(receiverId)) {
          const subj = entityToSubject.get(receiverId);
          nodesMap.set(receiverId, {
            id: receiverId,
            type: row.receiver_type as string,
            label: row.receiver_label as string,
            properties: {
              ...(row.receiver_props_provider ? { provider_app: row.receiver_props_provider } : {}),
              ...(row.receiver_props_bank ? { bank_name: row.receiver_props_bank } : {}),
              ...(subj ? { subject_id: subj.subject_id, subject_name: subj.full_name } : {}),
            },
          });
        }

        // Add subject nodes for linked accounts
        const senderSubj = entityToSubject.get(senderId);
        if (senderSubj && !nodesMap.has(senderSubj.subject_id)) {
          nodesMap.set(senderSubj.subject_id, {
            id: senderSubj.subject_id,
            type: "SUBJECT",
            label: senderSubj.full_name,
            properties: { threat_level: senderSubj.threat_level },
          });
        }
        const receiverSubj = entityToSubject.get(receiverId);
        if (receiverSubj && !nodesMap.has(receiverSubj.subject_id)) {
          nodesMap.set(receiverSubj.subject_id, {
            id: receiverSubj.subject_id,
            type: "SUBJECT",
            label: receiverSubj.full_name,
            properties: { threat_level: receiverSubj.threat_level },
          });
        }

        // Mark unlinked accounts as EXTERNAL
        if (!entityToSubject.has(senderId)) {
          const existing = nodesMap.get(senderId);
          if (existing) existing.type = "EXTERNAL";
        }
        if (!entityToSubject.has(receiverId)) {
          const existing = nodesMap.get(receiverId);
          if (existing) existing.type = "EXTERNAL";
        }

        // Edge: account → account
        const edgeType = qs.txnType === "UPI" ? "UPI_TRANSFER" : "TRANSACTED_WITH";
        edgesList.push({
          id: `${senderId}-${receiverId}`,
          from: senderId,
          to: receiverId,
          edgeType,
          properties: {
            total_amount: amount,
            txn_count: txnCount,
            first_txn: row.first_txn,
            last_txn: row.last_txn,
            is_suspicious: row.has_suspicious as boolean,
            suspicious_count: suspCount,
          },
        });

        // Edge: subject → account (ownership)
        if (senderSubj) {
          const ownerEdgeId = `${senderSubj.subject_id}-${senderId}-owns`;
          if (!edgesList.some((e) => e.id === ownerEdgeId)) {
            edgesList.push({
              id: ownerEdgeId,
              from: senderSubj.subject_id,
              to: senderId,
              edgeType: qs.txnType === "UPI" ? "HAS_UPI" : "HAS_ACCOUNT",
              properties: {},
            });
          }
        }
        if (receiverSubj) {
          const ownerEdgeId = `${receiverSubj.subject_id}-${receiverId}-owns`;
          if (!edgesList.some((e) => e.id === ownerEdgeId)) {
            edgesList.push({
              id: ownerEdgeId,
              from: receiverSubj.subject_id,
              to: receiverId,
              edgeType: qs.txnType === "UPI" ? "HAS_UPI" : "HAS_ACCOUNT",
              properties: {},
            });
          }
        }
      }

      return {
        nodes: Array.from(nodesMap.values()),
        edges: edgesList,
        summary: {
          totalVolume,
          suspiciousCount: suspiciousTotal,
          nodeCount: nodesMap.size,
          edgeCount: edgesList.length,
        },
      };
    } catch (err: unknown) {
      request.log.error(err, "Transaction network query failed");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // List network nodes with filtering
  app.get("/api/v1/graph/nodes", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string" },
          search: { type: "string", maxLength: 200 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const qs = request.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(qs.limit || "50", 10) || 50, 200);
    const offset = Math.max(parseInt(qs.offset || "0", 10) || 0, 0);
    const result = await query(
      `SELECT *, COUNT(*) OVER() AS total_count FROM network_node
       WHERE ($1::text IS NULL OR node_type = $1)
         AND ($2::text IS NULL OR label ILIKE '%' || $2 || '%')
       ORDER BY updated_at DESC
       LIMIT $3 OFFSET $4`,
      [qs.type || null, qs.search || null, limit, offset],
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count as string, 10) : 0;
    return { nodes: result.rows.map(({ total_count, ...r }) => r), total };
  });
}
