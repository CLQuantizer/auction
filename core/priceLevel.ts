import { Decimal } from "decimal.js";
import type { Order } from "./messages/order";

export class PriceLevel {
  private orders: Order[] = [];
  public totalQuantity: Decimal = new Decimal(0);

  public addOrder(order: Order) {
    this.orders.push(order);
    this.totalQuantity = this.totalQuantity.plus(order.quantity);
  }

  public removeOrder(orderId: string): Order | null {
    const index = this.orders.findIndex((o) => o.id === orderId);
    if (index === -1) {
      return null;
    }

    const [removedOrder] = this.orders.splice(index, 1);
    if (removedOrder) {
      this.totalQuantity = this.totalQuantity.minus(removedOrder.quantity);
    }
    return removedOrder ?? null;
  }
  
  public getOrders(): Readonly<Order[]> {
    return this.orders;
  }
  
  public get isEmpty(): boolean {
    return this.orders.length === 0;
  }
}
