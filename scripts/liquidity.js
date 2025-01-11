require("dotenv").config();
const { ethers } = require("hardhat");

// Contract ABIs
const AddLiquidityABI = require("../artifacts/contracts/NGNAliquidity.sol/AddLiquidity.json").abi;
const LiquidityManagerABI = require("../artifacts/contracts/LiquidityManager.sol/LiquidityManager.json").abi;
const ERC20ABI = require("@openzeppelin/contracts/build/contracts/ERC20.json").abi;

// Validate environment variables
function validateConfig() {
    const requiredEnvVars = {
        ADD_LIQUIDITY_ADDRESS: process.env.ADD_LIQUIDITY_ADDRESS,
        LIQUIDITY_MANAGER_ADDRESS: process.env.LIQUIDITY_MANAGER_ADDRESS,
        NGNA_ADDRESS: process.env.NGNATOKEN_ADDRESS,
        USDT_ADDRESS: process.env.USDTTOKEN_ADDRESS,
        DAI_ADDRESS: process.env.DAITOKEN_ADDRESS,
        UNISWAP_ROUTER_ADDRESS: process.env.UNISWAP_ROUTER_ADDRESS,
        PRIVATE_KEY: process.env.PRIVATE_KEY,
        ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY
    };

    const missingVars = [];
    for (const [key, value] of Object.entries(requiredEnvVars)) {
        if (!value) {
            missingVars.push(key);
        }
    }

    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(", ")}`);
    }

    return requiredEnvVars;
}

// Configuration
const config = validateConfig();

// Helper function to validate address
function validateAddress(address, name) {
    if (!address || !ethers.isAddress(address)) {
        throw new Error(`Invalid ${name} address: ${address}`);
    }
    return address;
}

// Helper function to get contract instances
async function getContracts(signer) {
    try {
        // Validate addresses before creating contract instances
        const addLiquidityAddress = validateAddress(config.ADD_LIQUIDITY_ADDRESS, "AddLiquidity");
        const liquidityManagerAddress = validateAddress(config.LIQUIDITY_MANAGER_ADDRESS, "LiquidityManager");
        const ngnaAddress = validateAddress(config.NGNA_ADDRESS, "NGNA");
        const usdtAddress = validateAddress(config.USDT_ADDRESS, "USDT");
        const daiAddress = validateAddress(config.DAI_ADDRESS, "DAI");

        console.log("Creating contract instances...");
        console.log(`AddLiquidity address: ${addLiquidityAddress}`);
        console.log(`NGNA address: ${ngnaAddress}`);
        console.log(`USDT address: ${usdtAddress}`);
        console.log(`DAI address: ${daiAddress}`);

        const addLiquidity = new ethers.Contract(
            addLiquidityAddress,
            AddLiquidityABI,
            signer
        );

        const liquidityManager = new ethers.Contract(
            liquidityManagerAddress,
            LiquidityManagerABI,
            signer
        );

        const ngnaToken = new ethers.Contract(
            ngnaAddress,
            ERC20ABI,
            signer
        );

        const usdtToken = new ethers.Contract(
            usdtAddress,
            ERC20ABI,
            signer
        );

        const daiToken = new ethers.Contract(
            daiAddress,
            ERC20ABI,
            signer
        );

        return {
            addLiquidity,
            liquidityManager,
            ngnaToken,
            usdtToken,
            daiToken
        };
    } catch (error) {
        console.error("Error creating contract instances:", error);
        throw error;
    }
}

// Add Liquidity using AddLiquidity contract
async function addInitialLiquidity({
    ngnaAmount,
    usdtAmount,
    daiAmount,
    minNGNA,
    minUSDT,
    minDAI,
    useUsdt = true
}) {
    try {
        console.log("Setting up provider and signer...");
        const provider = new ethers.AlchemyProvider("sepolia", config.ALCHEMY_API_KEY);
        const signer = new ethers.Wallet(config.PRIVATE_KEY, provider);
        
        console.log("Getting contract instances...");
        const {
            addLiquidity,
            ngnaToken,
            usdtToken,
            daiToken
        } = await getContracts(signer);

        // Verify contract deployment
        const code = await provider.getCode(addLiquidity.target);
        if (code === "0x") {
            throw new Error("AddLiquidity contract not deployed at the specified address");
        }

        console.log("Approving tokens...");
        
        // Approve NGNA
        const ngnaTx = await ngnaToken.approve(
            addLiquidity.target,
            ngnaAmount
        );
        await ngnaTx.wait();
        console.log("NGNA approved");

        // Approve USDT/DAI
        if (useUsdt) {
            const usdtTx = await usdtToken.approve(
                addLiquidity.target,
                usdtAmount
            );
            await usdtTx.wait();
            console.log("USDT approved");

            console.log("Adding NGNA/USDT liquidity...");
            const tx = await addLiquidity.addLiquidityNGNAUSDT(
                ngnaAmount,
                usdtAmount,
                minNGNA,
                minUSDT,
            );
            const receipt = await tx.wait();
            console.log(`Liquidity added! TX: ${receipt.hash}`);
        } else {
            const daiTx = await daiToken.approve(
                addLiquidity.target,
                daiAmount
            );
            await daiTx.wait();
            console.log("DAI approved");

            console.log("Adding NGNA/DAI liquidity...");
            const tx = await addLiquidity.addLiquidityNGNADAI(
                ngnaAmount,
                daiAmount,
                minNGNA,
                minDAI,
            );
            const receipt = await tx.wait();
            console.log(`Liquidity added! TX: ${receipt.hash}`);
        }
    } catch (error) {
        console.error("Error adding liquidity:", error);
        throw error;
    }
}

// Example usage
async function main() {
    try {
        console.log("Starting liquidity addition process...");
        
        // Add NGNA/USDT Liquidity
        await addInitialLiquidity({
            ngnaAmount: ethers.parseUnits("11000000", 18), // 1000 NGNA
            usdtAmount: ethers.parseUnits("10000", 18),  // 1000 USDT (6 decimals)
            minNGNA: ethers.parseUnits("100000", 18),
            minUSDT: ethers.parseUnits("1000", 18),
            useUsdt: true
        });

        // Add NGNA/DAI Liquidity
        await addInitialLiquidity({
            ngnaAmount: ethers.parseUnits("55000000", 18), // 1000 NGNA
            daiAmount: ethers.parseUnits("600000", 18),  // 1000 DAI
            minNGNA: ethers.parseUnits("100000", 18),
            minDAI: ethers.parseUnits("1000", 18),
            useUsdt: false
        });

    } catch (error) {
        console.error("Error in main:", error);
        throw error;
    }
}

// Execute script
if (require.main === module) {
    main()
        .then(() => {
            console.log("Script completed successfully");
            process.exit(0);
        })
        .catch(error => {
            console.error("Script failed:", error);
            process.exit(1);
        });
}

module.exports = {
    addInitialLiquidity,
    validateConfig,
    getContracts
};