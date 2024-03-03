require("dotenv").config();
const hre = require("hardhat");
// const Config = require("./config.js");

async function main() {
  // Configure output to config.json
  // await Config.initConfig();
  // const network = hre.hardhatArguments.network
  //   ? hre.hardhatArguments.network
  //   : "dev";
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account: ", deployer.address);

  // Deploy contract
  console.log("Deploying Swap Contract ...");
  const swapContract = await hre.ethers.deployContract("SwapContract", [
    "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  ]);
  await swapContract.waitForDeployment();
  console.log(`SwapContract address: ${swapContract.target}`);
  // Config.setConfig(network + ".SwapContract", token.target);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(1))
  .catch((error) => {
    console.error(error);
    process.exit(0);
  });
