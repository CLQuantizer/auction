import { creditDeposit } from "./credit";
import { createDeposit } from "../../data/deposit";
import { Decimal } from "decimal.js";
import { nodeReal } from "../../chain/nodereal";
import { CronJob } from "cron";
import {
  getLatestScannedBlock,
  updateLatestScannedBlock,
} from "../../data/scanner";
import { bnbChain } from "../../chain/bnb";
import { BLOCK_SCAN_RANGE } from "../primitives/constants";

const processTransaction = async (
  tx: {
    from: string;
    to: string;
    value: string;
    hash: string;
  },
  blockNumber: number,
) => {
  console.log("processing transaction", JSON.stringify(tx, null, 2));
  if (
    tx.to.toLowerCase() === process.env.PUBLIC_KEY!.toLowerCase() &&
    tx.from &&
    tx.to &&
    tx.value &&
    tx.hash
  ) {
    console.log(`Deposit detected: ${tx.value} from ${tx.from}`);
    await createDeposit({
      blockNumber: blockNumber,
      from: tx.from,
      to: tx.to,
      value: tx.value,
      hash: tx.hash,
    });
    const amount = new Decimal(tx.value).div(new Decimal(1e18));
    console.log(
      `Crediting ${amount.toString()} to ${tx.from} in 15 seconds...`,
    );
    setTimeout(() => {
      creditDeposit(tx.from!, amount, tx.hash!).catch(console.error);
    }, 15000);
  }
};

export const scanDeposits = async () => {
  console.log("Scanning for deposits...");
  try {
    const latestScannedBlock = await getLatestScannedBlock();
    const latestChainBlock = await bnbChain.getLatestBlockNumber();
    const fromBlock = latestScannedBlock + 1;

    if (fromBlock > latestChainBlock-BLOCK_SCAN_RANGE) {
      console.log("No new blocks to process.");
      return;
    }

    const result = await nodeReal.getAssetTransfers(
      process.env.PUBLIC_KEY!,
      fromBlock,
      ["20"],
    );

    if (result && result.transfers && result.transfers.length > 0) {
      for (const tx of result.transfers) {
        await processTransaction(
          {
            from: tx.from,
            to: tx.to,
            value: tx.value,
            hash: tx.hash,
          },
          parseInt(tx.blockNum, 16),
        );
      }
    } else {
      console.log("No new transactions found.");
    }

    const scannedUpToBlock = Math.min(
      fromBlock + BLOCK_SCAN_RANGE,
      latestChainBlock,
    );
    await updateLatestScannedBlock(scannedUpToBlock);
    console.log(`Scanner updated to block ${scannedUpToBlock}`);
  } catch (error) {
    console.error("Error scanning for deposits:", error);
  }
};

const job = new CronJob("*/10 * * * * *", scanDeposits);

export const startScanner = () => {
  job.start();
};
