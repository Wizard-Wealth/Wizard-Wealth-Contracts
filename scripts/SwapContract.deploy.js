require("dotenv").config();
const hre = require("hardhat");
const Config = require("./config.js");

async function main() {
  // Configure output to config.json
  await Config.initConfig();
  const network = hre.hardhatArguments.network
    ? hre.hardhatArguments.network
    : "dev";
  console.log(network);
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account: ", deployer.address);

  console.log("Deploying Swap Contract...");
  const RouterV2 = "0x86dcd3293c53cf8efd7303b57beb2a3f671dde98";
  const WETH = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";

  const swapContract = await hre.ethers.deployContract("SwapContract", [
    RouterV2,
    WETH,
  ]);
  await swapContract.waitForDeployment();
  console.log("Swap Contract address: " + swapContract.target);
  await Config.setConfig(network + ".Swap", swapContract.target);
  await Config.updateConfig();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(1))
  .catch((error) => {
    console.error(error);
    process.exit(0);
  });
