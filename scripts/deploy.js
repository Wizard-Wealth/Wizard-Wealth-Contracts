const hre = require("hardhat");
const Config = require("./config.js");

async function main() {
  // Configure output to config.json
  await Config.initConfig();
  const network = hre.hardhatArguments.network
    ? hre.hardhatArguments.network
    : "dev";
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account: ", deployer.address);

  // Deploy contract
  // Wizard Wealth Token Contract
  console.log("Deploying WizardWealth Contract ...");
  const initialSupply = BigInt(1000000 * 10 ** 18);
  const token = await hre.ethers.deployContract("WizardWealth", [
    initialSupply,
  ]);
  await token.waitForDeployment();
  console.log(`WizardWealth address: ${token.target}`);
  Config.setConfig(network + ".WizardWealth", token.target);
  // Staking Contract
  console.log("Deploying Staking Reward Contract...");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(1))
  .catch((error) => {
    console.error(error);
    process.exit(0);
  });
