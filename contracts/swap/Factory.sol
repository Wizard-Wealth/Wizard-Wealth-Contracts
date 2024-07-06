// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./LiquidityPool.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Factory {
    mapping(address => address) private poolsByToken;
    mapping(address => address) private tokensByPool;

    address private weth;
    event PoolCreated(
        address indexed tokenAddress,
        address indexed poolAddress
    );

    constructor(address _weth) {
        weth = _weth;
    }

    function createPool(address tokenAddress) external returns (address) {
        require(s_pools[tokenAddress] == address(0), "Pool already exists");
        LiquidityPool liquidityPool = new LiquidityPool(tokenAddress, weth);
        poolsByToken[tokenAddress] = address(liquidityPool);
        tokensByPool[address(liquidityPool)] = tokenAddress;
        emit PoolCreated(tokenAddress, address(liquidityPool));
        return address(liquidityPool);
    }

    function getPool(address tokenAddress) external view returns (address) {
        return poolsByToken[tokenAddress];
    }

    function getToken(address pool) external view returns (address) {
        return tokensByPool[pool];
    }

    function getWethToken() external view returns (address) {
        return weth;
    }
}
