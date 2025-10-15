import type { Trade } from "./messages/trade";

class TradePublisher {
  /**
   * Publishes trades to a message queue.
   * In a real implementation, this would send trades to a service like RabbitMQ or Kafka.
   * @param trades - An array of trades to publish.
   */
  async publish(trades: Trade[]): Promise<void> {
    if (trades.length === 0) {
      return;
    }

    console.log(`Publishing ${trades.length} trades to the message queue...`);
    // Simulate an async operation
    await new Promise(resolve => setTimeout(resolve, 50));
    console.log("Trades published successfully.");
  }
}

export const tradePublisher = new TradePublisher();
