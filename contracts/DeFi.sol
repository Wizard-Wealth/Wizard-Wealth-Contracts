// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract DeFi is Ownable {
    constructor() Ownable(msg.sender) {}

    /**
     * List function to execute
     * - changing the quorum percentage in Governance contract
     * - changing reward Duration in Staking contract
     * - Grant to team or another address (Marketing, etc)
     */
}
