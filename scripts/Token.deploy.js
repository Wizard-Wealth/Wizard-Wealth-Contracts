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

  console.log("Deploying Token Contract...");
  // Deploy contract
  const keepTokenPercentage = 70;
  // Wizard Wealth Token Contract
  console.log("Deploying WizardWealth Contract ...");
  const token = await hre.ethers.deployContract("WizardWealth", [
    keepTokenPercentage,
  ]);
  await token.waitForDeployment();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(1))
  .catch((error) => {
    console.error(error);
    process.exit(0);
  });
