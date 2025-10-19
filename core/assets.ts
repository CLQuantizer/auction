export interface Asset {
  name: string;
  symbol: string;
  decimals: number;
}

export const BaseCoin: Asset = {
  name: "BaseCoin",
  symbol: "BASE",
  decimals: 6,
};

export const QuoteCoin: Asset = {
  name: "QuoteCoin",
  symbol: "QUOTE",
  decimals: 6,
};

export interface Instrument {
  base: Asset;
  quote: Asset;
}

export const MainInstrument: Instrument = {
  base: BaseCoin,
  quote: QuoteCoin,
};
