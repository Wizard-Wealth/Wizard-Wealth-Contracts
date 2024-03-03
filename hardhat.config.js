require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.22",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  allowUnlimitedContractSize: true,
  networks: {
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: [process.env.PRIVATE_KEY],
    },
    ganache: {
      chainId: 5777,
      url: "HTTP://127.0.0.1:7545",
      accounts: [
        "0xd9514d2615966c9732a47853acccb754bd79e259c11d6afbeff664f6c8a65dd7",
        "0x31d8311076734a44c46c29aa1257c72e1322ead79dc891f78d74d2acede7cb20",
        "0x6ab4100903b8239cc05f03285ab88c5f84eb9fc201e71e3d4ac6e1c860880400",
        "0x295f5602297e310d4396159f4db89ba07ebc7242cb123d43945ad965d93f50b4",
      ],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_KEY,
  },
};
