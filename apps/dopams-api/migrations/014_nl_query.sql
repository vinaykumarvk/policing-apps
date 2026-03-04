-- Natural Language Query Assistant – audit log for NL queries

CREATE TABLE IF NOT EXISTS nl_query_log (
  query_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID,
  query_text       TEXT NOT NULL,
  generated_sql    TEXT,
  result_summary   TEXT,
  citations        JSONB DEFAULT '[]'::jsonb,
  status           TEXT NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED','DENIED')),
  error_message    TEXT,
  execution_time_ms INTEGER,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nl_query_user   ON nl_query_log(user_id);
CREATE INDEX IF NOT EXISTS idx_nl_query_status ON nl_query_log(status);
