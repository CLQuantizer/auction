import { test, expect, beforeEach } from "bun:test";
import { orderBook } from "./core/orderbook";
import { findClearingPrice } from "./core/pricing";
import { OrderSide } from "./core/messages/order";
import { toDecimal } from "./core/constants";
import { Decimal } from "decimal.js";

beforeEach(() => {
  orderBook.clear();
});

test("auction should find a clearing price when orders cross", () => {
  // Arrange
  orderBook.addOrder({ userId: 'user1', side: OrderSide.BUY, price: toDecimal(105), quantity: toDecimal(10) });
  orderBook.addOrder({ userId: 'user2', side: OrderSide.BUY, price: toDecimal(102), quantity: toDecimal(5) });
  orderBook.addOrder({ userId: 'user3', side: OrderSide.SELL, price: toDecimal(100), quantity: toDecimal(8) });
  orderBook.addOrder({ userId: 'user4', side: OrderSide.SELL, price: toDecimal(101), quantity: toDecimal(12) });

  // Act
  const { clearingPrice, volume } = findClearingPrice(orderBook.getOrders());

  // Assert
  expect(clearingPrice).not.toBeNull();
  expect(clearingPrice!.equals(new Decimal(102))).toBe(true);
  expect(volume.equals(new Decimal(15))).toBe(true);
});

test("auction should not find a clearing price when orders do not cross", () => {
  // Arrange
  orderBook.addOrder({ userId: 'user1', side: OrderSide.BUY, price: toDecimal(100), quantity: toDecimal(10) });
  orderBook.addOrder({ userId: 'user2', side: OrderSide.BUY, price: toDecimal(101), quantity: toDecimal(5) });
  orderBook.addOrder({ userId: 'user3', side: OrderSide.SELL, price: toDecimal(102), quantity: toDecimal(8) });
  orderBook.addOrder({ userId: 'user4', side: OrderSide.SELL, price: toDecimal(103), quantity: toDecimal(12) });

  // Act
  const { clearingPrice, volume } = findClearingPrice(orderBook.getOrders());

  // Assert
  expect(clearingPrice).toBeNull();
  expect(volume.isZero()).toBe(true);
});
