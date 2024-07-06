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
    uint256 constant TOKENS_PER_USER = 20000;
    uint256 constant MAX_USERS_CLAIMED = 100;
    uint256 constant TOTAL_SUPPLY = 100000000 * 10 ** 18;

    uint256 public s_claimedUser;
    mapping(address => bool) public s_claimedTokens;

    address[] public s_holders;

    constructor()
        ERC20("WizardWealth", "WiWe")
        ERC20Permit("WizardWealth")
        Ownable(msg.sender)
    {
        _mint(msg.sender, TOTAL_SUPPLY);
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

    function withdrawAllToken() public onlyOwner {
        transfer(owner(), balanceOf(address(this)));
    }
}
