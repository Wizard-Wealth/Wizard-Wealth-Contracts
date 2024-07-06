const { assert, expect } = require("chai");
const hre = require("hardhat");
const ethers = require("ethers");
const { developmentChains } = require("../helpers/helper-hardhat-config");
const { moveBlocks } = require("../utils/move-blocks");
const { moveTime } = require("../utils/move-time");

const DAI_INITIAL_PRICE = hre.ethers.parseEther("0.001"); // 1 DAI = $1 & ETH = $1000
const BTC_INITIAL_PRICE = hre.ethers.parseEther("2"); // 1WBTC = $2000 & ETH = $1000

const DECIMALS = 18;

const BTC_UPDATED_PRICE = ethers.parseEther("1.9");
const SECONDS_IN_WEEK = 604800;
const SECONDS_IN_3_DAYS = 259200;

describe("Lending Unit Tests", function () {
  let lendingContract,
    daiContract,
    wbtcContract,
    wethContract,
    depositAmount,
    deployer,
    player,
    signers,
    threshold,
    wbtcEthPriceFeed,
    daiEthPriceFeed;
  beforeEach(async () => {
    [deployer, player, ...signers] = await hre.ethers.getSigners();
    // Deploy DAI, WBTC, WETH
    daiContract = await hre.ethers.deployContract("MockERC20", ["DAI", "DAI"]);
    await daiContract.waitForDeployment();
    console.log(`DAI address: ${daiContract.target}`);
    wbtcContract = await hre.ethers.deployContract("MockERC20", [
      "Wrapped Bitcoin",
      "WBTC",
    ]);
    await wbtcContract.waitForDeployment();
    console.log(`WBTC address: ${wbtcContract.target}`);
    wethContract = await hre.ethers.deployContract("MockERC20", [
      "Wrapped Ethereum",
      "WETH",
    ]);
    // Deploy DAIETHPriceFeed, WBTCETHPriceFeed
    daiEthPriceFeed = await hre.ethers.deployContract(
      "@chainlink/contracts/src/v0.6/tests/MockV3Aggregator.sol:MockV3Aggregator",
      [DECIMALS, DAI_INITIAL_PRICE]
    );
    await daiEthPriceFeed.waitForDeployment();
    console.log(`DAIETHPriceFeed address: ${daiEthPriceFeed.target}`);
    wbtcEthPriceFeed = await hre.ethers.deployContract(
      "@chainlink/contracts/src/v0.6/tests/MockV3Aggregator.sol:MockV3Aggregator",
      [DECIMALS, BTC_INITIAL_PRICE]
    );
    await wbtcEthPriceFeed.waitForDeployment();
    console.log(`WBTCETHPriceFeed address: ${wbtcEthPriceFeed.target}`);
    // Deploy Lending Contract
    lendingContract = await hre.ethers.deployContract("Lending");
    await lendingContract.waitForDeployment();
    console.log(`Lending address: ${lendingContract.target}`);
    // Allowed DAI, WBTC token
    const setAllowedDAITx = await lendingContract
      .connect(deployer)
      .setAllowedToken(daiContract.target, daiEthPriceFeed.target);
    await setAllowedDAITx.wait();
    const setAllowedBTCTx = await lendingContract
      .connect(deployer)
      .setAllowedToken(wbtcContract.target, wbtcEthPriceFeed.target);
    depositAmount = hre.ethers.parseEther("1");
    await setAllowedBTCTx.wait();
    threshold = await lendingContract.LIQUIDATION_THRESHOLD();
  });
  describe("getEthValue", () => {
    // 1 DAI = $1 & ETH = $1,000
    it("Correctly gets DAI Price", async () => {
      const oneEthOfDai = hre.ethers.parseEther("1000");
      const ethValueOfDai = await lendingContract.getEthValue(
        wbtcContract.target,
        oneEthOfDai
      );
      expect(ethValueOfDai.toString()).equal(
        ethers.parseEther("2000").toString()
      );
    });
    // 1 WBTC = $2,000 & ETH = $1,000
    it("Correctly gets WBTC Price", async () => {
      const oneEthOfWbtc = hre.ethers.parseEther("0.5");
      const ethValueOfWbtc = await lendingContract.getEthValue(
        wbtcContract.target,
        oneEthOfWbtc
      );
      expect(ethValueOfWbtc.toString()).equal(
        ethers.parseEther("1").toString()
      );
    });
  });
  describe("getTokenValueFromETH", () => {
    it("Correctly gets DAI price", async () => {
      const oneDaiOfEth = ethers.parseEther("0.001");
      const daiValueOfEth = await lendingContract.getTokenValueFromEth(
        daiContract.target,
        oneDaiOfEth
      );
      expect(daiValueOfEth.toString()).equal(ethers.parseEther("1").toString());
    });
    it("Correctly gets WBTC price", async () => {
      const oneWbtcOfEth = ethers.parseEther("2");
      const wbtcValueOfEth = await lendingContract.getTokenValueFromEth(
        wbtcContract.target,
        oneWbtcOfEth
      );
      expect(wbtcValueOfEth.toString()).equal(
        ethers.parseEther("1").toString()
      );
    });
  });
  describe("Deposit", () => {
    it("Deposits money", async () => {
      await wbtcContract.approve(lendingContract.target, depositAmount);
      await lendingContract.deposit(wbtcContract.target, depositAmount);
      const accountInfo = await lendingContract.getAccountInformation(
        deployer.address
      );
      expect(accountInfo[0].toString()).equal("0");
      // WBTC is 2x the price of ETh in our scenario
      expect(accountInfo[1].toString()).equal((depositAmount * 2n).toString());
    });
    it("Deposits money 2 times", async () => {
      await wbtcContract
        .connect(deployer)
        .transfer(lendingContract.target, depositAmount);
      await wbtcContract
        .connect(deployer)
        .transfer(player.address, depositAmount * 2n);
      await wbtcContract
        .connect(player)
        .approve(lendingContract.target, depositAmount * 2n);
      await lendingContract
        .connect(player)
        .deposit(wbtcContract.target, depositAmount);
      const accountInfo = await lendingContract.getAccountInformation(
        player.address
      );
      expect(accountInfo[0].toString()).equal(
        ethers.parseEther("0").toString()
      );
      expect(accountInfo[1].toString()).equal(
        ethers.parseEther("2").toString()
      );

      await moveTime(SECONDS_IN_3_DAYS);
      // await moveBlocks(1);

      // await lendingContract.withdraw(wbtcContract.target, depositAmount);
      await lendingContract
        .connect(player)
        .deposit(wbtcContract.target, depositAmount);
      const getAccountDepositToken =
        await lendingContract.getAccountToTokenDeposits(player.address);
      expect(getAccountDepositToken[1][1]).equal(
        (((depositAmount * BigInt(SECONDS_IN_3_DAYS)) /
          BigInt(SECONDS_IN_WEEK)) *
          500n) /
          10000n +
          depositAmount * 2n
      );
    });
  });
  describe("Withdraw", () => {
    it("Pulls money", async () => {
      await wbtcContract.approve(lendingContract.target, depositAmount);
      await lendingContract.deposit(wbtcContract.target, depositAmount);
      await lendingContract.withdraw(wbtcContract.target, depositAmount);
      const accountInfo = await lendingContract.getAccountInformation(
        deployer.address
      );
      expect(accountInfo[0].toString()).equal("0");
      expect(accountInfo[1].toString()).equal("0");
    });
    it("Pulls money with interest amount after 1 week", async () => {
      await wbtcContract.transfer(lendingContract.target, depositAmount);
      await wbtcContract.transfer(player.address, depositAmount);
      expect(await wbtcContract.balanceOf(player.address)).equal(depositAmount);
      await wbtcContract
        .connect(player)
        .approve(lendingContract.target, depositAmount);
      await lendingContract
        .connect(player)
        .deposit(wbtcContract.target, depositAmount);

      await moveTime(SECONDS_IN_WEEK);
      await moveBlocks(1);
      await lendingContract
        .connect(player)
        .withdraw(wbtcContract.target, depositAmount);
      const balanceAfterWithdrawn = await wbtcContract.balanceOf(
        player.address
      );
      expect(balanceAfterWithdrawn).equal((depositAmount * 105n) / 100n);
    });
  });
  describe("Borrow", () => {
    it("Can not pull money that would make the platform involvent", async () => {
      await daiContract.transfer(
        lendingContract.target,
        ethers.parseEther("4000")
      );
      await wbtcContract.approve(lendingContract.target, depositAmount);
      await lendingContract.deposit(wbtcContract.target, depositAmount);
      const daiBorrowAmount = ethers.parseEther(
        (2000 * (parseInt(threshold) / 10000) + 1).toString()
      );
      const daiEthValue = await lendingContract.getEthValue(
        daiContract.target,
        daiBorrowAmount
      );
      const wbtcEthValue = await lendingContract.getEthValue(
        wbtcContract.target,
        depositAmount
      );
      console.log(
        `Going to attempt to borrow ${ethers.formatEther(
          daiEthValue
        )} ETH worth of DAI (${ethers.formatEther(daiBorrowAmount)} DAI)\n`
      );
      console.log(
        `With only ${ethers.formatEther(
          wbtcEthValue
        )} ETH of WBTC (${ethers.formatEther(
          depositAmount
        )} WBTC) deposited. \n`
      );
      await daiContract.transfer(player.address, daiBorrowAmount);
      await daiContract
        .connect(player)
        .approve(lendingContract.target, daiBorrowAmount);
      await lendingContract
        .connect(player)
        .deposit(daiContract.target, daiBorrowAmount);
      const playerInformation = await lendingContract
        .connect(deployer)
        .getAccountInformation(player.address);
      const deployerInformation = await lendingContract
        .connect(deployer)
        .getAccountInformation(deployer.address);
      console.log(playerInformation);
      console.log(deployerInformation);
      expect(playerInformation[0].toString()).equal("0");
      expect(playerInformation[1].toString()).equal(daiEthValue);
      expect(deployerInformation[0].toString()).equal("0");
      expect(deployerInformation[1].toString()).equal(wbtcEthValue);
      // borrow again
      await expect(
        lendingContract.borrow(daiContract.target, daiBorrowAmount)
      ).to.be.revertedWith("Platform will go insolvent!");
    });
    it("Exactly the threshold can be borrowed", async () => {
      await wbtcContract.approve(lendingContract.target, depositAmount);
      await lendingContract.deposit(wbtcContract.target, depositAmount);
      //
      const daiBorrowAmount = ethers.parseEther(
        (2000 * (parseInt(threshold) / 10000)).toString()
      );
      const daiEthValue = await lendingContract.getEthValue(
        daiContract.target,
        daiBorrowAmount
      );
      const wbtcEthValue = await lendingContract.getEthValue(
        wbtcContract.target,
        depositAmount
      );
      await daiContract.transfer(player.address, daiBorrowAmount);
      await daiContract
        .connect(player)
        .approve(lendingContract.target, daiBorrowAmount);
      await lendingContract
        .connect(player)
        .deposit(daiContract.target, daiBorrowAmount);
      //
      const playerInformation = await lendingContract.getAccountInformation(
        player.address
      );
      let deployerInformation = await lendingContract.getAccountInformation(
        deployer.address
      );
      expect(playerInformation[0].toString()).equal("0");
      expect(playerInformation[1].toString()).equal(daiEthValue);
      expect(deployerInformation[0].toString()).equal("0");
      expect(deployerInformation[1].toString()).equal(wbtcEthValue);
      // Let's try to borrow
      await lendingContract.borrow(daiContract.target, daiBorrowAmount);
      const healthFactor = await lendingContract.healthFactor(deployer.address);
      deployerInformation = await lendingContract.getAccountInformation(
        deployer.address
      );
      expect(deployerInformation[0].toString()).equal(daiEthValue);
      expect(deployerInformation[1].toString()).equal(wbtcEthValue);
      expect(healthFactor.toString()).equal(
        hre.ethers.parseEther("1").toString()
      );
    });
  });
  describe("Repay", () => {
    it("Repay the borrowed amount with the interest amount fully after 1 week", async () => {
      await wbtcContract.approve(lendingContract.target, depositAmount);
      await lendingContract.deposit(wbtcContract.target, depositAmount);
      const wbtcEthValue = await lendingContract.getEthValue(
        wbtcContract.target,
        depositAmount
      );
      // Player deposit DAI
      const daiBorrowAmount = ethers.parseEther(
        (2000 * (parseInt(threshold) / 10000)).toString()
      );
      await daiContract.transfer(player.address, daiBorrowAmount);
      await daiContract
        .connect(player)
        .approve(lendingContract.target, daiBorrowAmount);
      await lendingContract
        .connect(player)
        .deposit(daiContract.target, daiBorrowAmount);
      const allDaiAmountRepay = (
        (daiBorrowAmount * 110n) / 100n +
        hre.ethers.parseEther("1")
      ).toString();
      await lendingContract
        .connect(deployer)
        .borrow(daiContract.target, daiBorrowAmount);
      await moveTime(SECONDS_IN_WEEK);
      await moveBlocks(1);
      await daiContract.approve(lendingContract.target, allDaiAmountRepay);
      await lendingContract.repayAllBorrowedToken(daiContract.target);
      const deployerInformation = await lendingContract.getAccountInformation(
        deployer.address
      );
      expect(deployerInformation[0].toString()).equal("0");
      expect(deployerInformation[1].toString()).equal(wbtcEthValue);
    });
    it("Repay the borrowed amount without interest amount after 1 weeks", async () => {
      await wbtcContract.approve(lendingContract.target, depositAmount);
      await lendingContract.deposit(wbtcContract.target, depositAmount);

      const wbtcEthValue = await lendingContract.getEthValue(
        wbtcContract.target,
        depositAmount
      );

      const daiBorrowAmount = ethers.parseEther(
        (2000 * (parseInt(threshold) / 10000)).toString()
      );

      await daiContract.transfer(player.address, daiBorrowAmount);
      await daiContract
        .connect(player)
        .approve(lendingContract.target, daiBorrowAmount);
      await lendingContract
        .connect(player)
        .deposit(daiContract.target, daiBorrowAmount);

      await lendingContract
        .connect(deployer)
        .borrow(daiContract.target, daiBorrowAmount);
      await daiContract.approve(lendingContract.target, daiBorrowAmount);

      await moveTime(SECONDS_IN_WEEK - 2);
      await moveBlocks(1);
      console.log(
        await lendingContract.calculateMaxRepayAmount(
          deployer.address,
          daiContract.target
        )
      );
      console.log(daiBorrowAmount);
      const repayTx = await lendingContract.repay(
        daiContract.target,
        daiBorrowAmount
      );
      await repayTx.wait();
      console.log(
        await lendingContract.calculateMaxRepayAmount(
          deployer.address,
          daiContract.target
        )
      );

      // const deployerInformation = await lendingContract.getAccountInformation(
      //   deployer.address
      // );
      // expect(deployerInformation[0].toString()).equal(
      //   hre.ethers.parseEther(
      //     ((2000 * parseInt(threshold) * 10) / 100).toString()
      //   )
      // );
      // expect(deployerInformation[1].toString()).equal(wbtcEthValue);
    });
  });
});
