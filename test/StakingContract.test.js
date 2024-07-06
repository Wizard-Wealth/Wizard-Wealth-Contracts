const { assert, expect } = require("chai");
const { network, deployments, ethers } = require("hardhat");
const { developmentChains } = require("../helpers/helper-hardhat-config");
const { moveBlocks } = require("../utils/move-blocks");
const { moveTime } = require("../utils/move-time");

const SECONDS_IN_A_DAY = 86400;
const SECONDS_IN_A_WEEK = 604800;
const SECONDS_IN_A_YEAR = 31449600;
const ZERO_BN = ethers.parseEther("0");

describe("Staking Unit Tests", () => {
  let staking,
    rewardToken,
    deployer,
    player,
    accounts,
    stakeAmount,
    firstNotifyAmount;
  beforeEach(async () => {
    [deployer, player, ...accounts] = await ethers.getSigners();
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
    stakeAmount = ethers.parseEther("1");
    firstNotifyAmount = ethers.parseEther(
      (SECONDS_IN_A_WEEK / 200000).toString()
    );
    console.log(firstNotifyAmount);
    // Transfer the reward token to the Staking Smart Contract
    await rewardToken.transfer(staking.target, firstNotifyAmount);
    // Owner call the notifyRewardAmount to update the reward rate
    await staking.notifyRewardAmount(firstNotifyAmount);
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

  describe("rewardPerToken()", () => {
    it("Should return 0", async () => {
      assert.equal(await staking.rewardPerToken(), ZERO_BN);
    });
    it("Returns the reward amount of 1 token after 1 week", async () => {
      const rewardRate = await staking.rewardRate();

      await rewardToken.approve(staking.target, stakeAmount);
      await staking.stake(stakeAmount);

      const balanceStaking = await staking.balanceOf(deployer.address);
      assert.equal(stakeAmount.toString(), balanceStaking);

      const totalSupply = await staking.totalSupply();
      assert.equal(stakeAmount.toString(), totalSupply);

      await moveTime(SECONDS_IN_A_WEEK);
      await moveBlocks(1);
      const reward = await staking.rewardPerToken();

      const expectReward =
        ZERO_BN +
        (rewardRate * BigInt(SECONDS_IN_A_WEEK - 2) * ethers.parseEther("1")) /
          totalSupply;
      assert.equal(reward.toString(), expectReward.toString());
    });
  });
  describe("stake()", () => {
    it("Staking increases Staking Balance", async () => {
      const amountToStake = ethers.parseEther("100");
      await rewardToken.transfer(player.address, amountToStake);
      await rewardToken.connect(player).approve(staking.target, amountToStake);

      const initialStakeBalance = await staking.balanceOf(player.address);
      const initialLPBalance = await rewardToken.balanceOf(player.address);

      await staking.connect(player).stake(amountToStake);

      const postStakeBalance = await staking.balanceOf(player.address);
      const postLPBalance = await rewardToken.balanceOf(player.address);

      assert.equal(postStakeBalance.toString(), initialLPBalance.toString());
      assert.equal(postLPBalance.toString(), initialStakeBalance.toString());
    });
    it("Can not stake 0 tokens", async () => {
      await expect(staking.stake(0)).to.be.revertedWith(
        "Amount must be greater than zero"
      );
    });
  });
  describe("earned()", () => {
    it("Should be 0 when not staking", async () => {
      expect(await staking.earned(player.address)).equal(ZERO_BN);
    });
    it("Should be > 0 when staking", async () => {
      const amountToStake = ethers.parseEther("1");
      const rewardRate = await staking.rewardRate();

      await rewardToken.transfer(player.address, amountToStake);
      await rewardToken.connect(player).approve(staking.target, amountToStake);

      await staking.connect(player).stake(amountToStake);
      const totalSupply = await staking.totalSupply();
      const balancePlayer = await staking.balanceOf(player.address);

      await moveTime(SECONDS_IN_A_WEEK);
      await moveBlocks(1);

      const earnedTokenAmount = await staking.earned(player.address);
      console.log(earnedTokenAmount);

      const threadBetweenTwoTransactions = 3;

      const rewardPerToken =
        ZERO_BN +
        (rewardRate *
          BigInt(SECONDS_IN_A_WEEK - threadBetweenTwoTransactions) *
          ethers.parseEther("1")) /
          totalSupply;

      const expectedAmount =
        (balancePlayer * (rewardPerToken - ethers.parseEther("0"))) /
          ethers.parseEther("1") +
        (await staking.rewards(player.address));

      expect(earnedTokenAmount).to.equal(expectedAmount);
    });
    it("The Reward Rate increase if new reward comes before Duration end", async () => {
      const rewardRateInitial = await staking.rewardRate();
      await rewardToken.transfer(staking.target, firstNotifyAmount);
      await staking.notifyRewardAmount(firstNotifyAmount);
      const rewardRateAfter = await staking.rewardRate();

      expect(rewardRateAfter).greaterThan(ZERO_BN);
      expect(rewardRateAfter).greaterThan(rewardRateInitial);
    });
    it("Rewards token balance should roll over after duration ", async () => {
      const amountToStake = ethers.parseEther("100");
      await rewardToken.transfer(player.address, amountToStake);
      await rewardToken.connect(player).approve(staking.target, amountToStake);

      await staking.connect(player).stake(amountToStake);

      await moveTime(SECONDS_IN_A_WEEK - 3);
      await moveBlocks(1);
      const earnedTokenAmount = await staking.earned(player.address);
      console.log(earnedTokenAmount);

      await rewardToken.transfer(staking.target, firstNotifyAmount);
      await staking.notifyRewardAmount(firstNotifyAmount);

      await moveTime(SECONDS_IN_A_WEEK - 3);
      await moveBlocks(1);
      const earnedTokenAmountAfter = await staking.earned(player.address);
      console.log(earnedTokenAmountAfter);

      expect(earnedTokenAmountAfter).equal(
        earnedTokenAmount + earnedTokenAmount
      );
    });
  });
  describe("getReward()", () => {
    it("Should increase the token balance", async () => {
      await rewardToken.transfer(player.address, stakeAmount);
      await rewardToken.connect(player).approve(staking.target, stakeAmount);
      await staking.connect(player).stake(stakeAmount);

      const initialRewardBalance = await rewardToken.balanceOf(player.address);
      await moveTime(SECONDS_IN_A_DAY - 2);
      await moveBlocks(1);

      const initialLPBalance = await staking.earned(player.address);

      await staking.connect(player).getReward();

      const postRewardBalance = await rewardToken.balanceOf(player.address);
      const postLPBalance = await staking.earned(player.address);

      assert.approximately(
        initialRewardBalance,
        postLPBalance,
        ethers.parseEther("0.001")
      );
      assert.approximately(
        initialLPBalance,
        postRewardBalance,
        ethers.parseEther("0.001")
      );
    });
  });
  // describe('setRewardDuration()', () => {
  //   it("")
  //  })
});
