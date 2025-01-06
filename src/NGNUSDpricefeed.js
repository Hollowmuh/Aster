import axios from 'axios';
import Web3 from 'web3';
import dotenv from 'dotenv';
import { abi as liquidityManagerABI } from './LiquidityManagerABI.json'; // Replace with your contract ABI

// Load environment variables
dotenv.config();

// Constants
const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price';
const web3 = new Web3(`https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_ID}`); // Infura endpoint
const privateKey = process.env.PRIVATE_KEY; // Your wallet private key
const liquidityManagerAddress = process.env.CONTRACT_ADDRESS; // Deployed LiquidityManager contract address
const account = web3.eth.accounts.wallet.add(privateKey).address;

// Function to fetch NGN/USD price from CoinGecko
async function fetchNGNUSDPrice() {
    try {
        const options = {
            method: 'GET',
            url: COINGECKO_API,
            params: { ids: 'dai', vs_currencies: 'ngn' },
            headers: {
                accept: 'application/json',
                'x-cg-pro-api-key': process.env.COINGECKO_API_KEY, // API Key from .env
            },
        };

        const response = await axios.request(options);
        const price = response.data['dai'].ngn;
        console.log(`Fetched DAI/NGN Price: ${price}`);
        return price;
    } catch (error) {
        console.error('Error fetching price from CoinGecko:', error);
        throw error;
    }
}

// Function to adjust liquidity on Uniswap
async function adjustLiquidity(price) {
    try {
        const contract = new web3.eth.Contract(liquidityManagerABI, liquidityManagerAddress);

        // Prepare transaction data
        const txData = contract.methods.adjustPrice(Math.floor(price * 1e18)).encodeABI();

        // Build transaction
        const tx = {
            to: liquidityManagerAddress,
            data: txData,
            gas: 300000, // Estimate gas as required
            chainId: 11155111, // Sepolia network ID
        };

        // Sign and send the transaction
        const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        console.log('Liquidity adjusted successfully:', receipt.transactionHash);
    } catch (error) {
        console.error('Error adjusting liquidity:', error);
    }
}

// Main function to fetch price and adjust liquidity
(async () => {
    try {
        const price = await fetchNGNUSDPrice(); // Fetch the NGN/USD price
        await adjustLiquidity(price); // Adjust liquidity based on the price
    } catch (error) {
        console.error('Error in the process:', error);
    }
})();
