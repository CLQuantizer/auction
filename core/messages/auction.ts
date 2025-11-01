import type { Decimal } from "decimal.js";

export interface Auction {
  id: string;
  clearingPrice: Decimal | null;
  volume: Decimal;
  tradeCount: number;
  status: 'completed' | 'no_trades' | 'no_orders';
  timestamp: number;
}

