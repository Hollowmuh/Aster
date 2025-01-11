const axios = require("axios");
const { ethers } = require("ethers");
const dotenv = require("dotenv");
const { abi: liquidityManagerABI } = require("../artifacts/contracts/LiquidityManager.sol/LiquidityManager.json");

dotenv.config();

const CONFIG = {
    COINGECKO_API: "https://api.coingecko.com/api/v3/simple/price",
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 5000,
    GAS_LIMIT_BUFFER: 1.1,
    CONFIRMATION_BLOCKS: 2,
    // Adjust decimals based on your contract's requirements
    PRICE_DECIMALS: 18,
    // Price precision for intermediate calculations
    PRICE_PRECISION: 6
};

const requiredEnvVars = [
    'INFURA_API_KEY',
    'PRIVATE_KEY',
    'LIQUIDITY_MANAGER_ADDRESS',
    'COINGECKO_API_KEY',
    'DAITOKEN_ADDRESS',
    'NGNATOKEN_ADDRESS'
];

function validateEnvironment() {
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
}

function setupProvider() {
    try {
        const provider = new ethers.InfuraProvider("sepolia", process.env.INFURA_API_KEY);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        return { provider, wallet };
    } catch (error) {
        throw new Error(`Failed to setup provider: ${error.message}`);
    }
}

async function fetchNGNUSDPrice(retryCount = 0) {
    try {
        const options = {
            method: "GET",
            url: CONFIG.COINGECKO_API,
            params: { ids: "dai", vs_currencies: "ngn" },
            headers: {
                accept: "application/json",
                "x-cg-api-key": process.env.COINGECKO_API_KEY,
            },
            timeout: 5000
        };

        const response = await axios.request(options);
        const price = response.data["dai"].ngn;
        console.log(`Fetched DAI/NGN Price: ${price}`);
        return price;
    } catch (error) {
        if (retryCount < CONFIG.RETRY_ATTEMPTS) {
            console.log(`Retry attempt ${retryCount + 1} after error: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
            return fetchNGNUSDPrice(retryCount + 1);
        }
        throw new Error(`Failed to fetch price after ${CONFIG.RETRY_ATTEMPTS} attempts: ${error.message}`);
    }
}

async function debugContractState(contract, price, scaledPrice) {
    try {
        console.log('\n=== Debug Contract State ===');
        let currentPrice;
        
        // Get contract's current state (assuming these view functions exist)
        try {
            currentPrice = await contract.getPoolPrice();
            console.log('Current contract price:', currentPrice.toString());
        } catch (e) {
            console.log('Could not fetch current price:', e.message);
        }

        // Log relevant information about the input
        console.log('\n=== Input Analysis ===');
        console.log('Raw input price:', price);
        console.log('Scaled price:', scaledPrice.toString());
        console.log('Scaled price in hex:', ethers.toBeHex(scaledPrice));
        console.log('Number of digits in scaled price:', scaledPrice.toString().length);

        // Check if the value exceeds common limits
        const MAX_UINT256 = BigInt(2) ** BigInt(256) - BigInt(1);
        const MAX_UINT128 = BigInt(2) ** BigInt(128) - BigInt(1);
        
        console.log('\n=== Boundary Analysis ===');
        console.log('Value exceeds uint128?', scaledPrice > MAX_UINT128);
        console.log('Value exceeds uint256?', scaledPrice > MAX_UINT256);
        
        // Decode the input data that would be sent to the contract
        const interface = new ethers.Interface(liquidityManagerABI);
        const calldata = interface.encodeFunctionData("adjustPrice", [scaledPrice]);
        
        console.log('\n=== Transaction Data Analysis ===');
        console.log('Function signature:', calldata.slice(0, 10));
        console.log('Encoded price parameter:', calldata.slice(10));
        
        // Try to decode any custom errors from the contract
        try {
            const customErrors = liquidityManagerABI
                .filter(item => item.type === 'error')
                .map(error => `${error.name}(${error.inputs.map(i => i.type).join(',')})`);
            
            console.log('\n=== Contract Custom Errors ===');
            console.log('Available error signatures:', customErrors);
        } catch (e) {
            console.log('No custom errors found in ABI');
        }

        return {
            currentPrice: currentPrice?.toString(),
            scaledPriceHex: ethers.toBeHex(scaledPrice),
            exceedsUint128: scaledPrice > MAX_UINT128,
            exceedsUint256: scaledPrice > MAX_UINT256,
            calldata
        };
    } catch (error) {
        console.error('Error during debug:', error);
        return null;
    }
}


function formatPriceForContract(price) {
    // Convert price to string and remove decimal point
    const priceString = price.toFixed(CONFIG.PRICE_PRECISION);
    const [whole, decimal = ""] = priceString.split(".");
    
    // Pad decimal part with zeros if needed
    const paddedDecimal = decimal.padEnd(CONFIG.PRICE_PRECISION, "0");
    
    // Combine whole and decimal parts
    const scaledPrice = whole + paddedDecimal;
    
    // Convert to BigInt with proper scaling for contract
    const finalScaling = CONFIG.PRICE_DECIMALS - CONFIG.PRICE_PRECISION;
    const scaledBigInt = BigInt(scaledPrice) * BigInt(10) ** BigInt(finalScaling);
    
    return scaledBigInt;
}
async function adjustLiquidity(price, wallet) {
    const contract = new ethers.Contract(
        process.env.LIQUIDITY_MANAGER_ADDRESS,
        liquidityManagerABI,
        wallet
    );
    const dai = process.env.DAITOKEN_ADDRESS;
    const ngna = process.env.NGNATOKEN_ADDRESS;
    const tokenAddress = dai;
    const tokenAddressed = ngna; // Replace with the address of the token (e.g., DAI)
    let firstCurrentPrice = await contract.getPoolPrice();
    const scaledPrice = ethers.parseUnits(price.toString(), CONFIG.PRICE_DECIMALS);
    const currentPrice = ethers.parseUnits(firstCurrentPrice.toString(), CONFIG.PRICE_DECIMALS);
    const amountNeeded = await contract.calculateSwapAmount(currentPrice, scaledPrice);
    const amountToTransfer = ethers.parseUnits(amountNeeded.toString(), CONFIG.PRICE_DECIMALS); // Adjust the scaling based on your contract requirements

    try {
        // Check and approve allowance if necessary
        await checkAndApproveAllowance(tokenAddress, process.env.LIQUIDITY_MANAGER_ADDRESS, amountToTransfer, wallet);
        await checkAndApproveAllowance(tokenAddressed, process.env.LIQUIDITY_MANAGER_ADDRESS, amountToTransfer, wallet);

        // Convert price to the correct format for the contract
        
        
        // Run debug analysis before attempting transaction
        await debugContractState(contract, price, scaledPrice);

        // Try to simulate the transaction first
        try {
            const callStatic = await contract.adjustPrice.staticCall(scaledPrice);
            console.log('\nStatic call succeeded:', callStatic);
        } catch (staticError) {
            console.error('\nStatic call failed:', staticError.message);
            
            // Extract more information from the error
            if (staticError.data) {
                console.log('Error data:', staticError.data);
                
                // Try to decode the error if it's a custom error
                try {
                    const decodedError = contract.interface.parseError(staticError.data);
                    console.log('Decoded error:', decodedError);
                } catch (e) {
                    console.log('Could not decode error data');
                }
            }

            throw staticError;
        }

        // Proceed with actual transaction
        console.log('\nProceeding with transaction...');
        const tx = await contract.adjustPrice(scaledPrice);
        console.log('Transaction sent:', tx.hash);
        
        const receipt = await tx.wait();
        console.log('Transaction confirmed:', receipt.transactionHash);

        return receipt;
    } catch (error) {
        console.error('\n=== Transaction Error Analysis ===');
        console.error('Error type:', error.code);
        console.error('Error message:', error.message);
        
        if (error.transaction) {
            console.error('\nTransaction details:');
            console.error('To:', error.transaction.to);
            console.error('From:', error.transaction.from);
            console.error('Data:', error.transaction.data);
        }
        
        if (error.error) {
            console.error('\nError details:');
            console.error('Error code:', error.error.code);
            console.error('Error data:', error.error.data);
        }
        
        // Try to identify the specific reason for overflow
        const priceAnalysis = analyzeOverflow(price, CONFIG.PRICE_DECIMALS);
        console.error('\nPrice analysis:', priceAnalysis);

        throw error;
    }
}
async function checkAndApproveAllowance(tokenAddress, spender, amount, wallet) {
    const token = new ethers.Contract(tokenAddress, [
        "function allowance(address owner, address spender) view returns (uint256)",
        "function approve(address spender, uint256 amount) public returns (bool)"
    ], wallet);

    try {
        // Get the current allowance
        const allowance = await token.allowance(wallet.address, spender);
        console.log(`Current allowance: ${ethers.formatUnits(allowance, CONFIG.PRICE_DECIMALS)} tokens`);

        // Check if allowance is less than the amount needed
        if (allowance < amount) {
            console.log("Allowance is not sufficient, approving tokens...");
            console.log('AMouhnt:', amount);
            const tx = await token.approve(spender, amount);
            console.log(`Approval transaction sent: ${tx.hash}`);

            const receipt = await tx.wait();
            console.log(`Approval confirmed in transaction: ${receipt.transactionHash}`);
        } else {
            console.log("Sufficient allowance already granted.");
        }
    } catch (error) {
        console.error("Error checking or approving allowance:", error);
        throw new Error(`Failed to check or approve allowance: ${error.message}`);
    }
}

function analyzeOverflow(price, decimals) {
    const analysis = {
        originalPrice: price,
        decimals: decimals,
        scientificNotation: Number(price).toExponential(),
        totalDigits: price.toString().replace('.', '').length,
        decimalPlaces: (price.toString().split('.')[1] || '').length
    };
    
    // Check various common limits
    const scaledValue = BigInt(Math.floor(price * 10 ** decimals));
    analysis.exceedsUint64 = scaledValue > BigInt(2) ** BigInt(64);
    analysis.exceedsUint128 = scaledValue > BigInt(2) ** BigInt(128);
    analysis.exceedsUint256 = scaledValue > BigInt(2) ** BigInt(256);
    
    return analysis;
}


async function main() {
    try {
        validateEnvironment();
        const { wallet } = setupProvider();

        const network = await wallet.provider.getNetwork();
        const balance = await wallet.provider.getBalance(wallet.address);
        
        console.log(`
Connected to network: ${network.name}
Chain ID: ${network.chainId}
Wallet balance: ${ethers.formatEther(balance)} ETH
        `);

        const price = await fetchNGNUSDPrice();
        await adjustLiquidity(price, wallet);

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
    fetchNGNUSDPrice,
    adjustLiquidity,
    validateEnvironment,
    setupProvider
};