import { Decimal } from "decimal.js";
import { type Order, OrderSide } from "./messages/order";
import { SortedMap } from "./primitives/sortedMap";
import { PriceLevel } from "./primitives/priceLevel";

export interface AuctionResult {
  clearingPrice: Decimal | null;
  volume: Decimal;
}

class OrderBook {
  private bids: SortedMap<Decimal, PriceLevel>;
  private asks: SortedMap<Decimal, PriceLevel>;
  private orderMap: Map<string, Order> = new Map();

  constructor() {
    this.bids = new SortedMap<Decimal, PriceLevel>(
      (d) => d.toString(),
      (a, b) => b.comparedTo(a) // Highest price first
    );
    this.asks = new SortedMap<Decimal, PriceLevel>(
      (d) => d.toString(),
      (a, b) => a.comparedTo(b) // Lowest price first
    );
  }

  placeOrder(orderData: Omit<Order, "id" | "timestamp">): Order {
    const newOrder: Order = {
      ...orderData,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    const map = newOrder.side === OrderSide.BUY ? this.bids : this.asks;
    let collection = map.get(newOrder.price);
    if (!collection) {
      collection = new PriceLevel();
      map.set(newOrder.price, collection);
    }
    collection.addOrder(newOrder);
    this.orderMap.set(newOrder.id, newOrder);

    return newOrder;
  }

  cancelOrder(orderId: string, userId: string): Order | null {
    const order = this.orderMap.get(orderId);
    if (!order || order.userId !== userId) {
      return null;
    }

    const { side, price } = order;
    const map = side === OrderSide.BUY ? this.bids : this.asks;
    const priceLevel = map.get(price);
    if (!priceLevel) {
      console.error(
        `Order book inconsistency: Order ${orderId} found, but no price level at ${price.toString()}`
      );
      return null;
    }

    const removedOrder = priceLevel.removeOrder(orderId);
    if (removedOrder) {
      this.orderMap.delete(orderId);
      if (priceLevel.isEmpty) {
        map.delete(price);
      }
    }

    return removedOrder;
  }

  getOrders(): Order[] {
    const buys = this.getBuyOrders();
    const sells = this.getSellOrders();
    return [...buys, ...sells];
  }

  getBuyOrders(): Readonly<Order[]> {
    return this.bids.values().flatMap((c) => c.getOrders());
  }

  getSellOrders(): Readonly<Order[]> {
    return this.asks.values().flatMap((c) => c.getOrders());
  }

  getOrderById(orderId: string): Order | undefined {
    return this.orderMap.get(orderId);
  }

  updateOrders(orders: Order[]) {
    this.clear();
    for (const order of orders) {
      // Preserve original order ID and timestamp
      const map = order.side === OrderSide.BUY ? this.bids : this.asks;
      let collection = map.get(order.price);
      if (!collection) {
        collection = new PriceLevel();
        map.set(order.price, collection);
      }
      collection.addOrder(order);
      this.orderMap.set(order.id, order);
    }
  }

  clear() {
    this.bids.clear();
    this.asks.clear();
    this.orderMap.clear();
  }

  findClearingPrice(): AuctionResult {
    const buyOrders = this.getBuyOrders();
    const sellOrders = this.getSellOrders();

    if (buyOrders.length === 0 || sellOrders.length === 0) {
      return { clearingPrice: null, volume: new Decimal(0) };
    }

    // Check if there is a cross
    if (buyOrders[0]!.price.lessThan(sellOrders[0]!.price)) {
      return { clearingPrice: null, volume: new Decimal(0) };
    }

    const prices = [
      ...new Set([
        ...buyOrders.map((o) => o.price),
        ...sellOrders.map((o) => o.price),
      ]),
    ].sort((a, b) => b.comparedTo(a));

    let clearingPrice: Decimal | null = null;
    let maxVolume = new Decimal(0);

    for (const price of prices) {
      const demand = buyOrders
        .filter((o) => o.price.greaterThanOrEqualTo(price))
        .reduce((sum, o) => sum.plus(o.quantity), new Decimal(0));
      const supply = sellOrders
        .filter((o) => o.price.lessThanOrEqualTo(price))
        .reduce((sum, o) => sum.plus(o.quantity), new Decimal(0));

      const volume = Decimal.min(demand, supply);

      if (volume.greaterThan(maxVolume)) {
        maxVolume = volume;
        clearingPrice = price;
      }
    }

    return { clearingPrice, volume: maxVolume };
  }
}

export const orderBook = new OrderBook();
