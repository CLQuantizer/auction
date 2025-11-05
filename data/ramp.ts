import { pgTable, text, doublePrecision, timestamp, serial } from 'drizzle-orm/pg-core';
import { db } from './db';
import { Decimal } from 'decimal.js';
import { LedgerTransactionType, tokenToAsset } from './ledgerTypes';
import { ledger } from './ledger';

// user_id is quite simply the public_key of the user on the blockchain
export const deposits = pgTable('deposits', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  amount: doublePrecision('amount').notNull(),
  token: text('token').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const withdrawals = pgTable('withdrawals', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  amount: doublePrecision('amount').notNull(),
  token: text('token').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export async function credit(userId: string, amount: Decimal, token: string) {
  await db.insert(deposits).values({
    userId,
    amount: amount.toNumber(),
    token,
  });
  return ledger.log(userId, amount, LedgerTransactionType.DEPOSIT, tokenToAsset(token));
}

export async function deduct(userId: string, amount: Decimal, token: string) {
  await db.insert(withdrawals).values({
    userId,
    amount: amount.toNumber(),
    token,
  });
  return ledger.log(userId, amount.negated(), LedgerTransactionType.WITHDRAWAL, tokenToAsset(token));
}
