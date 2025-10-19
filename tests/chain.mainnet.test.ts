import { describe, it, expect } from "bun:test";
import { bnbChain } from "../chain/bnb";

describe("BnbChain Mainnet", () => {
  it("should get BEP20 token balance for a given address on mainnet", async () => {
    const tokenAddress = "0xb16b7c1e51f05b697698ba069db7e0f74fbb4444";
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
