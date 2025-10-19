import { pgTable, text, integer, timestamp, serial } from 'drizzle-orm/pg-core';
import { db } from './db';
import { eq } from 'drizzle-orm';

export const withdrawals = pgTable('withdrawals', {
  id: serial('id').primaryKey(),
  blockNumber: integer('block_number'),
  from: text('from').notNull(),
  to: text('to').notNull(),
  value: text('value').notNull(),
  hash: text('hash').unique(),
  status: text('status').notNull().default('pending'), // e.g., pending, sent, confirmed, failed
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

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
