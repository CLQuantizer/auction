import { Decimal } from "decimal.js";
import { AUCTION_INTERVAL_SECONDS } from "./primitives/constants";
import { type Order, OrderSide } from "./messages/order";
import type { Trade } from "./messages/trade";
import { orderBook } from "./orderbook";
import { tradePublisher } from "./tradePublisher";
import { marginGuard } from "./marginGuard";
import { ledger } from "../data/ledger";
import { LedgerTransactionType } from "../data/ledgerTypes";

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

  public async runAuction() {
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
      // Settle balances for all trades
      await this.settleBalances(newTrades, clearingPrice);
      
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
      // Calculate locked amount based on original order price (what was locked)
      const lockedAmount = filledQty.times(order.price);

      if (order.side === OrderSide.BUY) {
        // Buyer: Release locked QUOTE, deduct QUOTE, credit BASE
        // Release the locked QUOTE for the filled portion (based on original order price)
        await marginGuard.releaseLock(order.userId, lockedAmount);
        // Deduct QUOTE at clearing price (what was actually paid)
        await ledger.log(
          order.userId,
          quoteAmount.negated(),
          LedgerTransactionType.TRADE
        );
        // Credit BASE (received in exchange)
        // Note: BASE balance would need separate tracking - for now we log it
        // In a full implementation, you'd have separate balance tables or a token field
        await ledger.log(
          order.userId,
          filledQty,
          LedgerTransactionType.TRADE
        );
        console.log(
          `Settled BUY order ${orderId}: Released ${lockedAmount} QUOTE, deducted ${quoteAmount} QUOTE, credited ${filledQty} BASE`
        );
      } else {
        // Seller: Release locked QUOTE (based on current order placement logic), deduct BASE, credit QUOTE
        // Note: Current order placement locks QUOTE for SELL orders, which seems incorrect
        // For now, we'll release QUOTE (following current locking behavior)
        // In a proper implementation, SELL orders should lock BASE (quantity)
        await marginGuard.releaseLock(order.userId, lockedAmount);
        // Deduct BASE (sold)
        // Note: BASE deduction would need separate tracking
        await ledger.log(
          order.userId,
          filledQty.negated(),
          LedgerTransactionType.TRADE
        );
        // Credit QUOTE (received in exchange at clearing price)
        await ledger.log(
          order.userId,
          quoteAmount,
          LedgerTransactionType.TRADE
        );
        console.log(
          `Settled SELL order ${orderId}: Released ${lockedAmount} QUOTE, deducted ${filledQty} BASE, credited ${quoteAmount} QUOTE`
        );
      }
    }
  }
}

export const auctionEngine = new AuctionEngine();
