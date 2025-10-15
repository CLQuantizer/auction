const ENDPOINT = process.env.BNB_CHAIN_ENDPOINT

class BnbChain {
  async getBlockByNumber(blockNumber: number) {
    if (!ENDPOINT) {
      throw new Error('BNB_CHAIN_ENDPOINT is not set');
    }
    const response = await fetch(ENDPOINT, {
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

    const data = await response.json();
    return data;
  }
}

export const bnbChain = new BnbChain();
