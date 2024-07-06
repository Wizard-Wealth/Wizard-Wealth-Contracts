const hre = require("hardhat");
const Config = require("./config.js");

// Time lock Contract
const MIN_DELAY = 1; // 1 second

async function main() {
  // Configure output to config.json
  // await Config.initConfig();
  // const network = hre.hardhatArguments.network
  //   ? hre.hardhatArguments.network
  //   : "dev";
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account: ", deployer.address);

  // Deploy contract
  // Wizard Wealth Token Contract
  console.log("Deploying WizardWealth Contract ...");
  const token = await hre.ethers.deployContract("WizardWealth", []);
  await token.waitForDeployment();
  console.log(`WizardWealth address: ${token.target}`);
  // await Config.setConfig(network + ".WizardWealth", token.target);
  // GovernanceTimeLock & Governor Contract
  await token.delegate(deployer.address);
  const governanceTimeLockContract = await hre.ethers.deployContract(
    "GovernanceTimelock",
    [MIN_DELAY, [], [], deployer.address]
  );
  await governanceTimeLockContract.waitForDeployment();
  console.log(
    "Governance Time Lock Contract address: " +
      governanceTimeLockContract.target
  );
  // Config.setConfig(
  //   network + ".GovernanceTimelock",
  //   governanceTimeLockContract.target
  // );
  const governanceContract = await hre.ethers.deployContract(
    "GovernorContract",
    [
      token.target,
      governanceTimeLockContract.target,
      1,
      200,
      20000,
      4,
    ]
  );
  await governanceContract.waitForDeployment();
  console.log("Governance Contract address: " + governanceContract.target);
  // await Config.setConfig(network + ".Governor", governanceContract.target);
  // Staking Contract
  console.log("Deploying Staking Reward Contract...");
  const stakingContract = await hre.ethers.deployContract("StakingReward", [
    deployer.address,
    token.target,
    token.target,
  ]);
  await stakingContract.waitForDeployment();
  console.log("Staking Contract address: " + stakingContract.target);
  // await Config.setConfig(network + ".Staking", stakingContract.target);
  // Lending & Borrowing
  const lendingContract = await hre.ethers.deployContract("Lending", []);
  await lendingContract.waitForDeployment();
  console.log("Lending Contract address: " + lendingContract.target);
  // await Config.setConfig(network + ".Lending", lendingContract.target);

  // await Config.updateConfig();
}

main()
  .then(() => process.exit(1))
  .catch((error) => {
    console.error(error);
    process.exit(0);
  });
