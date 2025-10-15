import { type Order, OrderSide } from "./messages/order";

class OrderBook {
  private buyOrders: Order[] = [];
  private sellOrders: Order[] = [];

  private insertOrder(orders: Order[], order: Order, descending: boolean) {
    // This can be optimized with binary search for insertion
    orders.push(order);
    if (descending) {
      orders.sort(
        (a, b) => b.price.comparedTo(a.price) || a.timestamp - b.timestamp
      );
    } else {
      orders.sort(
        (a, b) => a.price.comparedTo(b.price) || a.timestamp - b.timestamp
      );
    }
  }

  addOrder(orderData: Omit<Order, "id" | "timestamp">): Order {
    const newOrder: Order = {
      ...orderData,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    if (newOrder.side === OrderSide.BUY) {
      this.insertOrder(this.buyOrders, newOrder, true);
    } else {
      this.insertOrder(this.sellOrders, newOrder, false);
    }
    return newOrder;
  }

  getOrders(): Order[] {
    return [...this.buyOrders, ...this.sellOrders];
  }

  getBuyOrders(): Readonly<Order[]> {
    return this.buyOrders;
  }

  getSellOrders(): Readonly<Order[]> {
    return this.sellOrders;
  }

  updateOrders(orders: Order[]) {
    this.clear();
    for (const o of orders) {
      if (o.side === OrderSide.BUY) {
        this.insertOrder(this.buyOrders, o, true);
      } else {
        this.insertOrder(this.sellOrders, o, false);
      }
    }
  }

  clear() {
    this.buyOrders = [];
    this.sellOrders = [];
  }
}

export const orderBook = new OrderBook();
