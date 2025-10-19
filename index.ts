import { Hono } from "hono";
import { auctionEngine } from "./core/auctionEngine";
import { orderRoutes } from "./routes/order";
import { scanDeposits } from "./core/cron/scanDeposit";
import { bnbChain } from "./chain/bnb";

console.log("Starting auction application...");

bnbChain.start();
auctionEngine.start();
// scanDeposits();

const app = new Hono();

app.get("/", (c) => c.text("Welcome to the Auction Server!"));
app.route("/api", orderRoutes);

export default {
  port: 3000,
  fetch: app.fetch,
};