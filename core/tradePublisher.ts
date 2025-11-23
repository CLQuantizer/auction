import type { Trade } from "./messages/trade";

class TradePublisher {
  /**
   * Publishes trades to the auction service via HTTP POST.
   * @param trades - An array of trades to publish.
   */
  async publish(trades: Trade[]): Promise<void> {
    if (trades.length === 0) {
      return;
    }

    const serviceUrl = process.env.AUCTION_SERVICE_URL;
    if (!serviceUrl) {
      throw new Error("AUCTION_SERVICE_URL environment variable is not set");
    }

    const baseUrl = serviceUrl.replace(/\/$/, ""); // Remove trailing slash if present
    const endpoint = `${baseUrl}/trades`;

    console.log(`Publishing ${trades.length} trades to ${endpoint}...`);

    // Send each trade individually
    const results = await Promise.allSettled(
      trades.map(async (trade) => {
        const body = {
          price: trade.price.toNumber(),
          quantity: trade.quantity.toNumber(),
          total: trade.price.times(trade.quantity).toNumber(),
          // fee is optional, so we omit it
        };

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          throw new Error(
            `Failed to publish trade: ${response.status} ${response.statusText} - ${errorText}`
          );
        }

        return response;
      })
    );

    // Check for failures
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      const errors = failures.map((f) =>
        f.status === "rejected" ? f.reason : "Unknown error"
      );
      console.error(`Failed to publish ${failures.length} trades:`, errors);
      throw new Error(`Failed to publish ${failures.length} of ${trades.length} trades`);
    }

    console.log(`Successfully published ${trades.length} trades.`);
  }
}

export const tradePublisher = new TradePublisher();
