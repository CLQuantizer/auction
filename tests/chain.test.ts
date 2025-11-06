import { describe, it, expect } from "bun:test";
import { bnbChain, BnbChain } from "../chain/bnb";

const expectedBlock = {
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
      "hash": "0xaca533a947b6a4d6f5f34735aaf5d8fdec8a6e356ed83209994ad34674247410",
      "parentHash": "0x97d4c7d13b41b4cc3453c30e5a61a3ec44d67bf8d9dc44853153823e7436e29d"
    }
  }

describe("BnbChain", () => {
  it("should get block 1000 and print it", async () => {
    const blockNumber = 1000;
    const block = (await bnbChain.getBlockByNumber(blockNumber)) as typeof expectedBlock;
    expect(block).toBeDefined();
    expect(block.result.hash).toBe(expectedBlock.result.hash);
    expect(block.result.parentHash).toBe(expectedBlock.result.parentHash);
  });

  it("should get balance for a given address on testnet", async () => {
    const rpcUrl = process.env.NODEREAL_RPC_URL;
    if (!rpcUrl) {
      throw new Error("NODEREAL_RPC_URL is not set. Please add it to your environment variables.");
    }

    const bnbTestnetChain = new BnbChain(rpcUrl);
    const publicKey = "0x3463defEa945Adb2938AaD6B53D45ea9f460Db9F";
    const balance = await bnbTestnetChain.getBalance(publicKey);

    console.log(`Balance for ${publicKey}: ${balance} tBNB`);

    expect(balance).toBeGreaterThan(0.1);
  });
});
