import { pgTable, text, integer, timestamp, serial } from 'drizzle-orm/pg-core';
import { db } from './db';

export const deposits = pgTable('deposits', {
  id: serial('id').primaryKey(),
  blockNumber: integer('block_number').notNull(),
  from: text('tx_from').notNull(),
  to: text('tx_to').notNull(),
  value: text('value').notNull(),
  hash: text('hash').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});


export type Deposit = typeof deposits.$inferSelect;
export type NewDeposit = Omit<Deposit, 'id' | 'createdAt' | 'updatedAt'>;

export const createDeposit = async (deposit: NewDeposit) => {
  const result = await db
    .insert(deposits)
    .values(deposit)
    .onConflictDoNothing({ target: deposits.hash })
    .returning();
  
  return result[0];
};
