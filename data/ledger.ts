import { pgTable, text, doublePrecision, timestamp } from 'drizzle-orm/pg-core';

export const ledger = pgTable('ledger', {
  userId: text('user_id').primaryKey(),
  balanceTotal: doublePrecision('balance_total').notNull(),
  balanceFree: doublePrecision('balance_free').notNull(),
  balanceLocked: doublePrecision('balance_locked').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
