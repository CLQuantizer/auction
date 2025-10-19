import {
  BLOCK_SCAN_RANGE,
} from "../core/primitives/constants";

interface JsonRpcResponse<T> {
  jsonrpc: "2.0";
  id: number;
  result: T;
  error?: {
    code: number;
    message: string;
  };
}

export class NodeReal {
  private endpoint: string;
  constructor(endpoint: string) {
    if (!endpoint) {
      throw new Error("RPC endpoint is not provided");
    }
    this.endpoint = endpoint;
  }

  async getAssetTransfers(
    address: string,
    fromBlock: string | number,
    category: ("external" | "internal" | "20" | "721" | "1155")[],
  ) {
    let allTransfers: any[] = [];
    let pageKey: string | undefined = undefined;

    do {
      if (typeof fromBlock === "number") {
        console.log(
          "scanning from block",
          fromBlock,
          "to block",
          fromBlock + BLOCK_SCAN_RANGE,
        );
      } else {
        console.log("scanning from block", fromBlock, "to block", "latest");
      }
      const fromBlockHex =
        typeof fromBlock === "number"
          ? `0x${fromBlock.toString(16)}`
          : fromBlock;
      const toBlockHex =
        typeof fromBlock === "number"
          ? `0x${(fromBlock + BLOCK_SCAN_RANGE).toString(16)}`
          : undefined;

      const params: any = {
        fromBlock: fromBlockHex,
        toAddress: address,
        category,
      };

      if (toBlockHex) {
        params.toBlock = toBlockHex;
      }

      if (pageKey) {
        params.pageKey = pageKey;
      }

      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "nr_getAssetTransfers",
          params: [params],
          id: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as JsonRpcResponse<{
        transfers: any[];
        pageKey?: string;
      }>;

      if (data.error) {
        throw new Error(`RPC error: ${data.error.message}`);
      }

      if (data.result && data.result.transfers) {
        allTransfers = allTransfers.concat(data.result.transfers);
      }

      pageKey = data.result.pageKey;
    } while (pageKey);
    return { transfers: allTransfers };
  }
}

export const nodeReal = new NodeReal(process.env.MAINNET_RPC_URL!);