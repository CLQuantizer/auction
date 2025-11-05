import { Decimal } from "decimal.js";
import { ledger } from "../data/ledger";
import { Assets } from "../data/ledgerTypes";

class MarginGuard {
  async tryLock(userId: string, amount: Decimal, asset: Assets): Promise<boolean> {
    return ledger.lockBalance(userId, amount, asset);
  }

  async releaseLock(userId: string, amount: Decimal, asset: Assets): Promise<boolean> {
    return ledger.releaseBalance(userId, amount, asset);
  }
}

export const marginGuard = new MarginGuard();
