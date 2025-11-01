# Persistence Architecture

## Overview

This application uses a hybrid persistence model where:
- **Trades and Auctions** are persisted via publishers to Cloudflare Workers
- **Only logs** are persisted in Postgres

## Trade & Auction Persistence

Trades and auctions are **not** stored in Postgres. Instead, they are published to Cloudflare Workers for persistence:

### Trades
- Published via `tradePublisher.publish()` in `core/tradePublisher.ts`
- Called after trade execution in `core/auctionEngine.ts` (line 140)
- Contains: trade ID, price, quantity, buy/sell order IDs, timestamp

### Auctions
- Published via `auctionPublisher.publish()` in `core/auctionPublisher.ts`
- Called after each auction run in `core/auctionEngine.ts` (lines 45-52, 61-68, 153-160)
- Contains: auction ID, clearing price, volume, trade count, status, timestamp

## Postgres Persistence (Logs Only)

Postgres is used exclusively for **logging and state tracking**:

### Tables

1. **`balance`** - Current user balances
   - `user_id`, `total`, `free`, `locked`
   - Updated when trades settle balances

2. **`balance_log`** - Audit log of all balance changes
   - `user_id`, `delta`, `type`, `created_at`, `updated_at`
   - Records all balance changes including trade settlements
   - Type `TRADE` logs balance changes from trade execution (see `LedgerTransactionType.TRADE`)

3. **`deposits`** - Incoming blockchain deposits
   - Tracks deposits from the blockchain

4. **`withdrawals`** - Outgoing withdrawal requests
   - Tracks withdrawal status and blockchain transactions

5. **`scanned_blocks`** - Blockchain scanning state
   - Tracks the last scanned block number

### Trade Balance Settlement

When trades execute, balance changes are logged to Postgres via `ledger.log()`:
- Buy orders: Deduct QUOTE, credit BASE
- Sell orders: Deduct BASE, credit QUOTE
- All balance changes are logged with `LedgerTransactionType.TRADE` in `balance_log`

## Summary

✅ **Cloudflare Workers**: Trades and auctions (full data)  
✅ **Postgres**: Balance logs only (audit trail of balance changes from trades)

