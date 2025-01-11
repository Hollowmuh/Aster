require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
    // Uniswap Factory Address and Tokens
    const factoryAddress = process.env.UNISWAP_FACTORY_ADDRESS; // Uniswap V2 Factory address
    const tokenA = process.env.NGNATOKEN_ADDRESS; // NGNA token address
    const tokenB = process.env.DAITOKEN_ADDRESS; // DAI token address
    const deployerPrivateKey = process.env.PRIVATE_KEY;
    const infura = process.env.INFURA_API_KEY;

    if (!factoryAddress || !tokenA || !tokenB) {
        throw new Error("Please set UNISWAP_FACTORY_ADDRESS, NGNA_TOKEN_ADDRESS, and DAI_TOKEN_ADDRESS in your .env file");
    }

    // ABI for Uniswap Factory
    const factoryAbi = [
        "function getPair(address tokenA, address tokenB) external view returns (address pair)"
    ];
    //PROVIDER
    const provider = new ethers.InfuraProvider("sepolia", infura)
    // Contract instance
    const factoryContract = new ethers.Contract(factoryAddress, factoryAbi, provider);

    try {
        // Get pair address
        const pairAddress = await factoryContract.getPair(tokenA, tokenB);

        if (pairAddress === ethers.ZeroAddress) {
            console.log("No pair exists for the specified tokens.");
        } else {
            console.log(`Pair address for ${tokenA} and ${tokenB}:`, pairAddress);
        }
    } catch (error) {
        console.error("Error fetching pair address:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
