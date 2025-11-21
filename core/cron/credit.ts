import { ledger } from "../../data/ledger";
import { Decimal } from "decimal.js";
import { LedgerTransactionType, Assets } from "../../data/ledgerTypes";

export async function creditDeposit(
  userId: string,
  amount: Decimal,
  txHash: string,
  asset: Assets = Assets.BASE
) {
  const assetName = asset === Assets.GAS ? "BNB" : asset === Assets.BASE ? "BASE" : "QUOTE";
  
  try {
    console.log(`[creditDeposit] Attempting to credit ${amount.toString()} ${assetName} to ${userId} (asset enum: ${asset})`);
    await ledger.log(userId, amount, LedgerTransactionType.DEPOSIT, asset);
    console.log(
      `Successfully credited ${amount.toString()} ${assetName} to ${userId} for transaction ${txHash}`
    );
  } catch (error: any) {
    console.error(
      `✗ Failed to credit ${amount.toString()} ${assetName} to ${userId} for transaction ${txHash}:`,
      error
    );
    console.error(`Error details:`, {
      message: error?.message,
      stack: error?.stack,
      userId,
      amount: amount.toString(),
      asset,
      assetName,
      txHash
    });
    // Re-throw the error so the caller knows it failed
    throw error;
  }
}
