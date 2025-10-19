import { describe, it, expect } from "bun:test";
import { bnbChain } from "../chain/bnb";

describe("BnbChain Mainnet", () => {
  it("should get BEP20 token balance for a given address on mainnet", async () => {
    const tokenAddress = "0x690dffd8b28e614f2a582c1fedaf9ee316f8c93f";
    const walletAddress = process.env.PUBLIC_KEY;

    if (!walletAddress) {
      throw new Error("PUBLIC_KEY is not set");
    }
    const balance = await bnbChain.getBep20TokenBalance(tokenAddress, walletAddress);

    console.log(`Token balance for ${walletAddress}: ${balance}`);

    expect(typeof balance).toBe('bigint');
    expect(balance).toBeGreaterThan(0);
  });
});
