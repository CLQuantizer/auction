import { bnbChain } from "../../chain/bnb";
import { creditDeposit } from "./credit";
import { createDeposit, getLatestDepositBlock } from "../../data/deposit";
import { Decimal } from "decimal.js";
import type { BscScanTx } from "../../chain/bnb";

const POLL_INTERVAL = 10000; // 2 seconds

const processTransaction = async (
  tx: BscScanTx | any,
  blockNumber: number
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
      `Crediting ${amount.toString()} to ${tx.from} in 15 seconds...`
    );
    setTimeout(() => {
      creditDeposit(tx.from!, amount, tx.hash!).catch(console.error);
    }, 15000);
  }
};

export const scanDeposits = async () => {
  console.log("Scanning for deposits...");
  try {
    if (bnbChain.useBscScan) {
      const latestBlock = await getLatestDepositBlock();
      const transactions = await bnbChain.getTransactionsForAddress(
        process.env.PUBLIC_KEY!,
        latestBlock + 1
      );

      if (!transactions || transactions.length === 0) {
        console.log("No new transactions found.");
        return;
      }

      for (const tx of transactions) {
        await processTransaction(tx, parseInt(tx.blockNumber));
      }
    } else {
      let latestBlock = await getLatestDepositBlock();
      const currentBlock = await bnbChain.getLatestBlockNumber();

      if (currentBlock > latestBlock) {
        console.log(
          `New blocks detected. Scanning from block ${
            latestBlock + 1
          } to ${currentBlock}`
        );

        for (let i = latestBlock + 1; i <= currentBlock; i++) {
          const block = await bnbChain.getBlockByNumber(i);
          if (!block || !block.result || !block.result.transactions) {
            continue;
          }
          const transactions = block.result.transactions;

          for (const tx of transactions) {
            await processTransaction(tx, i);
          }
        }
      } else {
        console.log("No new blocks to process.");
      }
    }
  } catch (error) {
    console.error("Error scanning for deposits:", error);
  }

  setTimeout(scanDeposits, POLL_INTERVAL);
};
