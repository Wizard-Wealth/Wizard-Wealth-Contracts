//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title Governance Time Lock Contract
 * @author Harry Nguyen
 * @notice
 *  - Min Delay is the minimum time that needs to pass before a proposal can be executed
 *  - Proposers are the addresses that can create a proposal
 *  - Executores are the addresses that can execute a proposal
 *  - Admin is the address that can set the Min Delay. There are 2 address having Admin Role: the admin in agruments constructor and self administration
 * @dev
 * - The Time Lock Contract is going to be the Owner of Governor Contract
 * - We use the Time Lock Contract because we want to wait until a new vote is executed
 * - Also we want to setup the minium fee to be able to vote, it could be 7 tokens
 * - This Gives time to get out if they don't like the proposal
 */

contract GovernanceTimelock is TimelockController {
    constructor(
        uint256 _minDelay,
        address[] memory _proposers,
        address[] memory _executors,
        address _admin
    ) TimelockController(_minDelay, _proposers, _executors, _admin) {}
}
