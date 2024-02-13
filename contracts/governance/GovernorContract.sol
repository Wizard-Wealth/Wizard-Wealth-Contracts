// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";
import "@openzeppelin/contracts/governance/utils/IVotes.sol";
import "@openzeppelin/contracts/interfaces/IERC165.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";

/**
 * @title Governance Contract
 * @author Harry Nguyen
 * @dev Main point of interaction with Wizard's governance
 *  - The Voting Delay is the time between the proposal being started and the voting starts
 *  - Voting Period is the time between the voting starting and the voting ending
 *  - Proposal Threshold is the minimum number of votes an account must have to create a prososal
 *  - Quorum is the amount required votes for a proposal to pass/execute (Percentage / %)
 *  - Updatable Settings allow the governace to update the voting settings such as Voting Delay, Voting Period, Proposal Threshold
 *  - Create a Proposal
 * - Cancel a Proposal
 * - Queue a Proposal
 * - Executing a Proposal
 * - Submit votes for a Proposal
 *  Proposal States: Pending => Active => Succeeded / Failed => Queued => Finished (Executed)
 */
contract GovernorContract is
    Governor,
    GovernorCountingSimple,
    GovernorSettings,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    uint256 public s_proposalCounting;

    constructor(
        IVotes _token,
        TimelockController _timelock
    )
        Governor("WizardGovernance")
        GovernorSettings(1 /* 1 block */, 50400 /* 1 week */, 0)
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(4)
        GovernorTimelockControl(_timelock)
    {}

    /// @notice How long after a proposal is created should voting power be fixed. A large voting delay gives users time to unstake tokens if necessary.
    /// @dev Dev can set this votingDelay time
    /// @return return how long after a proposal is created should voting power be fixed
    function votingDelay()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.votingDelay();
    }

    /// @notice How long does a proposal remain open to votes.
    /// @dev Dev can set this votingDelay time
    /// @return return How long does a proposal remain open to votes.
    function votingPeriod()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    function quorum(
        uint256 blockNumber
    )
        public
        view
        override(Governor, GovernorVotesQuorumFraction)
        returns (uint256)
    {
        return super.quorum(blockNumber);
    }

    function state(
        uint256 proposalId
    )
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function proposalNeedsQueuing(
        uint256 proposalId
    ) public view override(Governor, GovernorTimelockControl) returns (bool) {
        return super.proposalNeedsQueuing(proposalId);
    }

    function proposalThreshold()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint48) {
        return
            super._queueOperations(
                proposalId,
                targets,
                values,
                calldatas,
                descriptionHash
            );
    }

    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._executeOperations(
            proposalId,
            targets,
            values,
            calldatas,
            descriptionHash
        );
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal
        view
        override(Governor, GovernorTimelockControl)
        returns (address)
    {
        return super._executor();
    }

    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public override(Governor) returns (uint256) {
        unchecked {
            ++s_proposalCounting;
        }
        return super.propose(targets, values, calldatas, description);
    }

    function getProposalCounting() public view returns (uint256) {
        return s_proposalCounting;
    }
}
