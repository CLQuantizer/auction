import { test, expect, beforeEach } from "bun:test";
import { auctionEngine } from "./core/auction";
import { orderBook } from "./core/orderbook";
import { OrderSide } from "./core/messages/order";
import { toDecimal } from "./core/constants";
import { Decimal } from "decimal.js";

beforeEach(() => {
  orderBook.clear();
});

test("auction should find a clearing price when orders cross", () => {
  // Arrange
  orderBook.placeOrder({ userId: 'user1', side: OrderSide.BUY, price: toDecimal(105), quantity: toDecimal(10) });
  orderBook.placeOrder({ userId: 'user2', side: OrderSide.BUY, price: toDecimal(102), quantity: toDecimal(5) });
  orderBook.placeOrder({ userId: 'user3', side: OrderSide.SELL, price: toDecimal(100), quantity: toDecimal(8) });
  orderBook.placeOrder({ userId: 'user4', side: OrderSide.SELL, price: toDecimal(101), quantity: toDecimal(12) });

  // Act
  const { clearingPrice, volume } = orderBook.findClearingPrice();

  // Assert
  expect(clearingPrice).not.toBeNull();
  expect(clearingPrice!.equals(new Decimal(102))).toBe(true);
  expect(volume.equals(new Decimal(15))).toBe(true);
});

test("auction should not find a clearing price when orders do not cross", () => {
  // Arrange
  orderBook.placeOrder({ userId: 'user1', side: OrderSide.BUY, price: toDecimal(100), quantity: toDecimal(10) });
  orderBook.placeOrder({ userId: 'user2', side: OrderSide.BUY, price: toDecimal(101), quantity: toDecimal(5) });
  orderBook.placeOrder({ userId: 'user3', side: OrderSide.SELL, price: toDecimal(102), quantity: toDecimal(8) });
  orderBook.placeOrder({ userId: 'user4', side: OrderSide.SELL, price: toDecimal(103), quantity: toDecimal(12) });

  // Act
  const { clearingPrice, volume } = orderBook.findClearingPrice();

  // Assert
  expect(clearingPrice).toBeNull();
  expect(volume.isZero()).toBe(true);
});

test("auction should correctly handle remaining and partially filled orders", () => {
  // Arrange
  // Total Buy: 15 @ >=102
  // Total Sell: 20 @ <=102
  // Expected Clearing Price: 102, Volume: 15
  orderBook.placeOrder({
    userId: "user1",
    side: OrderSide.BUY,
    price: toDecimal(105), // Fully matched
    quantity: toDecimal(10),
  });
  orderBook.placeOrder({
    userId: "user2",
    side: OrderSide.BUY,
    price: toDecimal(102), // Fully matched
    quantity: toDecimal(5),
  });
  orderBook.placeOrder({
    userId: "user3",
    side: OrderSide.BUY,
    price: toDecimal(100), // Unmatched (price too low)
    quantity: toDecimal(5),
  });

  orderBook.placeOrder({
    userId: "user4",
    side: OrderSide.SELL,
    price: toDecimal(100), // Fully matched
    quantity: toDecimal(8),
  });
  orderBook.placeOrder({
    userId: "user5",
    side: OrderSide.SELL,
    price: toDecimal(101), // Partially matched (7 of 12)
    quantity: toDecimal(12),
  });
  orderBook.placeOrder({
    userId: "user6",
    side: OrderSide.SELL,
    price: toDecimal(104), // Unmatched (price too high)
    quantity: toDecimal(10),
  });

  // Act
  auctionEngine.runAuction();

  // Assert
  const remainingBuyOrders = orderBook.getBuyOrders();
  const remainingSellOrders = orderBook.getSellOrders();

  // Unmatched buy order should remain
  expect(remainingBuyOrders.length).toBe(1);
  expect(remainingBuyOrders[0]!.price.equals(new Decimal(100))).toBe(true);
  expect(remainingBuyOrders[0]!.quantity.equals(new Decimal(5))).toBe(true);

  // Partially matched and unmatched sell orders should remain
  expect(remainingSellOrders.length).toBe(2);

  // Unmatched sell order
  const unmatchedSell = remainingSellOrders.find((o) =>
    o.price.equals(new Decimal(104))
  )!;
  expect(unmatchedSell).not.toBeUndefined();
  expect(unmatchedSell.quantity.equals(new Decimal(10))).toBe(true);

  // Partially matched sell order
  const partialSell = remainingSellOrders.find((o) =>
    o.price.equals(new Decimal(101))
  )!;
  expect(partialSell).not.toBeUndefined();
  expect(partialSell.quantity.equals(new Decimal(5))).toBe(true); // 12 - 7 = 5
});

test("should cancel an existing order", () => {
  // Arrange
  const order = orderBook.placeOrder({
    userId: "user1",
    side: OrderSide.BUY,
    price: toDecimal(100),
    quantity: toDecimal(10),
  });
  expect(orderBook.getBuyOrders().length).toBe(1);

  // Act
  const wasCancelled = orderBook.cancelOrder(order.id, order.side, order.price);

  // Assert
  expect(wasCancelled).toBe(true);
  expect(orderBook.getBuyOrders().length).toBe(0);
});
