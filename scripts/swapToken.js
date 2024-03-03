require("dotenv").config();
const ethers = require("ethers");

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const INFURA_KEY = process.env.INFURA_KEY;
const SwapContractAddress = "0x52646c2DAa8bed47b6840c94dA39E3C99a636eE2";
const swapContractABI =
  require("../artifacts/contracts/swap/SwapContract.sol/SwapContract.json").abi;

async function main() {
  let provider = new ethers.JsonRpcProvider(
    `https://goerli.infura.io/v3/${INFURA_KEY}`
  );
  let wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const swapContract = new ethers.BaseContract(
    SwapContractAddress,
    swapContractABI,
    provider
  );
  const uniTokenContract = new ethers.BaseContract(
    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    [
      {
        inputs: [
          { internalType: "address", name: "account", type: "address" },
          { internalType: "address", name: "minter_", type: "address" },
          {
            internalType: "uint256",
            name: "mintingAllowedAfter_",
            type: "uint256",
          },
        ],
        payable: false,
        stateMutability: "nonpayable",
        type: "constructor",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "owner",
            type: "address",
          },
          {
            indexed: true,
            internalType: "address",
            name: "spender",
            type: "address",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "amount",
            type: "uint256",
          },
        ],
        name: "Approval",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "delegator",
            type: "address",
          },
          {
            indexed: true,
            internalType: "address",
            name: "fromDelegate",
            type: "address",
          },
          {
            indexed: true,
            internalType: "address",
            name: "toDelegate",
            type: "address",
          },
        ],
        name: "DelegateChanged",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "delegate",
            type: "address",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "previousBalance",
            type: "uint256",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "newBalance",
            type: "uint256",
          },
        ],
        name: "DelegateVotesChanged",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: false,
            internalType: "address",
            name: "minter",
            type: "address",
          },
          {
            indexed: false,
            internalType: "address",
            name: "newMinter",
            type: "address",
          },
        ],
        name: "MinterChanged",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "from",
            type: "address",
          },
          {
            indexed: true,
            internalType: "address",
            name: "to",
            type: "address",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "amount",
            type: "uint256",
          },
        ],
        name: "Transfer",
        type: "event",
      },
      {
        constant: true,
        inputs: [],
        name: "DELEGATION_TYPEHASH",
        outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: true,
        inputs: [],
        name: "DOMAIN_TYPEHASH",
        outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: true,
        inputs: [],
        name: "PERMIT_TYPEHASH",
        outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: true,
        inputs: [
          { internalType: "address", name: "account", type: "address" },
          { internalType: "address", name: "spender", type: "address" },
        ],
        name: "allowance",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: false,
        inputs: [
          { internalType: "address", name: "spender", type: "address" },
          { internalType: "uint256", name: "rawAmount", type: "uint256" },
        ],
        name: "approve",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        constant: true,
        inputs: [{ internalType: "address", name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: true,
        inputs: [
          { internalType: "address", name: "", type: "address" },
          { internalType: "uint32", name: "", type: "uint32" },
        ],
        name: "checkpoints",
        outputs: [
          { internalType: "uint32", name: "fromBlock", type: "uint32" },
          { internalType: "uint96", name: "votes", type: "uint96" },
        ],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: true,
        inputs: [],
        name: "decimals",
        outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: false,
        inputs: [
          { internalType: "address", name: "delegatee", type: "address" },
        ],
        name: "delegate",
        outputs: [],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        constant: false,
        inputs: [
          { internalType: "address", name: "delegatee", type: "address" },
          { internalType: "uint256", name: "nonce", type: "uint256" },
          { internalType: "uint256", name: "expiry", type: "uint256" },
          { internalType: "uint8", name: "v", type: "uint8" },
          { internalType: "bytes32", name: "r", type: "bytes32" },
          { internalType: "bytes32", name: "s", type: "bytes32" },
        ],
        name: "delegateBySig",
        outputs: [],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        constant: true,
        inputs: [{ internalType: "address", name: "", type: "address" }],
        name: "delegates",
        outputs: [{ internalType: "address", name: "", type: "address" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: true,
        inputs: [{ internalType: "address", name: "account", type: "address" }],
        name: "getCurrentVotes",
        outputs: [{ internalType: "uint96", name: "", type: "uint96" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: true,
        inputs: [
          { internalType: "address", name: "account", type: "address" },
          { internalType: "uint256", name: "blockNumber", type: "uint256" },
        ],
        name: "getPriorVotes",
        outputs: [{ internalType: "uint96", name: "", type: "uint96" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: true,
        inputs: [],
        name: "minimumTimeBetweenMints",
        outputs: [{ internalType: "uint32", name: "", type: "uint32" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: false,
        inputs: [
          { internalType: "address", name: "dst", type: "address" },
          { internalType: "uint256", name: "rawAmount", type: "uint256" },
        ],
        name: "mint",
        outputs: [],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        constant: true,
        inputs: [],
        name: "mintCap",
        outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: true,
        inputs: [],
        name: "minter",
        outputs: [{ internalType: "address", name: "", type: "address" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: true,
        inputs: [],
        name: "mintingAllowedAfter",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: true,
        inputs: [],
        name: "name",
        outputs: [{ internalType: "string", name: "", type: "string" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: true,
        inputs: [{ internalType: "address", name: "", type: "address" }],
        name: "nonces",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: true,
        inputs: [{ internalType: "address", name: "", type: "address" }],
        name: "numCheckpoints",
        outputs: [{ internalType: "uint32", name: "", type: "uint32" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: false,
        inputs: [
          { internalType: "address", name: "owner", type: "address" },
          { internalType: "address", name: "spender", type: "address" },
          { internalType: "uint256", name: "rawAmount", type: "uint256" },
          { internalType: "uint256", name: "deadline", type: "uint256" },
          { internalType: "uint8", name: "v", type: "uint8" },
          { internalType: "bytes32", name: "r", type: "bytes32" },
          { internalType: "bytes32", name: "s", type: "bytes32" },
        ],
        name: "permit",
        outputs: [],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        constant: false,
        inputs: [{ internalType: "address", name: "minter_", type: "address" }],
        name: "setMinter",
        outputs: [],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        constant: true,
        inputs: [],
        name: "symbol",
        outputs: [{ internalType: "string", name: "", type: "string" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: true,
        inputs: [],
        name: "totalSupply",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: false,
        inputs: [
          { internalType: "address", name: "dst", type: "address" },
          { internalType: "uint256", name: "rawAmount", type: "uint256" },
        ],
        name: "transfer",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        constant: false,
        inputs: [
          { internalType: "address", name: "src", type: "address" },
          { internalType: "address", name: "dst", type: "address" },
          { internalType: "uint256", name: "rawAmount", type: "uint256" },
        ],
        name: "transferFrom",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
      },
    ],
    provider
  );
  console.log("Approving Token...");
  const approveTx = await uniTokenContract
    .connect(wallet)
    .approve(swapContract.target, ethers.parseEther("0.01"));
  await approveTx.wait(1);
  console.log("Approved Token...");
  console.log("Swapping Token...");
  const tx = await swapContract.connect(wallet).swap(
    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    "0x07865c6E87B9F70255377e024ace6630C1Eaa37F",
    ethers.parseEther("0.01"),
    ethers.parseEther("0"), // Depending on the calculating of FrontEnd considering the Slippage and the amount of tokens obtained from the Oracle Protocol
    wallet.address
  );
  await tx.wait(1);

  console.log("Swapped Token...");
  console.log(tx);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
