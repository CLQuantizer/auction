import type { Auction } from "./messages/auction";

class AuctionPublisher {
  /**
   * Publishes auctions to the auction service via HTTP POST.
   * @param auction - The auction to publish.
   */
  async publish(auction: Auction): Promise<void> {
    if (auction.volume.lessThanOrEqualTo(0)) {
      console.log("Skipping auction publication due to zero or negative volume.");
      return;
    }

    const serviceUrl = process.env.AUCTION_SERVICE_URL;
    if (!serviceUrl) {
      throw new Error("AUCTION_SERVICE_URL environment variable is not set");
    }

    const baseUrl = serviceUrl.replace(/\/$/, ""); // Remove trailing slash if present
    const endpoint = `${baseUrl}/auctions`;

    console.log(`Publishing auction ${auction.id} to ${endpoint}...`);

    const body: {
      clearingPrice?: number;
      volume: number;
      tradeCount?: number;
      status?: string;
    } = {
      volume: auction.volume.toNumber(),
    };

    // Add optional fields if they exist
    if (auction.clearingPrice !== null) {
      body.clearingPrice = auction.clearingPrice.toNumber();
    }
    if (auction.tradeCount !== undefined) {
      body.tradeCount = auction.tradeCount;
    }
    if (auction.status !== undefined) {
      body.status = auction.status;
    }

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
        `Failed to publish auction: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    console.log("Auction published successfully.");
  }
}

export const auctionPublisher = new AuctionPublisher();

