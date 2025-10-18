import { ledger } from "../../data/ledger";
import { Decimal } from "decimal.js";
import { LedgerTransactionType } from "../../data/ledgerTypes";

export async function creditDeposit(
  userId: string,
  amount: Decimal,
  txHash: string
) {
  try {
    await ledger.log(userId, amount, LedgerTransactionType.DEPOSIT);
    console.log(
      `Successfully credited ${amount} to ${userId} for transaction ${txHash}`
    );
  } catch (error) {
    console.error(
      `Failed to credit ${amount} to ${userId} for transaction ${txHash}:`,
      error
    );
    // Here you might want to add more robust error handling,
    // like saving the failed transaction to a queue to be retried later.
  }
}
