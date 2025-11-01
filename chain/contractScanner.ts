import { createPublicClient, webSocket, parseAbi, type Address } from "viem";
import { bsc } from "viem/chains";

// ERC20 Transfer event ABI
const erc20Abi = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

export interface DepositTransfer {
  from: Address;
  to: Address;
  value: bigint;
  hash: `0x${string}`;
  blockNumber: number;
}

export class ContractScanner {
  private client;
  private contractAddress: Address;
  private publicKey: Address;
  private unsubscribe?: () => void;

  constructor(rpcUrl: string, contractAddress: Address, publicKey: Address) {
    if (!rpcUrl) {
      throw new Error("RPC endpoint is not provided");
    }
    if (!contractAddress) {
      throw new Error("Contract address is not provided");
    }
    if (!publicKey) {
      throw new Error("Public key is not provided");
    }

    this.client = createPublicClient({
      chain: bsc,
      transport: webSocket(rpcUrl),
    });
    this.contractAddress = contractAddress.toLowerCase() as Address;
    this.publicKey = publicKey.toLowerCase() as Address;
  }

  /**
   * Scan for Transfer events to the public key address
   * @param fromBlock Starting block number
   * @param toBlock Ending block number (optional, defaults to latest)
   * @returns Array of deposit transfers
   */
  async scanDeposits(
    fromBlock: number,
    toBlock?: number,
  ): Promise<DepositTransfer[]> {
    console.log(
      `Scanning BaseCoin deposits from block ${fromBlock} to block ${toBlock || "latest"}`,
    );

    const deposits: DepositTransfer[] = [];

    try {
      const logs = await this.client.getLogs({
        address: this.contractAddress,
        event: erc20Abi[0],
        args: {
          to: this.publicKey,
        },
        fromBlock: BigInt(fromBlock),
        toBlock: toBlock ? BigInt(toBlock) : "latest",
      });

      for (const log of logs) {
        if (log.args.from && log.args.to && log.args.value) {
          deposits.push({
            from: log.args.from,
            to: log.args.to,
            value: log.args.value,
            hash: log.transactionHash,
            blockNumber: Number(log.blockNumber),
          });
        }
      }
    } catch (error) {
      console.error("Error scanning for deposits:", error);
      throw error;
    }

    return deposits;
  }

  /**
   * Get the latest block number
   */
  async getLatestBlockNumber(): Promise<number> {
    const blockNumber = await this.client.getBlockNumber();
    return Number(blockNumber);
  }

  /**
   * Get ERC20 token balance for an address
   */
  async getTokenBalance(address: Address): Promise<bigint> {
    const balance = await this.client.readContract({
      address: this.contractAddress,
      abi: parseAbi(["function balanceOf(address owner) view returns (uint256)"]),
      functionName: "balanceOf",
      args: [address],
    });
    return balance;
  }

  /**
   * Watch for new blocks and scan deposits on each block
   * @param onDeposit Callback function called when deposits are found
   */
  watchBlocks(onDeposit: (deposits: DepositTransfer[]) => void) {
    console.log("Starting to watch for new blocks...");
    
    this.unsubscribe = this.client.watchBlocks({
      onBlock: async (block) => {
        const blockNumber = Number(block.number);
        console.log(`New block detected: ${blockNumber}`);
        
        try {
          // Scan for deposits in the new block
          const deposits = await this.scanDeposits(blockNumber, blockNumber);
          
          if (deposits.length > 0) {
            console.log(`Found ${deposits.length} deposit(s) in block ${blockNumber}`);
            onDeposit(deposits);
          }
        } catch (error) {
          console.error(`Error scanning block ${blockNumber}:`, error);
        }
      },
    });

    return this.unsubscribe;
  }

  /**
   * Stop watching for new blocks
   */
  stopWatching() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
      console.log("Stopped watching for new blocks");
    }
  }
}

// Export singleton instance with environment variables
// NODEREAL_RPC_URL should be WebSocket URL like: wss://bsc-mainnet.nodereal.io/ws/v1/YOUR_API_KEY
export const contractScanner = new ContractScanner(
  process.env.NODEREAL_RPC_URL!,
  (process.env.VITE_PUBLIC_BASE_TOKEN_ADDRESS ||
    "0xeecbc280f257f3cb191e4b01feedb61cf42d5160") as Address,
  (process.env.VITE_PUBLIC_PUBLIC_KEY ||
    "0x3463defEa945Adb2938AaD6B53D45ea9f460Db9F") as Address,
);

