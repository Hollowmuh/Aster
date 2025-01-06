require('dotenv').config();
const { ethers } = require("hardhat");

async function main() {
    // Retrieve deployer's private key from .env
    const deployerPrivateKey = process.env.PRIVATE_KEY;
    if (!deployerPrivateKey) {
        throw new Error("Please set your PRIVATE_KEY in a .env file");
    }

    const ProjectId = process.env.ALCHEMY_ID;
    if (!ProjectId) {
        throw new Error("Please set your PROJECT_ID in a .env file");
    }

    // Configure provider and wallet
    const provider = new ethers.providers.InfuraProvider("sepolia", ProjectId);
    const wallet = new ethers.Wallet(deployerPrivateKey, provider);

    // Get the contract factory
    const NGNAToken = await ethers.getContractFactory("NGNAToken", wallet);

    console.log("Deploying NGNAToken contract...");

    // Deploy the contract
    const ngnaToken = await NGNAToken.deploy();

    // Wait for deployment to complete
    await ngnaToken.deployed();

    console.log("NGNAToken deployed to:", ngnaToken.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
