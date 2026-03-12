-- Migration 058: Graph Projection Layer
-- Canonical network_node/network_edge tables for typed graph model
-- Replaces extraction-oriented extracted_entity/entity_relationship for graph queries (FR-11)

-- ─── Network Node ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS network_node (
  node_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_type    VARCHAR(30) NOT NULL
    CHECK (node_type IN ('SUBJECT', 'PHONE', 'BANK_ACCOUNT', 'DEVICE', 'VEHICLE', 'ADDRESS', 'SOCIAL_ACCOUNT', 'IDENTITY_DOC', 'ORGANIZATION')),
  entity_id    UUID NOT NULL,
  label        TEXT NOT NULL,
  properties   JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nn_entity ON network_node(node_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_nn_type ON network_node(node_type);

-- ─── Network Edge ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS network_edge (
  edge_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node_id   UUID NOT NULL REFERENCES network_node(node_id) ON DELETE CASCADE,
  to_node_id     UUID NOT NULL REFERENCES network_node(node_id) ON DELETE CASCADE,
  edge_type      VARCHAR(40) NOT NULL
    CHECK (edge_type IN (
      'HAS_PHONE', 'HAS_ACCOUNT', 'HAS_DEVICE', 'HAS_VEHICLE', 'HAS_ADDRESS', 'HAS_SOCIAL',
      'HAS_IDENTITY', 'ASSOCIATE', 'FAMILY', 'GANG', 'CO_ACCUSED', 'SUPPLIER', 'BUYER',
      'CALLED', 'TRANSACTED_WITH', 'CO_LOCATED', 'SHARED_DEVICE', 'SHARED_ACCOUNT'
    )),
  is_inferred    BOOLEAN DEFAULT FALSE,
  evidence_count INTEGER DEFAULT 1,
  confidence     NUMERIC(5,2) DEFAULT 100 CHECK (confidence BETWEEN 0 AND 100),
  strength       NUMERIC(5,2) DEFAULT 50 CHECK (strength BETWEEN 0 AND 100),
  first_seen_at  TIMESTAMPTZ,
  last_seen_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ne_from ON network_edge(from_node_id);
CREATE INDEX IF NOT EXISTS idx_ne_to ON network_edge(to_node_id);
CREATE INDEX IF NOT EXISTS idx_ne_type ON network_edge(edge_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ne_unique ON network_edge(from_node_id, to_node_id, edge_type);
