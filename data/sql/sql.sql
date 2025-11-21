-- Balance table to store user balances
CREATE TABLE balance (
    user_id TEXT NOT NULL,
    asset INTEGER NOT NULL,
    total DOUBLE PRECISION NOT NULL,
    free DOUBLE PRECISION NOT NULL,
    locked DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, asset)
);

-- Balance log table to record changes in balances
CREATE TABLE balance_log (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    asset INTEGER NOT NULL,
    delta DOUBLE PRECISION NOT NULL,
    type INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Deposits table to track incoming funds
CREATE TABLE deposits (
    id SERIAL PRIMARY KEY,
    block_number INTEGER NOT NULL,
    tx_from TEXT NOT NULL,
    tx_to TEXT NOT NULL,
    value TEXT NOT NULL,
    hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Scanned blocks table to track the last scanned block number
-- This table should only ever have one row
CREATE TABLE scanned_blocks (
    id INTEGER PRIMARY KEY,
    block_number INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Withdrawals table to track outgoing funds
CREATE TABLE withdrawals (
   id SERIAL PRIMARY KEY,
   block_number INTEGER,
   tx_from TEXT NOT NULL,
   tx_to TEXT NOT NULL,
   value TEXT NOT NULL,
   hash TEXT UNIQUE,
   status TEXT NOT NULL DEFAULT 'pending',
   created_at TIMESTAMP NOT NULL DEFAULT NOW(),
   updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for withdrawals table for better query performance
CREATE INDEX idx_withdrawals_block_number ON withdrawals (block_number);
CREATE INDEX idx_withdrawals_tx_to ON withdrawals (tx_to);
CREATE INDEX idx_withdrawals_hash ON withdrawals (hash);

-- Indexes for balance_log table for better query performance
CREATE INDEX idx_balance_log_user_id ON balance_log (user_id);
CREATE INDEX idx_balance_log_asset ON balance_log (asset);
CREATE INDEX idx_balance_log_user_asset ON balance_log (user_id, asset);
CREATE INDEX idx_balance_log_created_at ON balance_log (created_at);

-- Indexes for deposits table for better query performance
CREATE INDEX idx_deposits_block_number ON deposits (block_number);
CREATE INDEX idx_deposits_tx_from ON deposits (tx_from);
CREATE INDEX idx_deposits_tx_to ON deposits (tx_to);