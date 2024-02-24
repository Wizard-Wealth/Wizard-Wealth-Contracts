const { expect } = require("chai");
const hre = require("hardhat");
const ethers = require("ethers");
const { constants, time } = require("@openzeppelin/test-helpers");
const helpers = require("@nomicfoundation/hardhat-network-helpers");

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
const proposalStates = [
  "Pending",
  "Active",
  "Canceled",
  "Defeated",
  "Succeeded",
  "Queued",
  "Expired",
  "Executed",
];

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
    const keepTokenPercentage = 5;
    wwTokenContract = await hre.ethers.deployContract("WizardWealth", [
      keepTokenPercentage,
    ]);
    await wwTokenContract.waitForDeployment();
    console.log(`WizardWealth address: ${wwTokenContract.target}`);
    // Delegate Governance Token
    await wwTokenContract.delegate(deployer.address);
    // Deploy Governance Time lock FContract
    governanceTimeLockContract = await hre.ethers.deployContract(
      "GovernanceTimelock",
      [MIN_DELAY, [], [], deployer.address]
    );
    await governanceTimeLockContract.waitForDeployment();
    console.log(
      "Governance Time Lock Contract address: " +
        governanceTimeLockContract.target
    );
    // Deploy Governor Contract
    governorContract = await hre.ethers.deployContract("GovernorContract", [
      wwTokenContract.target,
      governanceTimeLockContract.target,
    ]);
    await governorContract.waitForDeployment();
    console.log("Governance Contract address: " + governorContract.target);

    const proposerRole = await governanceTimeLockContract.PROPOSER_ROLE();
    const executorRole = await governanceTimeLockContract.EXECUTOR_ROLE();
    const adminRole = await governanceTimeLockContract.DEFAULT_ADMIN_ROLE();
    const proposerTx = await governanceTimeLockContract.grantRole(
      proposerRole,
      governorContract.target
    );
    await proposerTx.wait(1);
    const executorTx = await governanceTimeLockContract.grantRole(
      executorRole,
      ethers.getAddress(constants.ZERO_ADDRESS)
    );
    await executorTx.wait(1);
    const revokeTx = await governanceTimeLockContract.revokeRole(
      adminRole,
      deployer.address
    );
    await revokeTx.wait(1);

    // Deploy Contract to be Governed -> In this case, it's Box Contract
    boxContract = await hre.ethers.deployContract("BoxTest", []);
    await boxContract.waitForDeployment();
    console.log("BoxTest Contract address: " + boxContract.target);

    // Transfer ownership of BoxTest Contract to TimeLock Contract
    const tx = await boxContract.transferOwnership(governanceTimeLockContract);
    await tx.wait(1);
  });

  it("Should create a Proposal Successfully", async () => {
    const value = 10;
    const boxInterface = new hre.ethers.Interface(BoxABI.abi);
    const encodedFunction = boxInterface.encodeFunctionData("store", [value]);
    const PROPOSAL_DESCRIPTION = "Change the value of Box Contract";
    const createProposalTx = await governorContract.propose(
      [boxContract.target],
      [0],
      [encodedFunction],
      PROPOSAL_DESCRIPTION
    );
    const createProposalTxReceipt = await createProposalTx.wait(1);

    // TestCase: Testing the arguments when passing the propose() function is correct or not.
    expect(createProposalTxReceipt.logs[0].args.targets[0]).to.equal(
      boxContract.target
    );
    expect(createProposalTxReceipt.logs[0].args.calldatas[0]).to.equal(
      encodedFunction
    );
    expect(createProposalTxReceipt.logs[0].args.description).to.equal(
      PROPOSAL_DESCRIPTION
    );

    // TestCase: Testing the proposalId of latest created Proposal is valid or not.
    const proposalId = createProposalTxReceipt.logs[0].args.proposalId;
    await expect(await governorContract.state(proposalId)).to.not.be.reverted;

    // TestCase: Testing the status of the proposal is equal "Pending" or not.
    const proposalStatus =
      proposalStates[await governorContract.state(proposalId)];
    expect(proposalStatus).to.equal("Pending");
  });

  describe("Casting a vote", () => {
    let proposalId;
    beforeEach(async () => {
      // Creating a new proposal
      const value = 10;
      const boxInterface = new hre.ethers.Interface(BoxABI.abi);
      const encodedFunction = boxInterface.encodeFunctionData(
        boxInterface.getFunction("store"),
        [value]
      );
      const PROPOSAL_DESCRIPTION = "Change the value of Box Contract";
      const createProposalTx = await governorContract.propose(
        [boxContract.target],
        [0],
        [encodedFunction],
        PROPOSAL_DESCRIPTION
      );
      const createProposalTxReceipt = await createProposalTx.wait(1);
      proposalId = createProposalTxReceipt.logs[0].args.proposalId;

      // Mine more 1 block
      await hre.network.provider.send("evm_mine");
    });
    describe("Vote Successfully", () => {
      beforeEach(async () => {
        // Mine more 1 block
        await hre.network.provider.send("evm_mine");
      });
      describe("Vote with reason", () => {
        it("Should vote In-favor for a created proposal with reason successfully", async () => {
          const reasonForVoting = "In-favor proposal #1";
          expect(await governorContract.state(proposalId)).to.equal(1n);
          expect(
            await governorContract.castVoteWithReason(
              proposalId,
              1,
              reasonForVoting
            )
          ).to.not.be.reverted;
        });
        it("Should vote Against for a created proposal with reason successfully", async () => {
          const reasonForVoting = "Against proposal #1";
          expect(await governorContract.state(proposalId)).to.equal(1n);
          expect(
            await governorContract.castVoteWithReason(
              proposalId,
              0,
              reasonForVoting
            )
          ).to.not.be.reverted;
        });
        it("Should vote Abstain for a created proposal with reason successfully", async () => {
          const reasonForVoting = "Abstain proposal #1";
          expect(await governorContract.state(proposalId)).to.equal(1n);
          expect(
            await governorContract.castVoteWithReason(
              proposalId,
              2,
              reasonForVoting
            )
          ).to.not.be.reverted;
        });
      });
      describe("Vote without reason", () => {
        it("Should vote In-favor for a created proposal without reason successfully", async () => {
          expect(await governorContract.state(proposalId)).to.equal(1n);
          expect(await governorContract.castVote(proposalId, 1)).to.not.be
            .reverted;
        });
        it("Should vote Against for a created proposal without reason successfully", async () => {
          expect(await governorContract.state(proposalId)).to.equal(1n);
          expect(await governorContract.castVote(proposalId, 0)).to.not.be
            .reverted;
        });
        it("Should vote Abstain for a created proposal without reason successfully", async () => {
          expect(await governorContract.state(proposalId)).to.equal(1n);
          expect(await governorContract.castVote(proposalId, 2)).to.not.be
            .reverted;
        });
      });
    });
  });

  describe("Executing Proposal", () => {
    let value,
      encodedFunction,
      proposalDescription,
      proposalId,
      convertedProposalDescription;
    beforeEach(async () => {
      // Creating a new proposal
      value = 10;
      encodedFunction = boxContract.interface.encodeFunctionData("store", [
        value,
      ]);
      proposalDescription = "Change the value of Box Contract";
      const createProposalTx = await governorContract.propose(
        [boxContract.target],
        [0],
        [encodedFunction],
        proposalDescription
      );
      const createProposalTxReceipt = await createProposalTx.wait(1);
      proposalId = createProposalTxReceipt.logs[0].args.proposalId;

      // Mine more 1 block
      await hre.network.provider.send("evm_mine");
    });
    describe("Before Voting Ending", () => {
      beforeEach(async () => {
        // Casting a vote
        const reasonForVoting = "In-favor proposal #1";
        await governorContract.castVoteWithReason(
          proposalId,
          1,
          reasonForVoting
        );
        // Converting String => Bytes32
        convertedProposalDescription = hre.ethers.keccak256(
          hre.ethers.toUtf8Bytes(proposalDescription)
        );
      });
      it("Should be the reverted transaction when calling execute() function", async () => {
        // Executing the proposal
        await expect(
          governorContract.execute(
            [boxContract.target],
            [0],
            [encodedFunction],
            convertedProposalDescription
          )
        ).to.be.reverted;
      });
    });
    describe("After Voting Ending", () => {
      beforeEach(async () => {
        // Casting a vote
        const reasonForVoting = "In-favor proposal #1";
        await governorContract.castVoteWithReason(
          proposalId,
          1,
          reasonForVoting
        );
        // Converting String => Bytes32
        convertedProposalDescription = hre.ethers.keccak256(
          hre.ethers.toUtf8Bytes(proposalDescription)
        );
      });
      it("Should be not reverted the transaction when executing the proposal with Queued State", async () => {
        // Mined more 50 blocks to finish the voting process
        for (let i = 0; i < 50; i++) {
          await hre.network.provider.send("evm_mine");
        }
        // Queueing the proposal
        let queueTx;
        await expect(
          (queueTx = await governorContract.queue(
            [boxContract.target],
            [0],
            [encodedFunction],
            convertedProposalDescription
          ))
        ).to.not.be.reverted;
        await queueTx.wait(1);

        // Executing the proposal
        await expect(
          governorContract.execute(
            [boxContract.target],
            [0],
            [encodedFunction],
            convertedProposalDescription
          )
        ).to.not.be.reverted;
        // Check: The value is changed or not.
        expect(await boxContract.retrieve()).to.equal(value);
      });
    });
  });
});
