import { pgTable, text, integer, timestamp, serial } from 'drizzle-orm/pg-core';
import { db } from './db';
import { eq } from 'drizzle-orm';

export const withdrawals = pgTable('withdrawals', {
  id: serial('id').primaryKey(),
  blockNumber: integer('block_number'),
  from: text('tx_from').notNull(),
  to: text('tx_to').notNull(),
  value: text('value').notNull(),
  hash: text('hash').unique(),
  status: text('status').notNull().default('pending'), // e.g., pending, sent, confirmed, failed
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

//sql schema
// CREATE TABLE withdrawals (
//    id SERIAL PRIMARY KEY,
//    block_number INTEGER,
//    tx_from TEXT NOT NULL,
//    tx_to TEXT NOT NULL,
//    value TEXT NOT NULL,
//    hash TEXT UNIQUE,
//    status TEXT NOT NULL DEFAULT 'pending',
//    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
//    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
// );
// CREATE INDEX idx_withdrawals_block_number ON withdrawals (block_number);
// CREATE INDEX idx_withdrawals_tx_to ON withdrawals (tx_to);
// CREATE INDEX idx_withdrawals_hash ON withdrawals (hash);

export type Withdrawal = typeof withdrawals.$inferSelect;
export type NewWithdrawal = Omit<Withdrawal, 'id' | 'createdAt' | 'updatedAt'>;

export const createWithdrawal = async (withdrawal: NewWithdrawal) => {
  const result = await db.insert(withdrawals).values(withdrawal).returning();
  return result[0];
};

export const updateWithdrawalStatus = async (id: number, status: string) => {
    const result = await db.update(withdrawals).set({ status, updatedAt: new Date() }).where(eq(withdrawals.id, id)).returning();
    return result[0];
}
