// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;
pragma abicoder v2;

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import "../interfaces/ISwapRouterV2.sol";

contract SwapContract {
    ISwapRouterV2 public immutable swapRouterV2;

    address public constant WETH = 0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6;

    uint private unlocked = 1;

    modifier lock() {
        require(unlocked == 1, 'RouterV2: LOCKED');
        unlocked = 0;
        _;
        unlocked = 1;
    }

    constructor(address _swapRouterV2) {
        swapRouterV2 = ISwapRouterV2(_swapRouterV2);
    }

    function swapExactTokensForTokens(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn,
        uint256 _amountOutMin,
        address _to
    ) external lock{
        IERC20(_tokenIn).transferFrom(msg.sender, address(this), _amountIn);
        IERC20(_tokenIn).approve(address(swapRouterV2), _amountIn);

        address[] memory path = new address[](3);
        path[0] = _tokenIn;
        path[1] = WETH;
        path[2] = _tokenOut;

        swapRouterV2.swapExactTokensForTokens(_amountIn, _amountOutMin, path, _to, block.timestamp);
    }

    function swapExactETHForTokens(
        address _tokenOut,
        uint256 _amountIn,
        uint256 _amountOutMin,
        address _to
    ) external lock {
        IERC20(WETH).transferFrom(msg.sender, address(this), _amountIn);
        IERC20(WETH).approve(address(swapRouterV2), _amountIn);

        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = _tokenOut;

        swapRouterV2.swapExactETHForTokens(_amountOutMin, path, _to, block.timestamp);
    }

    function swapExactTokensForETH(
        address _tokenIn,
        uint256 _amountIn,
        uint256 _amountOutMin,
        address _to
    ) external lock {
        IERC20(_tokenIn).transferFrom(msg.sender, address(this), _amountIn);
        IERC20(_tokenIn).approve(address(swapRouterV2), _amountIn);

        address[] memory path = new address[](2);
        path[0] = _tokenIn;
        path[1] = WETH;

        swapRouterV2.swapExactTokensForETH(_amountIn, _amountOutMin , path, _to, block.timestamp);
    }
}