import { Hono } from "hono";
import { orderBook } from "../core/orderbook";
import { toDecimal } from "../core/constants";
import { OrderSide } from "../core/messages/order";

export const orderRoutes = new Hono();

orderRoutes.get("/orders", (c) => {
  const orders = orderBook.getOrders().map((order) => ({
    ...order,
    price: order.price.toString(),
    quantity: order.quantity.toString(),
  }));
  return c.json(orders);
});

orderRoutes.post("/v1/orders/place", async (c) => {
  try {
    const body = (await c.req.json()) as {
      userId: string;
      side: OrderSide;
      price: string | number;
      quantity: string | number;
    };

    if (!body.userId || !body.side || !body.price || !body.quantity) {
      return c.text("Missing required fields", 400);
    }
    if (body.side !== OrderSide.BUY && body.side !== OrderSide.SELL) {
      return c.text("Invalid order side", 400);
    }

    const order = orderBook.placeOrder({
      userId: body.userId,
      side: body.side,
      price: toDecimal(body.price),
      quantity: toDecimal(body.quantity),
    });

    const orderWithStringDecimals = {
      ...order,
      price: order.price.toString(),
      quantity: order.quantity.toString(),
    };

    return c.json(orderWithStringDecimals, 201);
  } catch (e) {
    return c.text("Invalid JSON", 400);
  }
});

orderRoutes.post("/v1/orders/cancel", async (c) => {
  try {
    const body = (await c.req.json()) as { orderId: string; userId: string };

    if (!body.orderId || !body.userId) {
      return c.text("Missing orderId or userId", 400);
    }

    const success = orderBook.cancelOrder(body.orderId, body.userId);

    if (success) {
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
