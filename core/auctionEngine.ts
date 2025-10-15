import { Decimal } from "decimal.js";
import { AUCTION_INTERVAL_SECONDS } from "./primitives/constants";
import { type Order } from "./messages/order";
import type { Trade } from "./messages/trade";
import { orderBook } from "./orderbook";
import { tradePublisher } from "./tradePublisher";

class AuctionEngine {
  private timer: ReturnType<typeof setInterval> | null = null;

  start() {
    console.log("Auction engine started.");
    this.timer = setInterval(
      () => this.runAuction(),
      AUCTION_INTERVAL_SECONDS * 1000
    );
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log("Auction engine stopped.");
    }
  }

  public runAuction() {
    console.log(
      `\n--- Running auction at ${new Date().toLocaleTimeString()} ---`
    );
    const allOrders = orderBook.getOrders();
    if (allOrders.length === 0) {
      console.log("No orders in the book. Skipping auction.");
      return;
    }

    const { clearingPrice, volume } = orderBook.findClearingPrice();

    if (clearingPrice === null || volume.isZero()) {
      console.log("No matching trades in this auction.");
      return;
    }

    console.log(
      `Clearing price determined: ${clearingPrice} with volume: ${volume}`
    );

    const newTrades: Trade[] = [];
    let filledVolume = new Decimal(0);
    const buyOrders = orderBook
      .getBuyOrders()
      .filter((o) => o.price.gte(clearingPrice));

    const sellOrders = orderBook
      .getSellOrders()
      .filter((o) => o.price.lte(clearingPrice));

    const remainingOrders: Order[] = [
      ...orderBook.getBuyOrders().filter((o) => o.price.lt(clearingPrice)),
      ...orderBook.getSellOrders().filter((o) => o.price.gt(clearingPrice)),
    ];

    let buyIndex = 0;
    let sellIndex = 0;

    while (
      buyIndex < buyOrders.length &&
      sellIndex < sellOrders.length &&
      filledVolume.lessThan(volume)
    ) {
      const buyOrder = buyOrders[buyIndex]!;
      const sellOrder = sellOrders[sellIndex]!;

      const tradeQuantity = Decimal.min(
        buyOrder.quantity,
        sellOrder.quantity
      );

      const trade: Trade = {
        id: crypto.randomUUID(),
        price: clearingPrice,
        quantity: tradeQuantity,
        buyOrderId: buyOrder.id,
        sellOrderId: sellOrder.id,
        timestamp: Date.now(),
      };

      newTrades.push(trade);
      console.log(`New Trade: ${trade.quantity} @ ${trade.price}`);
      filledVolume = filledVolume.plus(tradeQuantity);

      buyOrder.quantity = buyOrder.quantity.minus(tradeQuantity);
      sellOrder.quantity = sellOrder.quantity.minus(tradeQuantity);

      if (buyOrder.quantity.isZero()) {
        buyIndex++;
      }
      if (sellOrder.quantity.isZero()) {
        sellIndex++;
      }
    }
    
    if (newTrades.length > 0) {
      tradePublisher.publish(newTrades);
    }

    [...buyOrders, ...sellOrders].forEach((o) => {
      if (o.quantity.greaterThan(0)) {
        remainingOrders.push(o);
      }
    });

    orderBook.updateOrders(remainingOrders);
    console.log(`${remainingOrders.length} orders remaining in the book.`);
  }
}

export const auctionEngine = new AuctionEngine();
