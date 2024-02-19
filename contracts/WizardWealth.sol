//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/utils/Nonces.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract WizardWealth is ERC20, ERC20Permit, ERC20Votes, Ownable {
    event TokenTransfered(
        address indexed from,
        address indexed to,
        uint256 amount
    );
    event TokenMinted(address indexed to, uint256 amount);
    event TokenBurned(address indexed from, uint256 amount);
    // TOKENS_PER_USER * AMOUNT_USERS_CLAIM = 50 * 10000 => total of claimed =  20000 (token)
    // AIRDROP PERCENTAGE = 1 %
    uint256 constant TOKENS_PER_USER = 20000;
    uint256 constant MAX_USERS_CLAIMED = 100;
    // 100 millions (token) =  Max Total Supply
    /* TGE: Only 10-20 percent = 10-20 millions (token)
        - Vault(rewarding for ecosystem devs, staking holders): 5-10 percent = 5-10 millions (token)
            Using proposal for distributing token for ecosystem devs
            Sharing token for staking holders
        - Airdrop token: 1 % = 1 million (token)
        - Adding LP (Uniswap): 4-9 percent = 4-9 million (token)
    */
    uint256 constant TOTAL_SUPPLY = 100000000 * 10 ** 18;

    uint256 public s_claimedUser;
    mapping(address => bool) public s_claimedTokens;

    address[] public s_holders;

    constructor(
        uint256 _keepPercentage
    )
        ERC20("WizardWealth", "WiWe")
        ERC20Permit("WizardWealth")
        Ownable(msg.sender)
    {
        uint256 keepAmount = (TOTAL_SUPPLY * _keepPercentage) / 100;
        _mint(msg.sender, TOTAL_SUPPLY);
        _transfer(msg.sender, address(this), TOTAL_SUPPLY - keepAmount);
        s_holders.push(msg.sender);
    }

    function claimTokens() external {
        require(
            !s_claimedTokens[msg.sender],
            "This adddress is already claimed tokens"
        );
        require(
            s_claimedUser <= MAX_USERS_CLAIMED,
            "Over amount of claimed users"
        );
        s_claimedTokens[msg.sender] = true;
        s_claimedUser += 1;
        _transfer(address(this), msg.sender, TOKENS_PER_USER * 10 ** 18);
        s_holders.push(msg.sender);
    }

    function getHolderLength() external view returns (uint256) {
        return s_holders.length;
    }

    // The functions below are overrides required from ERC20Permit.sol and ERC20Votes.sol

    function nonces(
        address _owner
    ) public view virtual override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(_owner);
    }

    function _update(
        address _from,
        address _to,
        uint256 _value
    ) internal override(ERC20, ERC20Votes) {
        super._update(_from, _to, _value);
        emit TokenTransfered(_from, _to, _value);
    }

    // The functions below are overrides from ERC20

    function mint(address account, uint256 value) public onlyOwner {
        super._mint(account, value);
        emit TokenMinted(account, value);
    }

    function burn(address account, uint256 value) public onlyOwner {
        super._burn(account, value);
        emit TokenBurned(account, value);
    }
}
