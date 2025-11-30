import { ethers } from "ethers";
import solc from "solc";
import fs from "fs";
import path from "path";

// Helper to find imports for solc - MUST be synchronous for solc
function findImports(relativePath: string) {
    // In Bun/ESM, __dirname isn't standard, but we can use import.meta.dir if we pass it or resolve paths relative to cwd
    // However, keeping it simple with standard path resolution
    const absolutePath = path.resolve(import.meta.dir, '..', 'node_modules', relativePath);
    if (fs.existsSync(absolutePath)) {
        return { contents: fs.readFileSync(absolutePath, 'utf8') };
    }
    return { error: 'File not found' };
}

async function compileAndDeploy(contractName: string, wallet: ethers.Wallet) {
    console.log(`Preparing to deploy ${contractName}...`);
    
    const contractPath = path.resolve(import.meta.dir, "..", "contracts", `${contractName}.sol`);
    // Use Bun native file API
    const source = await Bun.file(contractPath).text();

    const input = {
        language: "Solidity",
        sources: {
            [`${contractName}.sol`]: {
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
    
    console.log(`Compiling ${contractName}...`);
    // solc.compile is synchronous, so imports must be handled synchronously
    const compiled = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
    
    if (compiled.errors) {
        const errors = compiled.errors.filter((err: any) => err.severity === 'error');
        if (errors.length > 0) {
            console.error("Compilation errors:");
            errors.forEach((err: any) => console.error(err.formattedMessage));
            throw new Error(`${contractName} compilation failed.`);
        }
    }

    const contract = compiled.contracts[`${contractName}.sol`][contractName];
    const abi = contract.abi;
    const bytecode = contract.evm.bytecode.object;

    const factory = new ethers.ContractFactory(abi, bytecode, wallet);

    console.log(`Deploying ${contractName}...`);
    const deployedContract = await factory.deploy();
    
    await deployedContract.waitForDeployment();

    const contractAddress = await deployedContract.getAddress();

    console.log(`${contractName} deployed to: ${contractAddress}`);
    return contractAddress;
}

async function main() {
    // Bun automatically loads .env files
    const { RPC_URL, MAINNET_RPC_URL, TESTNET_RPC_URL, PRIVATE_KEY } = process.env;

    // Fallback logic for RPC URL
    const rpcUrl = RPC_URL || MAINNET_RPC_URL || TESTNET_RPC_URL;

    if (!rpcUrl) {
        throw new Error("RPC URL not set. Please set RPC_URL, MAINNET_RPC_URL, or TESTNET_RPC_URL in your environment variables.");
    }
    if (!PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY is not set. Please add it to your environment variables.");
    }

    console.log(`Connecting to network...`);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`Using wallet address: ${wallet.address}`);

    // Deploy QuoteCoin
    await compileAndDeploy("QuoteCoin", wallet);

    // Deploy BaseCoin
    await compileAndDeploy("BaseCoin", wallet);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
