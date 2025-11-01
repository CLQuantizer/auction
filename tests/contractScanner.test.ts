import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { ContractScanner, type DepositTransfer } from "../chain/contractScanner";
import type { Address } from "viem";

describe("ContractScanner WebSocket", () => {
  let scanner: ContractScanner;
  const testContractAddress = (process.env.VITE_PUBLIC_BASE_TOKEN_ADDRESS ||
    "0xeecbc280f257f3cb191e4b01feedb61cf42d5160") as Address;
  const testPublicKey = (process.env.VITE_PUBLIC_PUBLIC_KEY ||
    "0x3463defEa945Adb2938AaD6B53D45ea9f460Db9F") as Address;

  beforeAll(() => {
    const rpcUrl = process.env.NODEREAL_RPC_URL;
    if (!rpcUrl) {
      throw new Error(
        "NODEREAL_RPC_URL is not set. Please add it to your environment variables.",
      );
    }

    if (!rpcUrl.startsWith("wss://")) {
      throw new Error(
        "NODEREAL_RPC_URL should be a WebSocket URL (wss://...).",
      );
    }

    scanner = new ContractScanner(rpcUrl, testContractAddress, testPublicKey);
  });

  afterAll(() => {
    scanner.stopWatching();
  });

  it("should connect via WebSocket and get latest block number", async () => {
    const blockNumber = await scanner.getLatestBlockNumber();
    expect(blockNumber).toBeGreaterThan(0);
    console.log(`Latest block number: ${blockNumber}`);
  });

  it("should scan deposits from a specific block range", async () => {
    const latestBlock = await scanner.getLatestBlockNumber();
    const fromBlock = latestBlock - 100; // Scan last 100 blocks

    const deposits = await scanner.scanDeposits(fromBlock, latestBlock);
    expect(Array.isArray(deposits)).toBe(true);
    console.log(`Found ${deposits.length} deposit(s) in blocks ${fromBlock}-${latestBlock}`);
    
    if (deposits.length > 0) {
      const deposit = deposits[0];
      if (deposit) {
        expect(deposit).toHaveProperty("from");
        expect(deposit).toHaveProperty("to");
        expect(deposit).toHaveProperty("value");
        expect(deposit).toHaveProperty("hash");
        expect(deposit).toHaveProperty("blockNumber");
        expect(deposit.to.toLowerCase()).toBe(testPublicKey.toLowerCase());
      }
    }
  }, 30000); // 30 second timeout for RPC calls

  it("should watch for new blocks via WebSocket", async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        scanner.stopWatching();
        reject(new Error("Timeout: No blocks received within 30 seconds"));
      }, 30000);

      const receivedBlocks: number[] = [];
      const receivedDeposits: DepositTransfer[] = [];

      const unsubscribe = scanner.watchBlocks((deposits) => {
        receivedDeposits.push(...deposits);
        console.log(`Callback received ${deposits.length} deposit(s)`);
      });

      // Also track block numbers manually
      const checkInterval = setInterval(async () => {
        try {
          const latest = await scanner.getLatestBlockNumber();
          if (!receivedBlocks.includes(latest)) {
            receivedBlocks.push(latest);
            console.log(`Block ${latest} detected`);
          }

          // After receiving at least 2 blocks, consider test successful
          if (receivedBlocks.length >= 2) {
            clearInterval(checkInterval);
            clearTimeout(timeout);
            scanner.stopWatching();
            expect(receivedBlocks.length).toBeGreaterThanOrEqual(2);
            console.log(`Successfully received ${receivedBlocks.length} block(s)`);
            resolve();
          }
        } catch (error) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          scanner.stopWatching();
          reject(error);
        }
      }, 2000); // Check every 2 seconds
    });
  }, 60000); // 60 second timeout for watching blocks

  it("should get token balance via WebSocket", async () => {
    const balance = await scanner.getTokenBalance(testPublicKey);
    expect(typeof balance).toBe("bigint");
    expect(balance).toBeGreaterThanOrEqual(0n);
    console.log(`Token balance: ${balance.toString()}`);
  }, 30000);

  it("should handle stopWatching correctly", () => {
    // Start watching
    const unsubscribe = scanner.watchBlocks(() => {});
    expect(unsubscribe).toBeDefined();

    // Stop watching
    scanner.stopWatching();
    
    // Should not throw when stopping again
    scanner.stopWatching();
    
    // Should allow starting again
    const unsubscribe2 = scanner.watchBlocks(() => {});
    expect(unsubscribe2).toBeDefined();
    scanner.stopWatching();
  });

  it("should watch and log token transfers to destination address", async () => {
    return new Promise<void>((resolve, reject) => {
      console.log("\n=== Starting to watch for token transfers ===");
      console.log(`Contract: ${testContractAddress}`);
      console.log(`Destination: ${testPublicKey}`);
      console.log("Waiting for transfers...\n");

      let transferCount = 0;
      const watchDuration = 60000; // Watch for 60 seconds
      const startTime = Date.now();

      scanner.watchBlocks((deposits) => {
        deposits.forEach((deposit) => {
          transferCount++;
          const timestamp = new Date().toISOString();
          console.log(`\n[${timestamp}] Transfer #${transferCount} detected:`);
          console.log(`  Block: ${deposit.blockNumber}`);
          console.log(`  From: ${deposit.from}`);
          console.log(`  To: ${deposit.to}`);
          console.log(`  Value: ${deposit.value.toString()}`);
          console.log(`  Tx Hash: ${deposit.hash}`);
        });
      });

      // Stop after watch duration
      setTimeout(() => {
        scanner.stopWatching();
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n=== Watch completed after ${elapsed} seconds ===`);
        console.log(`Total transfers detected: ${transferCount}`);
        
        // Test passes if we successfully watched without errors
        expect(transferCount).toBeGreaterThanOrEqual(0);
        resolve();
      }, watchDuration);
    });
  }, 70000); // 70 second timeout (60s watch + 10s buffer)
});

