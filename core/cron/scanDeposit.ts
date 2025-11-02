import { creditDeposit } from "./credit";
import { createDeposit } from "../../data/deposit";
import { Decimal } from "decimal.js";
import { contractScanner, type DepositTransfer } from "../../chain/contractScanner";
import { CronJob } from "cron";
import {
  getLatestScannedBlock,
  updateLatestScannedBlock,
} from "../../data/scanner";

// Maximum block range per RPC request (NodeReal limit: 50,000 blocks)
const MAX_BLOCK_RANGE = 50000;

const processTransaction = async (deposit: DepositTransfer) => {
  const from = deposit.from.toLowerCase();
  const to = deposit.to.toLowerCase();
  const publicKey = process.env.VITE_PUBLIC_PUBLIC_KEY?.toLowerCase() || 
    process.env.PUBLIC_KEY?.toLowerCase();

  if (!publicKey) {
    console.error("PUBLIC_KEY or VITE_PUBLIC_PUBLIC_KEY not set");
    return;
  }

  if (to === publicKey && deposit.from && deposit.to && deposit.value) {
    const valueString = deposit.value.toString();
    console.log(`Deposit detected: ${valueString} from ${from} in block ${deposit.blockNumber}`);
    
    await createDeposit({
      blockNumber: deposit.blockNumber,
      from: from,
      to: to,
      value: valueString,
      hash: deposit.hash,
    });
    
    const amount = new Decimal(valueString).div(new Decimal(1e18));
    console.log(
      `Crediting ${amount.toString()} to ${from} in 15 seconds...`,
    );
    setTimeout(() => {
      creditDeposit(from, amount, deposit.hash).catch(console.error);
    }, 15000);
  }
};

export const scanDeposits = async () => {
  console.log("Scanning for deposits...");
  try {
    const lastScannedBlock = await getLatestScannedBlock();
    const latestChainBlock = await contractScanner.getLatestBlockNumber();
    // Scan up to 32 blocks before latest for safety (avoid reorgs)
    const latestBlock = Math.max(0, latestChainBlock - 32);
    let currentFromBlock = lastScannedBlock + 1;

    // Skip if we're already at the latest block
    if (currentFromBlock > latestBlock) {
      console.log("No new blocks to process.");
      return;
    }

    const totalBlocksToScan = latestBlock - currentFromBlock + 1;
    console.log(`Scanning blocks ${currentFromBlock} to ${latestBlock} (${totalBlocksToScan} blocks total)...`);

    let allDeposits: DepositTransfer[] = [];

    // Scan in chunks to respect the max block range limit
    while (currentFromBlock <= latestBlock) {
      const chunkToBlock = Math.min(
        currentFromBlock + MAX_BLOCK_RANGE - 1,
        latestBlock
      );
      const chunkSize = chunkToBlock - currentFromBlock + 1;

      console.log(`  Scanning chunk: blocks ${currentFromBlock} to ${chunkToBlock} (${chunkSize} blocks)...`);

      try {
        const deposits = await contractScanner.scanDeposits(currentFromBlock, chunkToBlock);
        allDeposits.push(...deposits);

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
          const deposits = await contractScanner.scanDeposits(currentFromBlock, smallerChunkToBlock);
          allDeposits.push(...deposits);
          await updateLatestScannedBlock(smallerChunkToBlock);
          currentFromBlock = smallerChunkToBlock + 1;
        } else {
          throw error;
        }
      }
    }

    // Process all found deposits
    if (allDeposits.length > 0) {
      console.log(`Found ${allDeposits.length} deposit(s), processing...`);
      for (const deposit of allDeposits) {
        await processTransaction(deposit);
      }
    } else {
      console.log(`No new deposits found (scanned ${totalBlocksToScan} blocks)`);
    }

    console.log(`✓ Completed scan, updated scanner to block ${latestBlock}`);
  } catch (error) {
    console.error("Error scanning for deposits:", error);
  }
};

/**
 * @private
 */
const job = new CronJob("0 */10 * * * *", scanDeposits);

export { job };

export const startDepositScanner = () => {
  job.start();
};
