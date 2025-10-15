import { Hono } from "hono";
import { auctionEngine } from "./core/auction";
import { orderRoutes } from "./routes/order";

console.log("Starting auction application...");

auctionEngine.start();

const app = new Hono();

app.get("/", (c) => c.text("Welcome to the Auction Server!"));
app.route("/api", orderRoutes);

export default {
  port: 3000,
  fetch: app.fetch,
};