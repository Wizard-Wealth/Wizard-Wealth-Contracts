const hre = require("hardhat");

async function moveBlocks(amount) {
  console.log("Moving blocks...");
  for (let i = 0; i < amount; i++) {
    await hre.network.provider.send("evm_mine");
  }
  console.log(`Moved ${amount} blocks`);
}

module.exports = {
  moveBlocks,
};
