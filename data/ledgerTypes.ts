export enum LedgerTransactionType {
  DEPOSIT,
  WITHDRAWAL,
  FEE,
  TRADE,
}

export enum Assets  {
  BASE,
  QUOTE,
  GAS,
}

export interface TokenMetadata {
  address: string | null; // null for native tokens like BNB
  symbol: string;
  name: string;
  decimals: number;
}

/**
 * Token registry mapping Assets enum to token metadata
 */
export const TOKEN_REGISTRY: Record<Assets, TokenMetadata> = {
  [Assets.BASE]: {
    address: "0xeecbc280f257f3cb191e4b01feedb61cf42d5160".toLowerCase(),
    symbol: "BASE",
    name: "BaseCoin",
    decimals: 6,
  },
  [Assets.QUOTE]: {
    address: "0x690dffd8b28e614f2a582c1fedaf9ee316f8c93f".toLowerCase(),
    symbol: "QUOTE",
    name: "QuoteCoin",
    decimals: 6,
  },
  [Assets.GAS]: {
    address: null, // BNB is native, no contract address
    symbol: "BNB",
    name: "Binance Coin",
    decimals: 18,
  },
};

/**
 * Maps token addresses/symbols to Assets enum
 */
export function tokenToAsset(token: string): Assets {
  const tokenLower = token.toLowerCase();
  
  // Check registry for address, symbol, or name matches
  const assets = [Assets.BASE, Assets.QUOTE, Assets.GAS] as const;
  for (const asset of assets) {
    const metadata = TOKEN_REGISTRY[asset];
    if (metadata.address && tokenLower === metadata.address) {
      return asset;
    }
    if (tokenLower === metadata.symbol.toLowerCase() || 
        tokenLower === metadata.name.toLowerCase()) {
      return asset;
    }
  }
  
  // Legacy symbol checks for backwards compatibility
  if (tokenLower === "base" || tokenLower === "basecoin") {
    return Assets.BASE;
  }
  if (tokenLower === "quote" || tokenLower === "quotecoin") {
    return Assets.QUOTE;
  }
  if (tokenLower === "gas" || tokenLower === "bnb") {
    return Assets.GAS;
  }
  
  // Default to BASE for backwards compatibility
  return Assets.BASE;
}

/**
 * Get token metadata for an asset
 */
export function getTokenMetadata(asset: Assets): TokenMetadata {
  return TOKEN_REGISTRY[asset];
}