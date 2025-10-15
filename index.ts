import { auctionEngine } from "./core/auction";
import { toDecimal } from "./core/constants";
import { OrderSide } from "./core/messages/order";
import { orderBook } from "./core/orderbook";

console.log("Starting auction application...");

// --- Add some sample orders ---
orderBook.addOrder({ userId: 'user1', side: OrderSide.BUY, price: toDecimal(100), quantity: toDecimal(10) });
orderBook.addOrder({ userId: 'user2', side: OrderSide.BUY, price: toDecimal(101), quantity: toDecimal(5) });
orderBook.addOrder({ userId: 'user3', side: OrderSide.SELL, price: toDecimal(102), quantity: toDecimal(8) });
orderBook.addOrder({ userId: 'user4', side: OrderSide.SELL, price: toDecimal(101.55555), quantity: toDecimal(12) });
orderBook.addOrder({ userId: 'user5', side: OrderSide.BUY, price: toDecimal(101.123456), quantity: toDecimal(3) });


console.log("Initial orders in book:", orderBook.getOrders().length);

// --- Start the auction engine ---
auctionEngine.start();

// The application will now run and process auctions every few seconds.
// You can add more orders to the book in a real application via an API, etc.

// To stop the engine gracefully, you might have a condition like this:
// setTimeout(() => {
//   auctionEngine.stop();
//   console.log("Remaining orders:", orderBook.getOrders());
// }, 20000); // Stop after 20 seconds for this example