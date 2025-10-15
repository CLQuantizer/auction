import { test, expect } from "bun:test";
import { db } from "../data/db";
import { sql } from "drizzle-orm";

test("database should connect", async () => {
  const result = await db.execute(sql`select 1`);
  expect(result).toBeDefined();
});
