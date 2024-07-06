require("dotenv").config();
const hre = require("hardhat");

async function main() {
  const boxTest = await hre.ethers.deployContract("BoxTest");
  await boxTest.waitForDeployment();
  console.log("BoxTest deployed to:", boxTest.target);
}

main()
  .then(() => process.exit(1))
  .catch((error) => {
    console.error(error);
    process.exit(0);
  });
