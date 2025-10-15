import { pgTable, text, doublePrecision, timestamp, integer } from 'drizzle-orm/pg-core';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { Decimal } from 'decimal.js';

export const balance = pgTable('balance', {
  userId: text('user_id').primaryKey(),
  total: doublePrecision('total').notNull(),
  free: doublePrecision('free').notNull(),
  locked: doublePrecision('locked').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const balanceLog = pgTable('balance_log', {
  userId: text('user_id').primaryKey(),
  delta: doublePrecision('delta').notNull(),
  type: integer('type').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

class Ledger {
  async getBalance(userId: string) {
    return db.select().from(balance).where(eq(balance.userId, userId));
  }

  async lockBalance(userId: string, amount: Decimal): Promise<boolean> {
    const userBalances = await this.getBalance(userId);

    if (!userBalances || userBalances.length === 0) {
      // Or create a new balance record
      return false;
    }
    const userBalance = userBalances[0];
    if (!userBalance) {
      return false;
    }

    const freeBalance = new Decimal(userBalance.free);
    if (freeBalance.lessThan(amount)) {
      return false;
    }

    const newFree = freeBalance.minus(amount);
    const newLocked = new Decimal(userBalance.locked).plus(amount);

    await db.update(balance)
      .set({
        free: newFree.toNumber(),
        locked: newLocked.toNumber(),
        updatedAt: new Date(),
      })
      .where(eq(balance.userId, userId));

    return true;
  }

  async releaseBalance(userId: string, amount: Decimal): Promise<boolean> {
    const userBalances = await this.getBalance(userId);

    if (!userBalances || userBalances.length === 0) {
      return false;
    }
    const userBalance = userBalances[0];
    if (!userBalance) {
      return false;
    }

    const lockedBalance = new Decimal(userBalance.locked);
    if (lockedBalance.lessThan(amount)) {
      // This should not happen in normal operation
      return false;
    }

    const newFree = new Decimal(userBalance.free).plus(amount);
    const newLocked = lockedBalance.minus(amount);

    await db.update(balance)
      .set({
        free: newFree.toNumber(),
        locked: newLocked.toNumber(),
        updatedAt: new Date(),
      })
      .where(eq(balance.userId, userId));

    return true;
  }
}

export const ledger = new Ledger();

