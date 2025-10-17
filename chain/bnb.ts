interface JsonRpcResponse<T> {
  jsonrpc: "2.0";
  id: number;
  result: T;
  error?: {
    code: number;
    message: string;
  };
}

export class BnbChain {
  private endpoint: string;
  constructor(endpoint: string) {
    if (!endpoint) {
      throw new Error("RPC endpoint is not provided");
    }
    this.endpoint = endpoint;
  }

  async getBlockByNumber(blockNumber: number) {
    if (!this.endpoint) {
      throw new Error("BNB_CHAIN_ENDPOINT is not set");
    }
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBlockByNumber',
        params: [`0x${blockNumber.toString(16)}`, false],
        id: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = (await response.json()) as JsonRpcResponse<{
      hash: string;
      parentHash: string;
    }>;
    return data;
  }

  async getBalance(address: string) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [address, 'latest'],
        id: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = (await response.json()) as JsonRpcResponse<string>;
    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`);
    }
    
    const balanceInWei = parseInt(data.result, 16);
    const balanceInBnb = balanceInWei / 1e18;
    return balanceInBnb;
  }
}

export const bnbChain = new BnbChain(process.env.MAINNET_RPC_URL!);
