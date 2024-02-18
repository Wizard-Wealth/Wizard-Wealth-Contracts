const { assert, expect } = require("chai");
const { network, deployments, ethers } = require("hardhat");
const { developmentChains } = require("../helpers/helper-hardhat-config");
const { moveBlocks } = require("../utils/move-blocks");
const { moveTime } = require("../utils/move-time");

const SECONDS_IN_A_DAY = 86400;
const SECONDS_IN_A_YEAR = 31449600;

describe("Staking Unit Tests", () => {
  let staking, rewardToken, deployer, dai, eth, stakeAmount;
  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    deployer = accounts[0];
    // ETH Token Contract
    eth = await ethers.getContractAt(
      [
        // Add ABI (Application Binary Interface) for the ERC-20 standard
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
      ],
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      deployer
    );
    // Reward Token Contract
    rewardToken = await ethers.deployContract("WizardWealth", [10]);
    await rewardToken.waitForDeployment();
    // Staking Contract
    staking = await ethers.deployContract("StakingReward", [
      deployer.address,
      rewardToken.target,
      rewardToken.target,
    ]);
    stakeAmount = ethers.parseEther("100000");
  });
  describe("Constructor", () => {
    it("Sets the rewards token address correctly", async () => {
      const response = await staking.rewardsToken();
      assert.equal(response, rewardToken.target);
    });
    it("Sets the staking token address correctly", async () => {
      const response = await staking.stakingToken();
      assert.equal(response, rewardToken.target);
    });
    it("Sets the owner's contract correctly", async () => {
      const response = await staking.owner();
      assert.equal(response, deployer.address);
    });
  });

  describe("RewardPerToken", () => {
    it("Returns the reward amount of 1 token based time spent locked up", async () => {
      await rewardToken.approve(staking.target, stakeAmount);
      await staking.stake(stakeAmount);
      const balanceStaking = await staking.balanceOf(deployer.address);
      assert.equal(stakeAmount.toString(), balanceStaking);

      const totalSupply = await staking.totalSupply();
      assert.equal(stakeAmount.toString(), totalSupply);

      await moveTime(SECONDS_IN_A_DAY);
      await moveBlocks(1);
      let reward = await staking.rewardPerToken();
      let expectedReward = "86";
      assert.equal(reward.toString(), expectedReward);

      await moveTime(SECONDS_IN_A_YEAR);
      await moveBlocks(1);
      reward = await staking.rewardPerToken();
      expectedReward = "31536";
      assert.equal(reward.toString(), expectedReward);
    });
  });
});
