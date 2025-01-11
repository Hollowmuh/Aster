const axios = require("axios");
const { ethers } = require("ethers");
const dotenv = require("dotenv");
const { abi: uniswapRouterABI } = require("../artifacts/contracts/UniswapRouter.sol/UniswapRouter.json");

dotenv.config();

const CONFIG = {
    COINGECKO_API: "https://api.coingecko.com/api/v3/simple/price",
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 5000,
    GAS_LIMIT_BUFFER: 1.1,
    CONFIRMATION_BLOCKS: 2,
    PRICE_DECIMALS: 18,
    PRICE_PRECISION: 6
};

const requiredEnvVars = [
    'INFURA_API_KEY',
    'PRIVATE_KEY',
    'ROUTER_ADDRESS',
    'COINGECKO_API_KEY',
    'NGNA_ADDRESS',
    'DAI_ADDRESS'
];

function validateEnvironment() {
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
}

function setupProvider() {
    const provider = new ethers.InfuraProvider("sepolia", process.env.INFURA_API_KEY);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    return { provider, wallet };
}

async function fetchNGNAPrice(retryCount = 0) {
    try {
        const options = {
            method: "GET",
            url: CONFIG.COINGECKO_API,
            params: { ids: "ngna", vs_currencies: "dai" },
            headers: {
                accept: "application/json",
                "x-cg-api-key": process.env.COINGECKO_API_KEY,
            },
            timeout: 5000
        };

        const response = await axios.request(options);
        const price = response.data["ngna"].dai;
        console.log(`Fetched NGNA/DAI Price: ${price}`);
        return price;
    } catch (error) {
        if (retryCount < CONFIG.RETRY_ATTEMPTS) {
            console.log(`Retry attempt ${retryCount + 1} after error: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
            return fetchNGNAPrice(retryCount + 1);
        }
        throw new Error(`Failed to fetch price after ${CONFIG.RETRY_ATTEMPTS} attempts: ${error.message}`);
    }
}

async function swapNGNAForDAI(amountNGNA, price) {
    const { wallet, provider } = setupProvider();
    const router = new ethers.Contract(process.env.ROUTER_ADDRESS, uniswapRouterABI, wallet);

    // Convert amount of NGNA to the equivalent amount of DAI
    const amountDAI = ethers.BigNumber.from(amountNGNA).mul(ethers.BigNumber.from(price)).div(ethers.BigNumber.from(10).pow(CONFIG.PRICE_DECIMALS));
    console.log(`Amount to receive in DAI: ${ethers.utils.formatUnits(amountDAI, 18)}`);

    const ngnaToken = new ethers.Contract(process.env.NGNA_ADDRESS, ["function approve(address spender, uint256 amount) public returns (bool)"], wallet);

    // Approve the router to spend NGNA tokens
    const approvalTx = await ngnaToken.approve(router.address, amountNGNA);
    await approvalTx.wait();
    console.log(`Approved ${amountNGNA} NGNA for swapping`);

    // Swap NGNA for DAI
    const path = [process.env.NGNA_ADDRESS, process.env.DAI_ADDRESS];
    const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 10 minute deadline
    const swapTx = await router.swapExactTokensForTokens(
        amountNGNA, // amount of NGNA
        amountDAI,  // amount of DAI we want to receive
        path,       // token swap path
        wallet.address, // recipient
        deadline,   // deadline
        {
            gasLimit: 250000, // set a sufficient gas limit
        }
    );
    console.log(`Swap transaction hash: ${swapTx.hash}`);
    
    const receipt = await swapTx.wait(CONFIG.CONFIRMATION_BLOCKS);
    console.log(`Transaction confirmed. Block hash: ${receipt.blockHash}`);
}

async function main() {
    try {
        validateEnvironment();
        const price = await fetchNGNAPrice();
        
        // Example amount of NGNA to swap (in smallest unit, e.g., wei)
        const amountNGNA = ethers.utils.parseUnits("100", 18); // Swapping 100 NGNA
        
        await swapNGNAForDAI(amountNGNA, price);

    } catch (error) {
        console.error('Critical error in main process:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = {
    fetchNGNAPrice,
    swapNGNAForDAI,
    validateEnvironment,
    setupProvider
};
