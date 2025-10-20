import { Hono } from "hono";
import { ledger } from "../data/ledger";
import {
  toDecimal,
  WITHDRAWAL_FEE_PERCENT,
} from "../core/primitives/constants";
import { createWithdrawal } from "../data/withdraw";

export const withdrawRoutes = new Hono();

withdrawRoutes.post("/withdraw", async (c) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch (e) {
    return c.text("Invalid JSON", 400);
  }

  const { userId, amount, toAddress } = body;

  if (!userId || !amount || !toAddress) {
    return c.text("Missing required fields", 400);
  }

  const withdrawalAmount = toDecimal(amount);

  if (withdrawalAmount.isNegative() || withdrawalAmount.isZero()) {
    return c.text("Invalid withdrawal amount", 400);
  }

  const fee = withdrawalAmount.mul(WITHDRAWAL_FEE_PERCENT);
  const amountToSend = withdrawalAmount.sub(fee);

  const success = await ledger.withdraw(userId, withdrawalAmount);

  if (!success) {
    return c.text("Insufficient balance or user not found", 400);
  }

  const fromAddress = process.env.HOT_WALLET_ADDRESS;
  if (!fromAddress) {
    console.error("HOT_WALLET_ADDRESS environment variable not set");
    // This is an internal server error, don't expose this to the user
    return c.text("Withdrawal service is not configured", 500);
  }

  try {
    const newWithdrawal = await createWithdrawal({
      from: fromAddress,
      to: toAddress,
      value: amountToSend.toString(),
      status: "pending",
      blockNumber: null,
      hash: null,
    });
    return c.json({ success: true, withdrawal: newWithdrawal }, 201);
  } catch (error) {
    console.error("Failed to create withdrawal record:", error);
    // Here we should ideally revert the ledger transaction.
    // This depends on the transaction support of the ledger service.
    // For now, we'll log the error and return a generic error message.
    return c.text("Failed to process withdrawal", 500);
  }
});
