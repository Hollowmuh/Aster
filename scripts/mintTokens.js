require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
    // Retrieve deployer's private key and token address from .env
    const daiABI = require("../artifacts/contracts/DAI.sol/DAIToken.json").abi;
    const usdtABI = require("../artifacts/contracts/USDT.sol/USDTToken.json").abi;
    const ngnABI = require("../artifacts/contracts/NGNA.sol/NGNAToken.json").abi;
    const deployerPrivateKey = process.env.PRIVATE_KEY;
    const daiTokenAddress = process.env.DAITOKEN_ADDRESS;
    const usdtTokenAddress = process.env.USDTTOKEN_ADDRESS;
    const ngnaTokenAddress = process.env.NGNATOKEN_ADDRESS;
    const alchemyApiKey = process.env.INFURA_API_KEY;
    
    // Validate environment variables
    if (!deployerPrivateKey || !daiTokenAddress ||!usdtTokenAddress ||!ngnaTokenAddress || !alchemyApiKey ) {
        throw new Error("Please set PRIVATE_KEY, NGNATOKEN_ADDRESS, and ALCHEMY_ID in the .env file");
    }

    // Configure the provider using Alchemy
    const provider = new ethers.InfuraProvider("sepolia", alchemyApiKey);
    const wallet = new ethers.Wallet(deployerPrivateKey, provider);

    // Get the NGNAToken contract instance using the ABI
    const DAIToken = new ethers.Contract(daiTokenAddress, daiABI, wallet);
    const USDTToken = new ethers.Contract(usdtTokenAddress, usdtABI, wallet);
    const NGNAToken = new ethers.Contract(ngnaTokenAddress, ngnABI, wallet)
    
    // Mint parameters
    const amount = ethers.parseUnits("100000000", 18); // Minting 1 million tokens (18 decimals)
    const recipient = wallet.address;

    try {
        // Call the mint function
        console.log(`Minting ${ethers.formatUnits(amount, 18)} tokens to ${recipient}...`);
        const tx = await NGNAToken.mint(recipient, amount);
        // const txs = await USDTToken.mint(recipient, amount);
        console.log(`Transaction sent: ${tx.hash}`);
        // console.log(`Transaction sent: ${txs.hash}`)

        // Wait for the transaction to be mined
        const receipt = await tx.wait();
        // const receipts = await txs.wait();
        console.log(`Minted ${ethers.formatUnits(amount, 18)} tokens to ${recipient}`);
        console.log(`Transaction mined in block: ${receipt.blockNumber}`);
        // console.log(`Transaction mined in block: ${receipts.blockNumber}`);
    } catch (error) {
        console.error("Error minting tokens:", error);
        throw error; // Re-throw to trigger the error handling in the main catch block
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });