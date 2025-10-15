import { Decimal } from 'decimal.js';

export const AUCTION_INTERVAL_SECONDS = 5;

export const DECIMAL_PLACES = 5;

export const TICK_SIZE = new Decimal("0.0001");
export const STEP_SIZE = new Decimal("0.0001");

// Set precision for decimal.js
Decimal.set({ precision: 50, rounding: Decimal.ROUND_HALF_UP });

export function toDecimal(value: number | string): Decimal {
  return new Decimal(value).toDecimalPlaces(DECIMAL_PLACES);
}
