import { baseContractScanner } from "../chain/contractScanner";
import type { DepositTransfer } from "../chain/contractScanner";
import { formatUnits } from "viem";
import { getLatestScannedBlock, updateLatestScannedBlock } from "../data/scanner";
import { CronJob } from "cron";

const contractAddress = process.env.VITE_PUBLIC_BASE_TOKEN_ADDRESS ||
  "0xeecbc280f257f3cb191e4b01feedb61cf42d5160";
const destinationAddress = process.env.VITE_PUBLIC_PUBLIC_KEY ||
  "0x3463defEa945Adb2938AaD6B53D45ea9f460Db9F";

// BEP20 tokens typically have 18 decimals (OpenZeppelin ERC20 default)
const TOKEN_DECIMALS = 18;

// Cron schedule (default: every 15 seconds)
// Format: "*/15 * * * * *" = every 15 seconds (6-field format with seconds)
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "*/30 * * * * *";

// Maximum block range per RPC request (NodeReal limit: 50,000 blocks)
const MAX_BLOCK_RANGE = 50000;

/**
 * Format token value from smallest unit to human-readable format
 */
function formatTokenAmount(value: bigint, decimals: number = TOKEN_DECIMALS): string {
  return formatUnits(value, decimals);
}

let transferCount = 0;

/**
 * Scan for new deposits and update the scanner table
 * Handles chunking to respect RPC provider's max block range limit
 */
async function scanForTransfers() {
  try {
    const lastScannedBlock = await getLatestScannedBlock();
    const latestChainBlock = await baseContractScanner.getLatestBlockNumber();
    // Scan up to 32 blocks before latest for safety (avoid reorgs)
    const latestBlock = Math.max(0, latestChainBlock - 32);
    let currentFromBlock = lastScannedBlock + 1;

    // Skip if we're already at the latest block
    if (currentFromBlock > latestBlock) {
      return;
    }

    const totalBlocksToScan = latestBlock - currentFromBlock + 1;
    console.log(`Scanning blocks ${currentFromBlock} to ${latestBlock} (${totalBlocksToScan} blocks total)...`);

    let allDeposits: DepositTransfer[] = [];
    let scannedBlocks = 0;

    // Scan in chunks to respect the max block range limit
    while (currentFromBlock <= latestBlock) {
      const chunkToBlock = Math.min(
        currentFromBlock + MAX_BLOCK_RANGE - 1,
        latestBlock
      );
      const chunkSize = chunkToBlock - currentFromBlock + 1;

      console.log(`  Scanning chunk: blocks ${currentFromBlock} to ${chunkToBlock} (${chunkSize} blocks)...`);

      try {
        const deposits = await baseContractScanner.scanDeposits(currentFromBlock, chunkToBlock);
        allDeposits.push(...deposits);
        scannedBlocks += chunkSize;

        // Update scanner table after each chunk to save progress
        await updateLatestScannedBlock(chunkToBlock);
        console.log(`  ✓ Scanned chunk, updated to block ${chunkToBlock}`);

        // Move to next chunk
        currentFromBlock = chunkToBlock + 1;
      } catch (error: any) {
        // If we hit an error, check if it's the block range error
        if (error?.details?.includes("exceed maximum block range") || 
            error?.message?.includes("exceed maximum block range")) {
          console.error(`  Error: Block range too large. Reducing chunk size...`);
          // If chunk size is already at max, something is wrong
          if (chunkSize === MAX_BLOCK_RANGE) {
            throw new Error(`Block range ${chunkSize} exceeds provider limit. Try reducing MAX_BLOCK_RANGE.`);
          }
          // Try with a smaller chunk
          const smallerChunkToBlock = Math.min(
            currentFromBlock + Math.floor(MAX_BLOCK_RANGE / 2) - 1,
            latestBlock
          );
          const deposits = await baseContractScanner.scanDeposits(currentFromBlock, smallerChunkToBlock);
          allDeposits.push(...deposits);
          scannedBlocks += (smallerChunkToBlock - currentFromBlock + 1);
          await updateLatestScannedBlock(smallerChunkToBlock);
          currentFromBlock = smallerChunkToBlock + 1;
        } else {
          throw error;
        }
      }
    }

    // Log all found deposits
    if (allDeposits.length > 0) {
      allDeposits.forEach((deposit) => {
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
      console.log(`\nFound ${allDeposits.length} transfer(s) in ${scannedBlocks} blocks`);
    } else {
      console.log(`No new transfers found (scanned ${scannedBlocks} blocks)`);
    }

    console.log(`✓ Completed scan, updated scanner to block ${latestBlock}`);
  } catch (error) {
    console.error("Error scanning for transfers:", error);
  }
}

// Create cron job
const job = new CronJob(CRON_SCHEDULE, () => {
  scanForTransfers().catch((error) => {
    console.error("Error in scheduled scan:", error);
  });
});

// Handle graceful shutdown
const shutdown = () => {
  console.log("\n\n=== Shutting down ===");
  if (job) {
    job.stop();
  }
  console.log(`Total transfers detected: ${transferCount}`);
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Start the cron job
console.log("\n=== Token Transfer Watcher ===");
console.log(`Contract: ${contractAddress}`);
console.log(`Destination: ${destinationAddress}`);
console.log(`Cron schedule: ${CRON_SCHEDULE}`);
console.log("Starting cron job... (Press Ctrl+C to stop)\n");

// Run initial scan
scanForTransfers();

// Start the cron job
job.start();

