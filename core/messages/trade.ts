import type { Decimal } from "decimal.js";

export interface Trade {
  id: string;
  price: Decimal;
  quantity: Decimal;
  buyOrderId: string;
  sellOrderId: string;
  timestamp: number;
}
