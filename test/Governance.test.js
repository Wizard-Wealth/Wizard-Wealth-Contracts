const { expect } = require("chai");
const hre = require("hardhat");
const ethers = require("ethers");
const { constants } = require("@openzeppelin/test-helpers");
const GovernorContractABI = require("../artifacts/contracts/governance/GovernorContract.sol/GovernorContract.json");
const BoxABI = require("../artifacts/contracts/BoxTest.sol/BoxTest.json");

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
    boxContract,
    wwTokenContract;
  beforeEach(async () => {
    [deployer, governor, ...signers] = await hre.ethers.getSigners();
    // Deploy Governance Token (WizardWealth) Contract
    console.log("Deploying WizardWealth Contract ...");
    const keepTokenPercentage = 5;
    wwTokenContract = await hre.ethers.deployContract("WizardWealth", [
      keepTokenPercentage,
    ]);
    await wwTokenContract.waitForDeployment();
    console.log(`WizardWealth address: ${wwTokenContract.target}`);
    // Delegate Governance Token
    await wwTokenContract.delegate(deployer);
    // Deploy Governance Time lock FContract
    console.log("Deploying Governance Time Lock Contract ...");
    governanceTimeLockContract = await hre.ethers.deployContract(
      "GovernanceTimelock",
      [MIN_DELAY, [], [], deployer]
    );
    await governanceTimeLockContract.waitForDeployment();
    console.log(
      "Governance Time Lock Contract address: " +
        governanceTimeLockContract.target
    );
    // Deploy Governor Contract
    console.log("Deploying Governor Contract ...");
    governorContract = await hre.ethers.deployContract("GovernorContract", [
      wwTokenContract.target,
      governanceTimeLockContract.target,
    ]);
    await governorContract.waitForDeployment();
    console.log("Governance Contract address: " + governorContract.target);

    const proposerRole = await governanceTimeLockContract.PROPOSER_ROLE();
    const executorRole = await governanceTimeLockContract.EXECUTOR_ROLE();
    const adminRole = await governanceTimeLockContract.DEFAULT_ADMIN_ROLE();
    await governanceTimeLockContract.grantRole(proposerRole, governor.address);
    await governanceTimeLockContract.grantRole(
      executorRole,
      ethers.getAddress(constants.ZERO_ADDRESS)
    );

    // Deploy Contract to be Governed -> Box Contract
    boxContract = await hre.ethers.deployContract("BoxTest", []);
    await boxContract.waitForDeployment();
    console.log("BoxTest Contract address: " + boxContract.target);

    // Transfer ownership of BoxTest Contract to TimeLock Contract
    const tx = await boxContract.transferOwnership(governanceTimeLockContract);
    await tx.wait(1);
  });

  it("Create a Proposal", async () => {
    const value = 10;
    const boxInterface = new hre.ethers.Interface(BoxABI.abi);
    const encodedFunction = boxInterface.encodeFunctionData("store", [value]);
    const PROPOSAL_DESCRIPTION = "Change the value of Box Contract";
    const createProposalTx = await governorContract.propose(
      [boxContract.target],
      [value],
      [encodedFunction],
      PROPOSAL_DESCRIPTION
    );
    const createProposalTxReceipt = await createProposalTx.wait(1);

    expect(createProposalTxReceipt.logs[0].args.targets[0]).to.equal(
      boxContract.target
    );
    // expect(createProposalTxReceipt.logs[0].args.values[0]).to.equal(value);
    expect(createProposalTxReceipt.logs[0].args.calldatas[0]).to.equal(
      encodedFunction
    );
    expect(createProposalTxReceipt.logs[0].args.description).to.equal(
      PROPOSAL_DESCRIPTION
    );
    const proposalId = createProposalTxReceipt.logs[0].args.proposalId;
    await expect(await governorContract.state(proposalId)).to.not.be.reverted;
  });
});
