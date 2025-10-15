import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { orderBook } from "../core/orderbook";
import { toDecimal } from "../core/primitives/constants";
import { OrderSide } from "../core/messages/order";
import { marginGuard } from "../core/marginGuard";
import { Decimal } from "decimal.js";

type OrderPlacementEnv = {
  Variables: {
    orderPayload: {
      userId: string;
      side: OrderSide;
      price: Decimal;
      quantity: Decimal;
    };
    lockAmount: Decimal;
  };
};

export const orderRoutes = new Hono<OrderPlacementEnv>();

const marginLockMiddleware = createMiddleware<OrderPlacementEnv>(
  async (c, next) => {
    let body: any;
    try {
      body = (await c.req.json()) as {
        userId: string;
        side: OrderSide;
        price: string | number;
        quantity: string | number;
      };
    } catch (e) {
      return c.text("Invalid JSON", 400);
    }

    if (!body.userId || !body.side || !body.price || !body.quantity) {
      return c.text("Missing required fields", 400);
    }
    if (body.side !== OrderSide.BUY && body.side !== OrderSide.SELL) {
      return c.text("Invalid order side", 400);
    }

    const price = toDecimal(body.price);
    const quantity = toDecimal(body.quantity);
    const lockAmount = price.times(quantity);

    const locked = await marginGuard.tryLock(body.userId, lockAmount);
    if (!locked) {
      return c.text("Insufficient balance", 400);
    }

    c.set("orderPayload", {
      userId: body.userId,
      side: body.side,
      price,
      quantity,
    });
    c.set("lockAmount", lockAmount);

    try {
      await next();
    } catch (e) {
      const { userId } = c.get("orderPayload");
      const amountToRelease = c.get("lockAmount");
      await marginGuard.releaseLock(userId, amountToRelease);
      console.error("Failed to place order, releasing lock:", e);
      return c.text("Failed to place order", 500);
    }
  }
);

orderRoutes.get("/orders", (c) => {
  const orders = orderBook.getOrders().map((order) => ({
    ...order,
    price: order.price.toString(),
    quantity: order.quantity.toString(),
  }));
  return c.json(orders);
});

orderRoutes.post("/v1/orders/place", marginLockMiddleware, async (c) => {
  const payload = c.get("orderPayload");

  const order = orderBook.placeOrder(payload);

  const orderWithStringDecimals = {
    ...order,
    price: order.price.toString(),
    quantity: order.quantity.toString(),
  };

  return c.json(orderWithStringDecimals, 201);
});

orderRoutes.post("/v1/orders/cancel", async (c) => {
  try {
    const body = (await c.req.json()) as { orderId: string; userId: string };

    if (!body.orderId || !body.userId) {
      return c.text("Missing orderId or userId", 400);
    }

    const canceledOrder = orderBook.cancelOrder(body.orderId, body.userId);

    if (canceledOrder) {
      const releaseAmount = canceledOrder.price.times(canceledOrder.quantity);
      await marginGuard.releaseLock(body.userId, releaseAmount);
      return c.json({ success: true, orderId: body.orderId });
    } else {
      return c.text(
        "Order not found or user does not have permission to cancel",
        404
      );
    }
  } catch (e) {
    return c.text("Invalid JSON", 400);
  }
});
