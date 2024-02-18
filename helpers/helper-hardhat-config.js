const networkConfig = {
  default: {
    name: "hardhat",
  },
  31337: {
    name: "localhost",
  },
  11155111: {
    name: "sepolia",
  },
  5: {
    name: "goerli",
  },
  1: {
    name: "mainnet",
  },
};

const developmentChains = ["hardhat", "localhost"];
const VERIFICATION_BLOCK_COMFIRMATION = 6;

module.exports = {
  networkConfig,
  developmentChains,
  VERIFICATION_BLOCK_COMFIRMATION,
};
