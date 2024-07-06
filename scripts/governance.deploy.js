const hre = require("hardhat");
const Config = require("./config.js");

// Time lock Contract
const MIN_DELAY = 1; // 1 second

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account: ", deployer.address);

  // GovernanceTimeLock & Governor Contract
  const governanceTimeLockContract = await hre.ethers.deployContract(
    "GovernanceTimelock",
    [MIN_DELAY, [], [], deployer.address]
  );
  await governanceTimeLockContract.waitForDeployment();
  console.log(
    "Governance Time Lock Contract address: " +
      governanceTimeLockContract.target
  );

  const token = "0x6F1e1b36164a8bCc048F5a295FbDb02F00CF36D3";

  const governanceContract = await hre.ethers.deployContract(
    "GovernorContract",
    [
      token,
      governanceTimeLockContract.target,
      1,
      200,
      20000,
      4,
    ]
  );
  await governanceContract.waitForDeployment();
  console.log("Governance Contract address: " + governanceContract.target);
}

main()
  .then(() => process.exit(1))
  .catch((error) => {
    console.error(error);
    process.exit(0);
  });
