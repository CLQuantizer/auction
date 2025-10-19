import { ethers } from "ethers";
import solc from "solc";
import fs from "fs";
import path from "path";

async function main() {
    const { MAINNET_RPC_URL, PRIVATE_KEY } = process.env;

    if (!MAINNET_RPC_URL) {
        throw new Error("MAINNET_RPC_URL is not set. Please add it to your environment variables.");
    }
    if (!PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY is not set. Please add it to your environment variables.");
    }

    const provider = new ethers.JsonRpcProvider(MAINNET_RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`Using wallet address: ${wallet.address}`);

    const contractPath = path.resolve(__dirname, "..", "contracts", "BaseCoin.sol");
    const source = fs.readFileSync(contractPath, "utf8");

    const input = {
        language: "Solidity",
        sources: {
            "BaseCoin.sol": {
                content: source,
            },
        },
        settings: {
            outputSelection: {
                "*": {
                    "*": ["*"],
                },
            },
        },
    };
    
    const compiled = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
    
    if (compiled.errors) {
        console.error("Compilation errors:");
        compiled.errors.forEach((err: any) => console.error(err.formattedMessage));
        throw new Error("Contract compilation failed.");
    }

    const contract = compiled.contracts["BaseCoin.sol"]["BaseCoin"];
    const abi = contract.abi;
    const bytecode = contract.evm.bytecode.object;

    const factory = new ethers.ContractFactory(abi, bytecode, wallet);

    console.log("Deploying BaseCoin contract to Mainnet...");
    const baseCoin = await factory.deploy();
    
    await baseCoin.waitForDeployment();

    const contractAddress = await baseCoin.getAddress();

    console.log(`BaseCoin contract deployed to: ${contractAddress}`);
}

function findImports(relativePath: string) {
    const absolutePath = path.resolve(__dirname, '..', 'node_modules', relativePath);
    if (fs.existsSync(absolutePath)) {
        return { contents: fs.readFileSync(absolutePath, 'utf8') };
    }
    return { error: 'File not found' };
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
