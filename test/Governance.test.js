const { expect } = require("chai");
const hre = require("hardhat");
const ethers = require("ethers");
const { constants } = require("@openzeppelin/test-helpers");

// Governor Contract
const QUORUM_PERCENTAGE = 4; // 4%
const VOTING_PERIOD = 50400; // 1 week = 50400 blocks
const VOTING_DELAY = 1; // 1 block
// Time lock Contract
const MIN_DELAY = 1; // 1 second
// Proposal
// const PROPOSAL_DESCRIPTION = "Proposal #1: Store 1 in the Box!";
// const NEW_STORE_VALUE = 5;

describe("Testing Governance Contract", () => {
  let deployer,
    governor,
    signers,
    governorContract,
    governanceTimeLockContract,
    wwTokenContract;
  beforeEach(async () => {
    [deployer, governor, ...signers] = await hre.ethers.getSigners();
    // Deploy Governance Token (WizardWealth) Contract
    console.log("Deploying WizardWealth Contract ...");
    const initialSupply = BigInt(1000000 * 10 ** 18);
    wwTokenContract = await hre.ethers.deployContract("WizardWealth", [
      initialSupply,
    ]);
    await wwTokenContract.waitForDeployment();
    console.log(`WizardWealth address: ${wwTokenContract.target}`);
    // Delegate Governance Token
    await wwTokenContract.delegate(deployer);
    // Deploy Governance Time lock FContract
    console.log("Deploying Governance Time Lock Contract ...");
    governanceTimeLockContract = await hre.ethers.deployContract(
      "GovernanceTimelock",
      [MIN_DELAY, [], []]
    );
    await governanceTimeLockContract.waitForDeployment();
    console.log(
      "Governance Time Lock Contract address: " +
        governanceTimeLockContract.target
    );
    // Deploy Governance Contract
    console.log("Deploying Governance Contract ...");
    governorContract = await hre.ethers.deployContract("GovernanceContract", [
      wwTokenContract.target,
      governanceTimeLockContract.target,
    ]);
    await governorContract.waitForDeployment();
    console.log("Governance Contract address: " + governorContract.target);
  });

  it("Create a Proposal", async () => {
    const proposerRole = await governanceTimeLockContract.PROPOSER_ROLE();
    const executorRole = await governanceTimeLockContract.EXECUTOR_ROLE();
    const adminRole = await governanceTimeLockContract.DEFAULT_ADMIN_ROLE();
    await governanceTimeLockContract.grantRole(proposerRole, governor.address);
    await governanceTimeLockContract.grantRole(
      executorRole,
      ethers.getAddress(constants.ZERO_ADDRESS)
    );
    const tx = await governanceTimeLockContract.revokeRole(
      adminRole,
      deployer.address
    );
    await tx.wait(1);
    const signer = await hre.ethers.getSigner();
    // const proposalId =
  });
});
