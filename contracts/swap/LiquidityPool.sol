// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract LiquidityPool is ERC20 {
    using SafeERC20 for IERC20;

    IERC20 public immutable tokenA;
    IERC20 public immutable weth;

    uint256 private constant MINIMUM_WETH_LIQUIDITY = 1_000_000_000;

    event LiquidityAdded(
        address indexed liquidityProvider,
        uint256 wethDeposited,
        uint256 tokensDeposited
    );
    event LiquidityRemoved(
        address indexed liquidityProvider,
        uint256 wethWithdrawn,
        uint256 poolTokensWithdrawn
    );
    event Swap(
        address indexed swapper,
        address tokenIn,
        uint256 amountTokenIn,
        address tokenOut,
        uint256 amountTokenOut
    );

    modifier revertIfDeadlinePassed(uint64 deadline) {
        require(deadline < uint64(block.timestamp), "Expired deadline");
        _;
    }

    modifier revertIfZero(uint256 amount) {
        require(amount > 0, "Amount is zero");
        _;
    }

    constructor(
        address _tokenA,
        address _weth
    ) ERC20("Liquidity Pool Token", "LPT") {
        require(_tokenA != address(0), "Token A is zero address");
        tokenA = IERC20(_tokenA);
        weth = IERC20(_weth);
    }

    function deposit(
        uint256 wethToDeposit,
        uint256 minimumLiquidityTokensToMint,
        uint256 maximumPoolTokensToDeposit,
        uint256 deadline
    )
        external
        revertIfDeadlinePassed(deadline)
        revertIfZero(wethToDeposit)
        returns (uint256 liquidityTokensToMint)
    {
        require(
            wethToDeposit >= MINIMUM_WETH_LIQUIDITY,
            "Insufficient WETH liquidity"
        );
        if (totalSupply() > 0) {
            uint256 wethReverse = weth.balanceOf(address(this));
            uint256 poolTokensToDeposit = getPoolTokensToDepositBasedOnWeth(
                wethToDeposit
            );

            require(
                poolTokensToMint <= maximumPoolTokensToDeposit,
                "Exceed maximum pool tokens to deposit"
            );
            // In this case: numberOfLiquidityTokensToMint basedOn wethToDeposit

            liquidityTokensToMint =
                (wethToDeposit * totalSupply()) /
                wethReverse;

            require(
                liquidityTokensToMint >= minimumLiquidityTokensToMint,
                "Insufficient liquidity tokens to mint"
            );
            _addLiquidityMintAndTransfer(
                wethToDeposit,
                poolTokensToDeposit,
                liquidityTokensToMint
            );
        }
        // First time deposit
        else {
            liquidityTokensToMint = wethToDeposit;
            _addLiquidityMintAndTransfer(
                wethToDeposit,
                maximumPoolTokensToDeposit,
                wethToDeposit
            );
        }
    }

    function _addLiquidityMintAndTransfer(
        uint256 wethToDeposit,
        uint256 poolTokensToDeposit,
        uint256 liquidityTokensToMint
    ) internal {
        address sender = msg.sender;
        _mint(sender, liquidityTokensToMint);
        emit LiquidityAdded(sender, wethToDeposit, poolTokensToDeposit);
        weth.safeTransferFrom(sender, address(this), wethToDeposit);
        tokenA.safeTransferFrom(sender, address(this), poolTokensToDeposit);
    }

    function withdraw(
        uint256 liquidityTokensToBurn,
        uint256 minWethToWithdraw,
        uint256 minPoolTokensToWithdraw,
        uint256 deadline
    )
        external
        revertIfDeadlinePassed(deadline)
        revertIfZero(liquidityTokensToBurn)
        revertIfZero(minWethToWithdraw)
        revertIfZero(minPoolTokensToWithdraw)
    {
        uint256 wethToWithdraw = (liquidityTokensToBurn *
            weth.balanceOf(address(this))) / totalSupply();
        uint256 poolTokensToWithdraw = (liquidityTokensToBurn *
            tokenA.balanceOf(address(this))) / totalSupply();
        require(wethToWithdraw >= minWethToWithdraw, "Output too low");
        require(
            poolTokensToWithdraw >= minPoolTokensToWithdraw,
            "Output too low"
        );
        _burn(msg.sender, liquidityTokensToBurn);
        emit LiquidityRemoved(msg.sender, wethToWithdraw, poolTokensToWithdraw);

        //$ good
        i_wethToken.safeTransfer(msg.sender, wethToWithdraw);
        i_poolToken.safeTransfer(msg.sender, poolTokensToWithdraw);
    }

    // Get pricing
    // 1 WETH = ? pool tokens
    function getOutputAmountBasedOnInput(
        uint256 inputAmount,
        uint256 inputReserve,
        uint256 outputReserve
    )
        public
        pure
        revertIfZero(inputAmount)
        revertIfZero(outputReserve)
        returns (uint256 outputAmount)
    {
        // x * y = k
        // numberOfWeth * numberOfPoolTokens = constant k
        // weth * poolTokens = k
        // (currentWeth + wethToDeposit) * (currentPoolTokens + poolTokensToDeposit) = k
        // => (totalWethOfPool * totalPoolTokensOfPool) + (totalWethOfPool * poolTokensToDeposit) + (wethToDeposit * totalPoolTokensOfPool) + (wethToDeposit * poolTokensToDeposit) = k
        // => (totalWethOfPool * totalPoolTokensOfPool) + (wethToDeposit * totalPoolTokensOfPool) = k - (totalWethOfPool * poolTokensToDeposit) - (wethToDeposit * poolTokensToDeposit)
        uint256 numerator = inputAmount * outputReserve;
        uint256 denominator = inputReserve + inputAmount;
        outputAmount = numerator / denominator;
    }

    function getInputAmountBasedOnOutput(
        uint256 outputAmount,
        uint256 inputReserve,
        uint256 outputReserve
    )
        public
        pure
        revertIfZero(outputAmount)
        revertIfZero(outputReserve)
        returns (uint256 inputAmount)
    {
        inputAmount =
            (inputReserve * outputAmount) /
            (outputReserve - outputAmount);
    }

    function swapExactInput(
        address inputToken,
        uint256 inputAmount,
        address outputToken,
        uint256 minOutputAmount,
        uint256 deadline
    )
        public
        revertIfZero(inputAmount)
        revertIfDeadlinePassed(deadline)
        returns (uint256 outputAmount)
    {
        uint256 inputReserves = IERC20(inputToken).balanceOf(address(this));
        uint256 outputReserves = IERC20(outputToken).balanceOf(address(this));

        outputAmount = getOutputAmountBasedOnInput(
            inputAmount,
            inputReserves,
            outputReserves
        );

        require(outputAmount >= minOutputAmount, "Output too low");

        _swap(inputToken, inputAmount, outputToken, outputAmount);
    }

    function swapExactOutput(
        address inputToken,
        address outputToken,
        uint256 outputAmount,
        uint256 maxInputAmount,
        uint256 deadline
    )
        public
        revertIfZero(outputAmount)
        revertIfDeadlinePassed(deadline)
        returns (uint256 inputAmount)
    {
        uint256 inputReserves = IERC20(inputToken).balanceOf(address(this));
        uint256 outputReserves = IERC20(outputToken).balanceOf(address(this));

        inputAmount = getInputAmountBasedOnOutput(
            outputAmount,
            inputReserves,
            outputReserves
        );

        require(inputAmount <= maxInputAmount, "Input too high");

        _swap(inputToken, inputAmount, outputToken, outputAmount);
    }

    function sellPoolTokens(
        uint256 poolTokenAmount,
        uint256 minWethReceive
    ) external returns (uint256 wethAmount) {
        return
            swapExactInput(
                address(tokenA),
                poolTokenAmount,
                address(weth),
                minWethReceive,
                block.timestamp
            );
    }

    function _swap(
        address inputToken,
        uint256 inputAmount,
        address outputToken,
        uint256 outputAmount
    ) internal {
        require(
            !_isUnknown(inputToken) && !_isUnknown(outputToken),
            "Unknown token"
        );

        emit Swap(
            msg.sender,
            inputToken,
            inputAmount,
            outputToken,
            outputAmount
        );

        IERC20(inputToken).safeTransferFrom(
            msg.sender,
            address(this),
            inputAmount
        );
        IERC20(outputToken).safeTransfer(msg.sender, outputAmount);
    }

    function getPoolTokensToDepositBasedOnWeth(
        uint256 wethToDeposit
    ) public view returns (uint256 amountPoolTokens) {
        // wethReverse * poolTokenReserve = (wethReverse + wethToDeposit * (poolTokenReserve - amountPoolTokens)
        // => amountPoolTokens = (poolTokenReserve * wethToDeposit) / (wethReverse + wethToDeposit)
        uint256 wethReverse = weth.balanceOf(address(this));
        uint256 poolTokenReserve = tokenA.balanceOf(address(this));
        amountPoolTokens =
            (poolTokenReserve * wethToDeposit) /
            (wethReverse + wethToDeposit);
    }

    function getPoolToken() external view returns (address) {
        return address(tokenA);
    }

    function getWeth() external view returns (address) {
        return address(weth);
    }

    function getPriceOfOneWethInPoolTokens() external view returns (uint256) {
        return
            getOutputAmountBasedOnInput(
                1e18,
                weth.balanceOf(address(this)),
                tokenA.balanceOf(address(this))
            );
    }

    function getPriceOfOneTokenInWeth() external view returns (uint256) {
        return
            getOutputAmountBasedOnInput(
                1e18,
                tokenA.balanceOf(address(this)),
                weth.balanceOf(address(this))
            );
    }

    function _isUnknown(address token) internal view returns (bool) {
        if (token != address(weth) && token != address(tokenA)) {
            return true;
        }
        return false;
    }
}
