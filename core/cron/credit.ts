import { ledger } from "../../data/ledger";
import { Decimal } from "decimal.js";
import { LedgerTransactionType, Assets } from "../../data/ledgerTypes";

export async function creditDeposit(
  userId: string,
  amount: Decimal,
  txHash: string,
  asset: Assets = Assets.BASE
) {
  try {
    await ledger.log(userId, amount, LedgerTransactionType.DEPOSIT, asset);
    const assetName = asset === Assets.GAS ? "BNB" : asset === Assets.BASE ? "BASE" : "QUOTE";
    console.log(
      `Successfully credited ${amount} ${assetName} to ${userId} for transaction ${txHash}`
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
