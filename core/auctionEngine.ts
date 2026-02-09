import { Decimal } from "decimal.js";
import { AUCTION_INTERVAL_SECONDS } from "./primitives/constants";
import { type Order, OrderSide } from "./messages/order";
import type { Trade } from "./messages/trade";
import { orderBook } from "./orderbook";
import { auctionPublisher } from "./auctionPublisher";
import { marginGuard } from "./marginGuard";
import { ledger } from "../data/ledger";
import { LedgerTransactionType, Assets } from "../data/ledgerTypes";
import { CronJob } from "cron";

class AuctionEngine {
  private job: CronJob | null = null;

  start() {
    console.log("Auction engine started.");
    // Cron format: "*/5 * * * * *" = every 5 seconds (6-field format with seconds)
    const cronExpression = `*/${AUCTION_INTERVAL_SECONDS} * * * * *`;
    this.job = new CronJob(cronExpression, () => {
      // Handle async errors properly
      this.runAuction().catch((error) => {
        console.error("Error running auction:", error);
      });
    });
    this.job.start();
  }

  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
      console.log("Auction engine stopped.");
    }
  }

  public async runAuction() {
    console.log(
      `\n--- Running auction at ${new Date().toLocaleTimeString()} ---`
    );
    const allOrders = orderBook.getOrders();
    
    if (allOrders.length === 0) {
      console.log("No orders in the book. Skipping auction.");
      // Publish auction with no orders
      await auctionPublisher.publish({
        id: crypto.randomUUID(),
        clearingPrice: null,
        volume: new Decimal(0),
        tradeCount: 0,
        status: 'no_orders',
        timestamp: Date.now(),
      });
      return;
    }

    const { clearingPrice, volume } = orderBook.findClearingPrice();

    if (clearingPrice === null || volume.isZero()) {
      console.log("No matching trades in this auction.");
      // Publish auction with no trades
      await auctionPublisher.publish({
        id: crypto.randomUUID(),
        clearingPrice: null,
        volume: volume,
        tradeCount: 0,
        status: 'no_trades',
        timestamp: Date.now(),
      });
      return;
    }

    console.log(
      `Clearing price determined: ${clearingPrice} with volume: ${volume}`
    );

    const newTrades: Trade[] = [];
    let filledVolume = new Decimal(0);
    // Get orders that can participate in matching
    const buyOrders = orderBook
      .getBuyOrders()
      .filter((o) => o.price.gte(clearingPrice));

    const sellOrders = orderBook
      .getSellOrders()
      .filter((o) => o.price.lte(clearingPrice));

    // Start with unmatched orders (won't participate in matching)
    const remainingOrders: Order[] = [
      ...orderBook.getBuyOrders().filter((o) => o.price.lt(clearingPrice)),
      ...orderBook.getSellOrders().filter((o) => o.price.gt(clearingPrice)),
    ];

    // Track order quantities as we match
    const orderQuantities = new Map<string, Decimal>();
    buyOrders.forEach((o) => {
      orderQuantities.set(o.id, new Decimal(o.quantity));
    });
    sellOrders.forEach((o) => {
      orderQuantities.set(o.id, new Decimal(o.quantity));
    });

    let buyIndex = 0;
    let sellIndex = 0;

    while (
      buyIndex < buyOrders.length &&
      sellIndex < sellOrders.length &&
      filledVolume.lessThan(volume)
    ) {
      const buyOrder = buyOrders[buyIndex]!;
      const sellOrder = sellOrders[sellIndex]!;

      const buyRemaining = orderQuantities.get(buyOrder.id)!;
      const sellRemaining = orderQuantities.get(sellOrder.id)!;

      const tradeQuantity = Decimal.min(buyRemaining, sellRemaining);

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

      // Update remaining quantities
      orderQuantities.set(buyOrder.id, buyRemaining.minus(tradeQuantity));
      orderQuantities.set(sellOrder.id, sellRemaining.minus(tradeQuantity));

      if (orderQuantities.get(buyOrder.id)!.isZero()) {
        buyIndex++;
      }
      if (orderQuantities.get(sellOrder.id)!.isZero()) {
        sellIndex++;
      }
    }
    
    if (newTrades.length > 0) {
      // Settle balances for all trades
      try {
        await this.settleBalances(newTrades, clearingPrice);
      } catch (error) {
        console.error("Error settling balances:", error);
        // Still publish auction even if balance settlement fails
      }
    }

    // Add remaining orders from matched orders (only those with quantity > 0)
    [...buyOrders, ...sellOrders].forEach((o) => {
      const remainingQty = orderQuantities.get(o.id);
      if (!remainingQty) {
        return;
      }
      if (remainingQty.greaterThan(0)) {
        remainingOrders.push({ ...o, quantity: remainingQty });
      }
    });

    // Deduplicate by order ID (in case an order appears in both unmatched and matched lists)
    const orderMap = new Map<string, Order>();
    remainingOrders.forEach((order) => {
      orderMap.set(order.id, order);
    });
    const uniqueRemainingOrders = Array.from(orderMap.values());

    orderBook.updateOrders(uniqueRemainingOrders);
    console.log(`${uniqueRemainingOrders.length} orders remaining in the book.`);

    // Publish auction data
    try {
      await auctionPublisher.publish({
        id: crypto.randomUUID(),
        clearingPrice: clearingPrice,
        volume: volume,
        tradeCount: newTrades.length,
        status: newTrades.length > 0 ? 'completed' : 'no_trades',
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Error publishing auction:", error);
      // Don't fail the auction if publishing fails
    }
  }

  private async settleBalances(
    trades: Trade[],
    clearingPrice: Decimal
  ): Promise<void> {
    for (const trade of trades) {
      const buyOrder = orderBook.getOrderById(trade.buyOrderId);
      const sellOrder = orderBook.getOrderById(trade.sellOrderId);
      if (!buyOrder || !sellOrder) {
        console.error(
          `Order not found for settlement: buy=${trade.buyOrderId} sell=${trade.sellOrderId}`
        );
        continue;
      }

      const quoteAmount = trade.quantity.times(clearingPrice);
      const buyLockedAmount = trade.quantity.times(buyOrder.price);
      const sellLockedAmount = trade.quantity;

      // Always release locks for the filled portion.
      await marginGuard.releaseLock(buyOrder.userId, buyLockedAmount, Assets.QUOTE);
      await marginGuard.releaseLock(sellOrder.userId, sellLockedAmount, Assets.BASE);

      // Self-trade: keep balances unchanged, only unlock.
      if (buyOrder.userId === sellOrder.userId) {
        console.log(
          `Self-trade settled: released ${buyLockedAmount} QUOTE and ${sellLockedAmount} BASE for user ${buyOrder.userId}`
        );
        continue;
      }

      // Buyer: deduct QUOTE, credit BASE
      await ledger.log(
        buyOrder.userId,
        quoteAmount.negated(),
        LedgerTransactionType.TRADE,
        Assets.QUOTE
      );
      await ledger.log(
        buyOrder.userId,
        trade.quantity,
        LedgerTransactionType.TRADE,
        Assets.BASE
      );

      // Seller: deduct BASE, credit QUOTE
      await ledger.log(
        sellOrder.userId,
        trade.quantity.negated(),
        LedgerTransactionType.TRADE,
        Assets.BASE
      );
      await ledger.log(
        sellOrder.userId,
        quoteAmount,
        LedgerTransactionType.TRADE,
        Assets.QUOTE
      );

      console.log(
        `Settled trade ${trade.id}: ${trade.quantity} @ ${trade.price}`
      );
    }
  }
}

export const auctionEngine = new AuctionEngine();
