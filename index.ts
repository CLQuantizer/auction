import { Hono } from "hono";
import { auctionEngine } from "./core/auctionEngine";
import { orderRoutes } from "./routes/order";
import { startScanner } from "./core/cron/scanDeposit";

console.log("Starting auction application...");

auctionEngine.start();
startScanner();

const app = new Hono();

app.get("/", (c) => c.text("Welcome to the Auction Server!"));
app.route("/api", orderRoutes);

export default {
  port: 3000,
  fetch: app.fetch,
};