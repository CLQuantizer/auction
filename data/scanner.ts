import { pgTable, integer, timestamp } from "drizzle-orm/pg-core";
import { db } from "./db";
import { eq } from "drizzle-orm";

const SCANNER_ID = 1;

export const scannedBlocks = pgTable("scanned_blocks", {
  id: integer("id").primaryKey(),
  blockNumber: integer("block_number").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const getLatestScannedBlock = async () => {
  const result = await db
    .select({ blockNumber: scannedBlocks.blockNumber })
    .from(scannedBlocks)
    .where(eq(scannedBlocks.id, SCANNER_ID));

  if (result.length > 0 && result[0]) {
    return result[0].blockNumber;
  }
  return 0;
};

export const updateLatestScannedBlock = async (blockNumber: number) => {
  await db
    .insert(scannedBlocks)
    .values({ id: SCANNER_ID, blockNumber })
    .onConflictDoUpdate({
      target: scannedBlocks.id,
      set: { blockNumber },
    });
};
