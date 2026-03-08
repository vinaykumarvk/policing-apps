-- FR-13 AC-01/04: Watchlist priority tier and alert suppression
ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS priority_tier TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS alert_suppression_hours INTEGER NOT NULL DEFAULT 0;

ALTER TABLE watchlist_subject ADD COLUMN IF NOT EXISTS last_alerted_at TIMESTAMPTZ;
