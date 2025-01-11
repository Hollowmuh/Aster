const { ethers } = require("ethers");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Environment variables validation
const requiredEnvVars = [
    'INFURA_API_KEY',
    'LIQUIDITY_MANAGER_ADDRESS'
];

function validateEnvironment() {
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
}

async function setupProvider() {
    try {
        const provider = new ethers.InfuraProvider("sepolia", process.env.INFURA_API_KEY);
        return provider;
    } catch (error) {
        throw new Error(`Failed to setup provider: ${error.message}`);
    }
}

async function getPairPrice() {
    try {
        validateEnvironment();
        const provider = await setupProvider();

        // Define the LiquidityManager contract ABI (only the getPoolPrice function is needed)
        const liquidityManagerABI = [
            "function getPoolPrice() public view returns (uint256)"
        ];

        // Set up the contract instance
        const liquidityManagerAddress = process.env.LIQUIDITY_MANAGER_ADDRESS;
        const liquidityManagerContract = new ethers.Contract(
            liquidityManagerAddress,
            liquidityManagerABI,
            provider
        );

        // Call getPoolPrice() to get the price
        const price = await liquidityManagerContract.getPoolPrice();
        
        // Format the result for easier reading (assuming the price has 18 decimals)
        console.log(`Pool price (scaled by 1e18): ${price.toString()}`);
        const formattedPrice = ethers.formatUnits(price, 18);  // Adjust decimals if necessary
        console.log(`Formatted Pool Price: ${formattedPrice}`);
    } catch (error) {
        console.error('Error getting pool price:', error.message);
    }
}

getPairPrice();
