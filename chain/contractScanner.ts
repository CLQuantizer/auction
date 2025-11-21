import { createPublicClient, http, parseAbi, type Address } from "viem";
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
  private tokenName: string;

  constructor(rpcUrl: string, contractAddress: Address, publicKey: Address, tokenName: string = "Token") {
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
      transport: http(rpcUrl, {
        batch: true,
      }),
    });
    this.contractAddress = contractAddress.toLowerCase() as Address;
    this.publicKey = publicKey.toLowerCase() as Address;
    this.tokenName = tokenName;
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
      `Scanning ${this.tokenName} deposits from block ${fromBlock} to block ${toBlock || "latest"}`,
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
   * Scan for native BNB transactions to the public key address
   * @param fromBlock Starting block number
   * @param toBlock Ending block number (optional, defaults to latest)
   * @returns Array of deposit transfers
   */
  async scanNativeBNB(
    fromBlock: number,
    toBlock?: number,
  ): Promise<DepositTransfer[]> {
    console.log(
      `Scanning native BNB deposits from block ${fromBlock} to block ${toBlock || "latest"}`,
    );

    const deposits: DepositTransfer[] = [];

    try {
      const latestBlock = await this.getLatestBlockNumber();
      const toBlockNum = toBlock || latestBlock;
      
      // Scan blocks in chunks to avoid overwhelming the RPC
      // With batching enabled, we can handle efficient chunks (NodeReal/typical providers handle ~100 per batch well)
      const chunkSize = 100;
      let currentBlock = fromBlock;
      
      while (currentBlock <= toBlockNum) {
        const chunkEnd = Math.min(currentBlock + chunkSize - 1, toBlockNum);
        
        // Get transactions for each block in the chunk
        const blockPromises: Promise<any[]>[] = [];
        for (let blockNum = currentBlock; blockNum <= chunkEnd; blockNum++) {
          blockPromises.push(
            this.client.getBlock({ blockNumber: BigInt(blockNum), includeTransactions: true })
              .then((block) => {
                if (block && block.transactions) {
                  return block.transactions
                    .filter((tx: any) => {
                      // Filter for transactions sent to our public key with value > 0
                      return tx.to && 
                             tx.to.toLowerCase() === this.publicKey &&
                             tx.value && 
                             tx.value > 0n &&
                             tx.to !== '0x0000000000000000000000000000000000000000'; // Skip contract creation
                    })
                    .map((tx: any) => ({
                      from: tx.from,
                      to: tx.to,
                      value: tx.value,
                      hash: tx.hash,
                      blockNumber: Number(block.number),
                    }));
                }
                return [];
              })
              .catch((error) => {
                console.error(`Error getting block ${blockNum}:`, error);
                return [];
              })
          );
        }
        
        const results = await Promise.all(blockPromises);
        const chunkDeposits = results.flat();
        
        for (const deposit of chunkDeposits) {
          deposits.push({
            from: deposit.from,
            to: deposit.to,
            value: deposit.value,
            hash: deposit.hash,
            blockNumber: deposit.blockNumber,
          });
        }
        
        currentBlock = chunkEnd + 1;
      }
    } catch (error) {
      console.error("Error scanning for native BNB deposits:", error);
      throw error;
    }

    return deposits;
  }

  /**
   * Scan deposits from the last scanned block to the latest block
   * Uses the scanner table to track progress (call getLatestScannedBlock from scanner.ts)
   * @param fromBlock Starting block number (typically lastScannedBlock + 1)
   * @param onDeposit Optional callback function called when deposits are found
   * @returns Array of deposit transfers
   */
  async scanFromBlock(
    fromBlock: number,
    onDeposit?: (deposits: DepositTransfer[]) => void,
  ): Promise<DepositTransfer[]> {
    const latestBlock = await this.getLatestBlockNumber();
    const deposits = await this.scanDeposits(fromBlock, latestBlock);
    
    if (deposits.length > 0 && onDeposit) {
      onDeposit(deposits);
    }
    
    return deposits;
  }
}

// Export singleton instance with environment variables
// NODEREAL_RPC_URL should be HTTP URL like: https://bsc-mainnet.nodereal.io/v1/YOUR_API_KEY
export const baseContractScanner = new ContractScanner(
  process.env.NODEREAL_RPC_URL!,
  (process.env.VITE_PUBLIC_BASE_TOKEN_ADDRESS ||
    "0xeecbc280f257f3cb191e4b01feedb61cf42d5160") as Address,
  (process.env.VITE_PUBLIC_PUBLIC_KEY ||
    "0x3463defEa945Adb2938AaD6B53D45ea9f460Db9F") as Address,
  "BaseCoin"
);

export const quoteContractScanner = new ContractScanner(
  process.env.NODEREAL_RPC_URL!,
  (process.env.VITE_PUBLIC_QUOTE_TOKEN_ADDRESS ||
    "0x690dffd8b28e614f2a582c1fedaf9ee316f8c93f") as Address,
  (process.env.VITE_PUBLIC_PUBLIC_KEY ||
    "0x3463defEa945Adb2938AaD6B53D45ea9f460Db9F") as Address,
  "QuoteCoin"
);

