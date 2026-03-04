-- Tier 4B: Network/Graph Analysis — centrality scoring, community detection, kingpin discovery

CREATE TABLE IF NOT EXISTS graph_analysis_result (
  analysis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('CENTRALITY','COMMUNITY','KINGPIN')),
  degree_centrality NUMERIC(8,4) DEFAULT 0,
  betweenness_centrality NUMERIC(8,4) DEFAULT 0,
  closeness_centrality NUMERIC(8,4) DEFAULT 0,
  community_id TEXT,
  is_kingpin BOOLEAN DEFAULT false,
  risk_score NUMERIC(5,2) DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_graph_analysis_entity ON graph_analysis_result(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_graph_analysis_kingpin ON graph_analysis_result(is_kingpin) WHERE is_kingpin = true;
CREATE INDEX IF NOT EXISTS idx_graph_analysis_centrality ON graph_analysis_result(betweenness_centrality DESC);
