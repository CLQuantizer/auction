import { describe, it, expect } from "bun:test";
import { bnbChain } from "../chain/bnb";

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

    console.log(JSON.stringify(block, null, 2));

    expect(block).toBeDefined();
    expect(block.result.hash).toBe(expectedBlock.result.hash);
    expect(block.result.parentHash).toBe(expectedBlock.result.parentHash);
  });
});
// tests\chain.test.ts:
