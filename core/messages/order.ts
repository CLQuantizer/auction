import { Decimal } from "decimal.js";

export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export interface Order {
  id: string;
  userId: string;
  side: OrderSide;
  price: Decimal;
  quantity: Decimal;
  timestamp: number;
}
