import { Decimal } from "decimal.js";
import { AUCTION_INTERVAL_SECONDS } from "./primitives/constants";
import { type Order, OrderSide } from "./messages/order";
import type { Trade } from "./messages/trade";
import { orderBook } from "./orderbook";
import { tradePublisher } from "./tradePublisher";
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
      // Settle balances for all trades
      try {
        await this.settleBalances(newTrades, clearingPrice);
      } catch (error) {
        console.error("Error settling balances:", error);
        // Still publish auction even if balance settlement fails
      }
      
      tradePublisher.publish(newTrades);
    }

    [...buyOrders, ...sellOrders].forEach((o) => {
      if (o.quantity.greaterThan(0)) {
        remainingOrders.push(o);
      }
    });

    orderBook.updateOrders(remainingOrders);
    console.log(`${remainingOrders.length} orders remaining in the book.`);

    // Publish auction data
    await auctionPublisher.publish({
      id: crypto.randomUUID(),
      clearingPrice: clearingPrice,
      volume: volume,
      tradeCount: newTrades.length,
      status: newTrades.length > 0 ? 'completed' : 'no_trades',
      timestamp: Date.now(),
    });
  }

  private async settleBalances(
    trades: Trade[],
    clearingPrice: Decimal
  ): Promise<void> {
    // Group trades by order to calculate total filled per order
    const orderFills = new Map<string, Decimal>();
    
    for (const trade of trades) {
      const buyFilled = orderFills.get(trade.buyOrderId) || new Decimal(0);
      const sellFilled = orderFills.get(trade.sellOrderId) || new Decimal(0);
      orderFills.set(trade.buyOrderId, buyFilled.plus(trade.quantity));
      orderFills.set(trade.sellOrderId, sellFilled.plus(trade.quantity));
    }

    // Process each order that was filled
    for (const [orderId, filledQty] of orderFills.entries()) {
      const order = orderBook.getOrderById(orderId);
      if (!order) {
        console.error(`Order ${orderId} not found for settlement`);
        continue;
      }

      // Use clearing price (from trade) to calculate quote amount
      const quoteAmount = filledQty.times(clearingPrice);
      
      // Calculate locked amount based on order side
      // BUY orders lock QUOTE value, SELL orders lock BASE quantity
      const lockedAmount = order.side === OrderSide.BUY
        ? filledQty.times(order.price)  // BUY: locked QUOTE value
        : filledQty;                       // SELL: locked BASE quantity

      if (order.side === OrderSide.BUY) {
        // Buyer: Release locked QUOTE, deduct QUOTE, credit BASE
        // Release the locked QUOTE for the filled portion (based on original order price)
        await marginGuard.releaseLock(order.userId, lockedAmount, Assets.QUOTE);
        // Deduct QUOTE at clearing price (what was actually paid)
        await ledger.log(
          order.userId,
          quoteAmount.negated(),
          LedgerTransactionType.TRADE,
          Assets.QUOTE
        );
        // Credit BASE (received in exchange)
        await ledger.log(
          order.userId,
          filledQty,
          LedgerTransactionType.TRADE,
          Assets.BASE
        );
        console.log(
          `Settled BUY order ${orderId}: Released ${lockedAmount} QUOTE, deducted ${quoteAmount} QUOTE, credited ${filledQty} BASE`
        );
      } else {
        // Seller: Release locked BASE, deduct BASE, credit QUOTE
        await marginGuard.releaseLock(order.userId, lockedAmount, Assets.BASE);
        // Deduct BASE (sold)
        await ledger.log(
          order.userId,
          filledQty.negated(),
          LedgerTransactionType.TRADE,
          Assets.BASE
        );
        // Credit QUOTE (received in exchange at clearing price)
        await ledger.log(
          order.userId,
          quoteAmount,
          LedgerTransactionType.TRADE,
          Assets.QUOTE
        );
        console.log(
          `Settled SELL order ${orderId}: Released ${lockedAmount} BASE, deducted ${filledQty} BASE, credited ${quoteAmount} QUOTE`
        );
      }
    }
  }
}

export const auctionEngine = new AuctionEngine();
