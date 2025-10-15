import { Decimal } from "decimal.js";
import { type Order, OrderSide } from "./messages/order";

export interface AuctionResult {
  clearingPrice: Decimal | null;
  volume: Decimal;
}

export function findClearingPrice(orders: Order[]): AuctionResult {
  const buyOrders = orders
    .filter((o) => o.side === OrderSide.BUY)
    .sort((a, b) => b.price.comparedTo(a.price));
  const sellOrders = orders
    .filter((o) => o.side === OrderSide.SELL)
    .sort((a, b) => a.price.comparedTo(b.price));

  if (buyOrders.length === 0 || sellOrders.length === 0) {
    return { clearingPrice: null, volume: new Decimal(0) };
  }

  // Check if there is a cross
  if (buyOrders[0]!.price.lessThan(sellOrders[0]!.price)) {
    return { clearingPrice: null, volume: new Decimal(0) };
  }

  const prices = [...new Set(orders.map((o) => o.price))].sort((a, b) =>
    b.comparedTo(a)
  );

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
