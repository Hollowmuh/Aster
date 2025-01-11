const axios = require("axios");
const { ethers } = require("ethers");
const dotenv = require("dotenv");
const { abi: liquidityManagerABI } = require("../artifacts/contracts/LiquidityManager.sol/LiquidityManager.json");

dotenv.config();

const CONFIG = {
    COINGECKO_API: "https://api.coingecko.com/api/v3/simple/price",
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 5000,
    PRICE_DECIMALS: 18,
    PRICE_PRECISION: 6
};

async function debugContractState(contract, price, scaledPrice) {
    try {
        console.log('\n=== Debug Contract State ===');
        
        // Get contract's current state (assuming these view functions exist)
        try {
            const currentPrice = await contract.getCurrentPrice();
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

async function adjustLiquidity(price, wallet) {
    const contract = new ethers.Contract(
        process.env.LIQUIDITY_MANAGER_ADDRESS,
        liquidityManagerABI,
        wallet
    );

    try {
        // Convert price to the correct format
        const scaledPrice = ethers.parseUnits(price.toString(), CONFIG.PRICE_DECIMALS);
        
        // Run debug analysis before attempting transaction
        await debugContractState(contract, price, scaledPrice);

        // Try to simulate the transaction first
        try {
            const callStatic = await contract.adjustPrice.staticCall(scaledPrice);
            console.log('\nStatic call succeeded:', callStatic);
        } catch (staticError) {
            console.error('\nStatic call failed:', staticError.message);
            
            // Try to extract more information from the error
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

// Rest of the code remains the same...

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