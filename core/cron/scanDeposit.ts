import { creditDeposit } from "./credit";
import { createDeposit } from "../../data/deposit";
import { Decimal } from "decimal.js";
import {
  baseContractScanner,
  quoteContractScanner,
  type DepositTransfer,
} from "../../chain/contractScanner";
import { CronJob } from "cron";
import {
  getLatestScannedBlock,
  updateLatestScannedBlock,
} from "../../data/scanner";
import { Assets } from "../../data/ledgerTypes";

// Maximum block range per RPC request (NodeReal limit: 50,000 blocks)
const MAX_BLOCK_RANGE = 5000;

let isScanning = false;

const processTransaction = async (deposit: DepositTransfer, asset: Assets) => {
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
    const assetName = asset === Assets.GAS ? "BNB" : asset === Assets.BASE ? "BASE" : "QUOTE";
    console.log(`Deposit detected: ${valueString} ${assetName} from ${from} in block ${deposit.blockNumber}`);
    
    await createDeposit({
      blockNumber: deposit.blockNumber,
      from: from,
      to: to,
      value: valueString,
      hash: deposit.hash,
    });
    
    // All on-chain tokens we handle (BNB, BASE, QUOTE) use 18 decimals
    const decimals = 18;
    const amount = new Decimal(valueString).div(new Decimal(10 ** decimals));
    console.log(
      `Crediting ${amount.toString()} ${assetName} to ${from}...`
    );
    await creditDeposit(from, amount, deposit.hash, asset);
  }
};

export const scanDeposits = async () => {
  if (isScanning) {
    console.log("Previous scan still in progress. Skipping.");
    return;
  }
  
  isScanning = true;
  console.log("Scanning for deposits...");
  try {
    const lastScannedBlock = await getLatestScannedBlock();
    const latestChainBlock = await baseContractScanner.getLatestBlockNumber();
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

    let totalDepositsFound = 0;

    // Scan in chunks to respect the max block range limit
    while (currentFromBlock <= latestBlock) {
      const chunkToBlock = Math.min(
        currentFromBlock + MAX_BLOCK_RANGE - 1,
        latestBlock
      );
      const chunkSize = chunkToBlock - currentFromBlock + 1;

      console.log(`  Scanning chunk: blocks ${currentFromBlock} to ${chunkToBlock} (${chunkSize} blocks)...`);

      try {
        // Scan for ERC20 token deposits (BASE)
        const erc20Deposits = await baseContractScanner.scanDeposits(currentFromBlock, chunkToBlock);
        totalDepositsFound += erc20Deposits.length;
        for (const deposit of erc20Deposits) {
          await processTransaction(deposit, Assets.BASE);
        }

        // Scan for ERC20 token deposits (QUOTE)
        const quoteDeposits = await quoteContractScanner.scanDeposits(
          currentFromBlock,
          chunkToBlock
        );
        totalDepositsFound += quoteDeposits.length;
        for (const deposit of quoteDeposits) {
          await processTransaction(deposit, Assets.QUOTE);
        }

        // Scan for native BNB deposits
        // const bnbDeposits = await contractScanner.scanNativeBNB(
        //   currentFromBlock,
        //   chunkToBlock
        // );
        // totalDepositsFound += bnbDeposits.length;
        // for (const deposit of bnbDeposits) {
        //   await processTransaction(deposit, Assets.GAS);
        // }

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
          const erc20Deposits = await baseContractScanner.scanDeposits(currentFromBlock, smallerChunkToBlock);
          const quoteDeposits = await quoteContractScanner.scanDeposits(currentFromBlock, smallerChunkToBlock);
          // const bnbDeposits = await contractScanner.scanNativeBNB(currentFromBlock, smallerChunkToBlock);
          totalDepositsFound += erc20Deposits.length + quoteDeposits.length; // + bnbDeposits.length;
          for (const deposit of erc20Deposits) {
            await processTransaction(deposit, Assets.BASE);
          }
          for (const deposit of quoteDeposits) {
            await processTransaction(deposit, Assets.QUOTE);
          }
          // for (const deposit of bnbDeposits) {
          //   await processTransaction(deposit, Assets.GAS);
          // }
          await updateLatestScannedBlock(smallerChunkToBlock);
          currentFromBlock = smallerChunkToBlock + 1;
        } else {
          throw error;
        }
      }
    }

    // Summary
    if (totalDepositsFound > 0) {
      console.log(
        `Scan complete. Found ${totalDepositsFound} new deposits.`
      );
    } else {
      console.log("Scan complete. No new deposits found.");
    }
  } catch (error) {
    console.error("Error scanning for deposits:", error);
  } finally {
    isScanning = false;
    console.log("Finished scanning for deposits.");
  }
};

// Run every 30 seconds
export const scanDepositJob = new CronJob("*/10 * * * * *", scanDeposits);

export const startDepositScanner = () => {
  console.log("Starting deposit scanner cron job...");
  scanDepositJob.start();
};