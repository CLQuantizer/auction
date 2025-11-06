interface JsonRpcResponse<T> {
  jsonrpc: "2.0";
  id: number;
  result: T;
  error?: {
    code: number;
    message: string;
  };
}

interface BscScanTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  input: string;
  type: string;
  gas: string;
  gasUsed: string;
  isError: string;
  txreceipt_status: string;
}

export type { BscScanTx };

interface BscScanResponse {
  status: string;
  message: string;
  result: BscScanTx[];
}

export class BnbChain {
  private endpoint: string;

  constructor(
    endpoint: string,
  ) {
    if (!endpoint) {
      throw new Error("RPC endpoint is not provided");
    }
    this.endpoint = endpoint;
  }

  async getBlockByNumber(blockNumber: number, withTransactions: boolean = false) {
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
        params: [`0x${blockNumber.toString(16)}`, withTransactions],
        id: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = (await response.json()) as JsonRpcResponse<{
      hash: string;
      parentHash: string;
      transactions: any[];
    }>;
    return data;
  }

  async getLatestBlockNumber() {
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
        method: 'eth_blockNumber',
        params: [],
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
    return parseInt(data.result, 16);
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

  async getTransactionsForAddress(address: string, startBlock: number = 0) {
    throw new Error("BscScan functionality has been removed. Use RPC methods instead.");
  }

  async getBep20TokenBalance(tokenAddress: string, walletAddress: string): Promise<bigint> {
    const functionSignature = '0x70a08231'; // balanceOf(address)
    const encodedAddress = walletAddress.substring(2).padStart(64, '0');
    const data = functionSignature + encodedAddress;

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{
          to: tokenAddress,
          data: data,
        }, 'latest'],
        id: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = (await response.json()) as JsonRpcResponse<string>;
    if (json.error) {
      throw new Error(`RPC error: ${json.error.message}`);
    }
    
    return BigInt(json.result);
  }
}

export const bnbChain = new BnbChain(
  process.env.NODEREAL_RPC_URL!,
);
