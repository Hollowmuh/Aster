require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
    const pairAddress = process.env.NGNA_DAI_ADDRESS; // Uniswap V2 pair address
    const tokenA = process.env.NGNATOKEN_ADDRESS; // Token A address (e.g., NGNA)
    const tokenB = process.env.DAITOKEN_ADDRESS; // Token B address (e.g., DAI)
    const infura = process.env.INFURA_API_KEY;

    if (!pairAddress || !tokenA || !tokenB || !infura) {
        throw new Error("Please set NGNA_DAI_ADDRESS, NGNATOKEN_ADDRESS, DAITOKEN_ADDRESS, and INFURA_API_KEY in your .env file");
    }

    // ABI for Uniswap Pair
    const pairAbi = [
        "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
        "function token0() external view returns (address)",
        "function token1() external view returns (address)"
    ];

    // Provider
    const provider = new ethers.InfuraProvider("sepolia", infura);

    // Contract instance
    const pairContract = new ethers.Contract(pairAddress, pairAbi, provider);

    try {
        // Get token order in the pair
        const token0 = await pairContract.token0();
        const token1 = await pairContract.token1();

        // Get reserves
        const [reserve0, reserve1] = await pairContract.getReserves();

        // Convert reserves to JavaScript numbers with 18 decimals
        const adjustedReserve0 = ethers.formatUnits(reserve0, 18); // Reserve of token0
        const adjustedReserve1 = ethers.formatUnits(reserve1, 18); // Reserve of token1

        // Determine the order of the tokens and calculate the price
        let price;
        if (token0.toLowerCase() === tokenA.toLowerCase() && token1.toLowerCase() === tokenB.toLowerCase()) {
            price = adjustedReserve1 / adjustedReserve0; // Token A price in terms of Token B
            console.log(`Price of ${tokenA} in terms of ${tokenB}: ${price}`);
        } else if (token0.toLowerCase() === tokenB.toLowerCase() && token1.toLowerCase() === tokenA.toLowerCase()) {
            price = adjustedReserve0 / adjustedReserve1; // Token B price in terms of Token A
            console.log(`Prices of ${tokenB} in terms of ${tokenA}: ${price}`);
        } else {
            console.error("Provided token addresses do not match the pair contract.");
        }
    } catch (error) {
        console.error("Error fetching pair price:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
