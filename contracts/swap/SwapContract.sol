// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.6.6;

import "@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IERC20.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";

contract SwapContract {
    IUniswapV2Router02 public immutable swapRouterV2;

    address public immutable WETH;

    uint private unlocked = 1;

    modifier lock() {
        require(unlocked == 1, "RouterV2: LOCKED");
        unlocked = 0;
        _;
        unlocked = 1;
    }

    constructor(address _swapRouterV2, address _WETH) public {
        swapRouterV2 = IUniswapV2Router02(_swapRouterV2);
        WETH = _WETH;
    }

    function swapExactTokensForTokens(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn,
        uint256 _amountOutMin,
        address _to,
        uint256 deadline
    ) external lock {
        IERC20(_tokenIn).approve(address(this), _amountIn);
        IERC20(_tokenIn).transferFrom(msg.sender, address(this), _amountIn);
        IERC20(_tokenIn).approve(address(swapRouterV2), _amountIn);

        address[] memory path = new address[](3);
        path[0] = _tokenIn;
        path[1] = WETH;
        path[2] = _tokenOut;

        swapRouterV2.swapExactTokensForTokens(
            _amountIn,
            _amountOutMin,
            path,
            _to,
            deadline
        );
    }

    function swapExactETHForTokens(
        address _tokenOut,
        uint256 _amountOutMin,
        address _to,
        uint256 deadline
    ) external payable lock {
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = _tokenOut;

        swapRouterV2.swapExactETHForTokens{value: msg.value}(
            _amountOutMin,
            path,
            _to,
            deadline
        );
    }

    function swapExactTokensForETH(
        address _tokenIn,
        uint256 _amountIn,
        uint256 _amountOutMin,
        address _to,
        uint256 deadline
    ) external lock {
        IERC20(_tokenIn).approve(address(this), _amountIn);
        IERC20(_tokenIn).transferFrom(msg.sender, address(this), _amountIn);
        IERC20(_tokenIn).approve(address(swapRouterV2), _amountIn);

        address[] memory path = new address[](2);
        path[0] = _tokenIn;
        path[1] = WETH;

        swapRouterV2.swapExactTokensForETH(
            _amountIn,
            _amountOutMin,
            path,
            _to,
            deadline
        );
    }

    function getAmountOut(
        uint amountIn,
        uint reserveIn,
        uint reserveOut
    ) public view returns (uint amountOut) {
        return swapRouterV2.getAmountOut(amountIn, reserveIn, reserveOut);
    }

    function getAmountIn(
        uint amountOut,
        uint reserveIn,
        uint reserveOut
    ) public view returns (uint amountIn) {
        return swapRouterV2.getAmountIn(amountOut, reserveIn, reserveOut);
    }

    function pairFor(
        address factory,
        address _tokenIn,
        address _tokenOut
    ) public pure returns (address pair) {
        return UniswapV2Library.pairFor(factory, _tokenIn, _tokenOut);
    }

    // returns sorted token addresses, used to handle return values from pairs sorted in this order
    function sortTokens(
        address tokenA,
        address tokenB
    ) internal pure returns (address token0, address token1) {
        require(tokenA != tokenB, "UniswapV2Library: IDENTICAL_ADDRESSES");
        (token0, token1) = tokenA < tokenB
            ? (tokenA, tokenB)
            : (tokenB, tokenA);
        require(token0 != address(0), "UniswapV2Library: ZERO_ADDRESS");
    }

    function getReserves(
        address factory,
        address _tokenIn,
        address _tokenOut
    ) public view returns (uint reserveIn, uint reserveOut) {
        (address token0, ) = sortTokens(_tokenIn, _tokenOut);
        (uint reserve0, uint reserve1, ) = IUniswapV2Pair(
            IUniswapV2Factory(factory).getPair(_tokenIn, _tokenOut)
        ).getReserves();
        (reserveIn, reserveOut) = _tokenIn == token0
            ? (reserve0, reserve1)
            : (reserve1, reserve0);
    }

    receive() external payable {
        assert(msg.sender == WETH); // only accept ETH via fallback from the WETH contract
    }
}
