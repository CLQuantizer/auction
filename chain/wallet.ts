import { ethers } from "ethers";

const bep20Abi = ["function transfer(address to, uint256 amount)"];

export class Wallet {
  private wallet: ethers.Wallet;
  private provider: ethers.JsonRpcProvider;

  constructor(privateKey: string, rpcUrl: string) {
    if (!rpcUrl) {
      throw new Error("RPC URL is not provided");
    }
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
  }

  async signBep20Transfer(
    tokenContractAddress: string,
    recipientAddress: string,
    amount: number
  ) {
    const tokenContract = new ethers.Contract(
      tokenContractAddress,
      bep20Abi,
      this.wallet
    );

    const decimals = 18; // BEP20 tokens usually have 18 decimals
    const amountInSmallestUnit = ethers.parseUnits(amount.toString(), decimals);

    const tx = await tokenContract
      .getFunction("transfer")
      .populateTransaction(recipientAddress, amountInSmallestUnit);

    tx.nonce = await this.provider.getTransactionCount(this.wallet.address);
    const feeData = await this.provider.getFeeData();
    if (feeData.gasPrice) {
      tx.gasPrice = feeData.gasPrice;
    } else {
      throw new Error("gasPrice is not available");
    }

    tx.gasLimit = await tokenContract
      .getFunction("transfer")
      .estimateGas(recipientAddress, amountInSmallestUnit);

    const signedTx = await this.wallet.signTransaction(tx);
    return signedTx;
  }
}
