import { bnbChain } from "../../chain/bnb";
import { Decimal } from "decimal.js";
import { creditDeposit } from "./credit";

// This should be your exchange's public key, loaded from environment variables
const PUBLIC_KEY = process.env.PUBLIC_KEY || "0xYourPublicKey";

let lastScannedBlock: number = 65186730;

async function scanDeposits() {
  try {
    if (lastScannedBlock === null) {
      // On the first run, get the latest block number and start from there.
      lastScannedBlock = await bnbChain.getLatestBlockNumber();
    }

    console.log(`Scanning for transactions since block ${lastScannedBlock}`);

    const transactions = await bnbChain.getTransactionsForAddress(PUBLIC_KEY, lastScannedBlock + 1);

    if (transactions && transactions.length > 0) {
      for (const tx of transactions) {
        if (tx.to.toLowerCase() === PUBLIC_KEY.toLowerCase()) {
          console.log(`Deposit found in block ${tx.blockNumber}: ${tx.hash}`);

          const amount = new Decimal(tx.value).div(new Decimal(1e18));

          // Credit the user
          await creditDeposit(tx.from, amount, tx.hash);
        }
        lastScannedBlock = Math.max(lastScannedBlock, parseInt(tx.blockNumber));
      }
    } else {
      console.log("No new transactions found.");
    }

  } catch (error) {
    console.error("Error scanning deposits:", error);
  }
}

export function startScanning() {
    console.log("Starting deposit scanner...");
    // Run every 10 seconds.
    // This should be configured based on the chain's block time.
    setInterval(scanDeposits, 10000);
}
