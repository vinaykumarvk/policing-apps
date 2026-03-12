-- Migration 063: Transaction Network — FK columns, CHECK constraint updates, indexes
-- Enables account-level graph edges for UPI + bank transaction network maps.

-- 1. Add sender/receiver FK columns to financial_transaction
ALTER TABLE financial_transaction
  ADD COLUMN IF NOT EXISTS sender_account_id UUID REFERENCES bank_account(account_id),
  ADD COLUMN IF NOT EXISTS receiver_account_id UUID REFERENCES bank_account(account_id),
  ADD COLUMN IF NOT EXISTS sender_upi_id UUID REFERENCES upi_account(upi_id),
  ADD COLUMN IF NOT EXISTS receiver_upi_id UUID REFERENCES upi_account(upi_id),
  ADD COLUMN IF NOT EXISTS is_suspicious BOOLEAN DEFAULT FALSE;

-- 2. Extend network_node CHECK to include UPI_ACCOUNT
ALTER TABLE network_node DROP CONSTRAINT IF EXISTS network_node_node_type_check;
ALTER TABLE network_node ADD CONSTRAINT network_node_node_type_check
  CHECK (node_type IN (
    'SUBJECT','PHONE','BANK_ACCOUNT','UPI_ACCOUNT','DEVICE','VEHICLE',
    'ADDRESS','SOCIAL_ACCOUNT','IDENTITY_DOC','ORGANIZATION'
  ));

-- 3. Extend network_edge CHECK to include HAS_UPI + UPI_TRANSFER
ALTER TABLE network_edge DROP CONSTRAINT IF EXISTS network_edge_edge_type_check;
ALTER TABLE network_edge ADD CONSTRAINT network_edge_edge_type_check
  CHECK (edge_type IN (
    'HAS_PHONE','HAS_ACCOUNT','HAS_UPI','HAS_DEVICE','HAS_VEHICLE','HAS_ADDRESS','HAS_SOCIAL',
    'HAS_IDENTITY','ASSOCIATE','FAMILY','GANG','CO_ACCUSED','SUPPLIER','BUYER',
    'CALLED','TRANSACTED_WITH','UPI_TRANSFER','CO_LOCATED','SHARED_DEVICE','SHARED_ACCOUNT'
  ));

-- 4. Indexes for transaction network queries
CREATE INDEX IF NOT EXISTS idx_fin_txn_type ON financial_transaction(txn_type);
CREATE INDEX IF NOT EXISTS idx_fin_txn_sender_acct ON financial_transaction(sender_account_id);
CREATE INDEX IF NOT EXISTS idx_fin_txn_receiver_acct ON financial_transaction(receiver_account_id);
CREATE INDEX IF NOT EXISTS idx_fin_txn_sender_upi ON financial_transaction(sender_upi_id);
CREATE INDEX IF NOT EXISTS idx_fin_txn_receiver_upi ON financial_transaction(receiver_upi_id);
CREATE INDEX IF NOT EXISTS idx_fin_txn_suspicious ON financial_transaction(is_suspicious) WHERE is_suspicious = TRUE;
