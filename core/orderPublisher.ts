import type { Order } from "./messages/order";

class OrderPublisher {
  async publish(order: Order): Promise<void> {
    const serviceUrl = process.env.AUCTION_SERVICE_URL;
    if (!serviceUrl) {
        console.error("AUCTION_SERVICE_URL environment variable is not set, skipping order publish");
        return;
    }

    const baseUrl = serviceUrl.replace(/\/$/, "");
    const endpoint = `${baseUrl}/orders`;

    console.log(`Publishing order ${order.id} to ${endpoint}...`);

    const body = {
        originalId: order.id,
        userId: order.userId,
        side: order.side,
        price: order.price.toNumber(),
        quantity: order.quantity.toNumber(),
        remainingQuantity: order.quantity.toNumber(), // Initial remaining quantity is full quantity
        status: 'open',
        timestamp: Date.now()
    };

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => "Unknown error");
            console.error(`Failed to publish order: ${response.status} ${response.statusText} - ${errorText}`);
        } else {
            console.log("Order published successfully.");
        }
    } catch (error) {
        console.error("Error publishing order:", error);
    }
  }
}

export const orderPublisher = new OrderPublisher();

