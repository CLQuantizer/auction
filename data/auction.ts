import { pgTable, text, doublePrecision, timestamp, serial, integer } from 'drizzle-orm/pg-core';
import { db } from './db';
import { Decimal } from 'decimal.js';
import { desc, eq } from 'drizzle-orm';

export const auctions = pgTable('auctions', {
  id: serial('id').primaryKey(),
  clearingPrice: doublePrecision('clearing_price'),
  volume: doublePrecision('volume').notNull(),
  tradeCount: integer('trade_count').notNull().default(0),
  status: text('status').notNull().default('completed'), // completed, no_trades, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Auction = typeof auctions.$inferSelect;
export type NewAuction = typeof auctions.$inferInsert;

class AuctionRepository {
  async create(auctionData: {
    clearingPrice: Decimal | null;
    volume: Decimal;
    tradeCount: number;
    status?: string;
  }): Promise<Auction> {
    const [auction] = await db.insert(auctions).values({
      clearingPrice: auctionData.clearingPrice?.toNumber() ?? null,
      volume: auctionData.volume.toNumber(),
      tradeCount: auctionData.tradeCount,
      status: auctionData.status || 'completed',
    }).returning();

    if (!auction) {
      throw new Error('Failed to create auction');
    }

    return auction;
  }

  async getAll(limit?: number): Promise<Auction[]> {
    const query = db.select().from(auctions).orderBy(desc(auctions.createdAt));
    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }

  async getById(id: number): Promise<Auction | undefined> {
    const [auction] = await db.select().from(auctions).where(eq(auctions.id, id));
    return auction;
  }

  async getRecent(limit: number = 10): Promise<Auction[]> {
    return await db.select().from(auctions).orderBy(desc(auctions.createdAt)).limit(limit);
  }
}

export const auctionRepository = new AuctionRepository();

