//SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract BoxTest is Ownable {
    uint256 public value;
    constructor() Ownable(msg.sender) {}

    function store(uint256 _newValue) public onlyOwner {
        value = _newValue;
    }

    function retrieve() public view returns (uint256) {
        return value;
    }
}
