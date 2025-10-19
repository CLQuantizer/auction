import { bnbChain } from "../../chain/bnb";
import { creditDeposit } from "./credit";
import { createDeposit, getLatestDepositBlock } from "../../data/deposit";
import { Decimal } from "decimal.js";

const POLL_INTERVAL = 2000; // 2 seconds
const BLOCK_CONFIRMATIONS = 128;

export const scanDeposits = async () => {
  console.log("Scanning for deposits...");

  try {
    let latestBlock = await getLatestDepositBlock();
    const currentBlock = await bnbChain.getLatestBlockNumber();
    const confirmedBlock = currentBlock - BLOCK_CONFIRMATIONS;

    if (confirmedBlock <= 0) {
      console.log("Not enough blocks to confirm transactions yet.");
      setTimeout(scanDeposits, POLL_INTERVAL);
      return;
    }

    if (latestBlock === 0) {
      latestBlock = confirmedBlock - 1;
    }

    if (confirmedBlock > latestBlock) {
      console.log(
        `New blocks detected. Scanning from block ${
          latestBlock + 1
        } to ${confirmedBlock}`
      );

      for (let i = latestBlock + 1; i <= confirmedBlock; i++) {
        const block = await bnbChain.getBlockByNumber(i);
        const transactions = block.result.transactions;

        for (const tx of transactions) {
          if (tx.to === process.env.DEPOSIT_ADDRESS) {
            console.log(`Deposit detected: ${tx.value} from ${tx.from}`);
            await createDeposit({
              blockNumber: i,
              from: tx.from,
              to: tx.to,
              value: tx.value,
              hash: tx.hash,
            });
            const amount = new Decimal(tx.value).div(new Decimal(1e18));
            await creditDeposit(tx.from, amount, tx.hash);
          }
        }
      }
    } else {
      console.log("No new blocks to process.");
    }
  } catch (error) {
    console.error("Error scanning for deposits:", error);
  }

  setTimeout(scanDeposits, POLL_INTERVAL);
};
