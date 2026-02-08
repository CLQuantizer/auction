import { Hono } from "hono";
import { auctionEngine } from "./core/auctionEngine";
import { orderRoutes } from "./routes/order";
import { startDepositScanner } from "./core/cron/scanDeposit";
import { withdrawRoutes } from "./routes/withdraw";
import { balanceRoutes } from "./routes/balance";

console.log("Starting auction application...");

auctionEngine.start();
startDepositScanner();

const app = new Hono();
const AUCTION_AUTH_HEADER = "x-auction-auth";
const AUCTION_AUTH_VALUE = "whosyourdaddy";

app.use("*", async (c, next) => {
  const authHeader = c.req.header(AUCTION_AUTH_HEADER);
  if (authHeader !== AUCTION_AUTH_VALUE) {
    return c.text("Unauthorized", 401);
  }
  return next();
});

app.get("/", (c) => c.text("Welcome to the Auction Server!"));
app.route("/api", orderRoutes);
app.route("/api", withdrawRoutes);
app.route("/api", balanceRoutes);

export default {
  port: 3000,
  fetch: app.fetch,
};