import { Decimal } from "decimal.js";
import { ledger } from "../data/ledger";

class MarginGuard {
  async tryLock(userId: string, amount: Decimal): Promise<boolean> {
    return ledger.lockBalance(userId, amount);
  }

  async releaseLock(userId: string, amount: Decimal): Promise<boolean> {
    return ledger.releaseBalance(userId, amount);
  }
}

export const marginGuard = new MarginGuard();
