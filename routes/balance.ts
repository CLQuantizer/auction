import { Hono } from "hono";
import { ledger } from "../data/ledger";

export const balanceRoutes = new Hono();

balanceRoutes.get("/balances/:userId", async (c) => {
  const userId = c.req.param("userId");

  if (!userId) {
    return c.text("userId is required", 400);
  }

  try {
    const balances = await ledger.getAllBalances(userId);

    if (!balances || balances.length === 0) {
      return c.json([], 404);
    }

    // Convert balance fields to strings for consistent JSON output
    const formattedBalances = balances.map(b => ({
      ...b,
      total: String(b.total),
      free: String(b.free),
      locked: String(b.locked),
    }));


    return c.json(formattedBalances);
  } catch (error) {
    console.error(`Failed to get balances for userId ${userId}:`, error);
    return c.text("Failed to retrieve balances", 500);
  }
});
