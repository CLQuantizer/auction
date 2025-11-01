import { contractScanner } from "../chain/contractScanner";
import type { DepositTransfer } from "../chain/contractScanner";
import { formatUnits } from "viem";

const contractAddress = process.env.VITE_PUBLIC_BASE_TOKEN_ADDRESS ||
  "0xeecbc280f257f3cb191e4b01feedb61cf42d5160";
const destinationAddress = process.env.VITE_PUBLIC_PUBLIC_KEY ||
  "0x3463defEa945Adb2938AaD6B53D45ea9f460Db9F";

// BEP20 tokens typically have 18 decimals (OpenZeppelin ERC20 default)
const TOKEN_DECIMALS = 18;

/**
 * Format token value from smallest unit to human-readable format
 */
function formatTokenAmount(value: bigint, decimals: number = TOKEN_DECIMALS): string {
  return formatUnits(value, decimals);
}

console.log("\n=== Token Transfer Watcher ===");
console.log(`Contract: ${contractAddress}`);
console.log(`Destination: ${destinationAddress}`);
console.log("WebSocket connection opening...\n");

let transferCount = 0;
const startTime = Date.now();

// Handle graceful shutdown
const shutdown = () => {
  console.log("\n\n=== Shutting down ===");
  contractScanner.stopWatching();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Watch duration: ${elapsed} seconds`);
  console.log(`Total transfers detected: ${transferCount}`);
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Start watching for transfers
contractScanner.watchBlocks((deposits: DepositTransfer[]) => {
  deposits.forEach((deposit) => {
    transferCount++;
    const timestamp = new Date().toISOString();
    const tokenAmount = formatTokenAmount(deposit.value);
    
    console.log(`\n[${timestamp}] Transfer #${transferCount} detected:`);
    console.log(`  Block: ${deposit.blockNumber}`);
    console.log(`  From: ${deposit.from}`);
    console.log(`  To: ${deposit.to}`);
    console.log(`  Value: ${tokenAmount} BASE (${deposit.value.toString()} wei)`);
    console.log(`  Tx Hash: ${deposit.hash}`);
  });
});

console.log("Watching for transfers... (Press Ctrl+C to stop)\n");

