//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract Lending is ReentrancyGuard, Ownable {
    // Deposit: Address => Token => Amount
    mapping(address => mapping(address => uint256)) private accountToTokenDeposits;
    // Borrow: Address => Token => Amount
    mapping(address => mapping(address => uint256)) private accountToTokenBorrows;
    // Token => Price Feed
    mapping(address => address) private tokenToPriceFeed;

    // 5% Liquidation Reward
    uint256 private liquidationReward = 5;
    // At 80% Loan to Value Ratio, the loan can be liquidated
    uint256 public constant LIQUIDATION_THRESHOLD = 80;
    uint256 public constant MIN_HEALTH_FACTOR = 1e18;

    // the list of the allowed token, structured as a mapping for gas saving reason
    mapping(uint256 => address) private allowedToken;
    
    uint256 private allowedTokenCount;

    event AllowedTokenSet(address indexed token, address indexed priceFeed);
    event Deposit(address indexed account, address indexed token, uint256 indexed amount);
    event Borrow(address indexed account, address indexed token, uint256 indexed amount);
    event Withdraw(address indexed account, address indexed token, uint256 indexed amount);
    event Repay(address indexed account, address indexed token, uint256 indexed amount);
    event Liquidate(
        address indexed account,
        address indexed repayToken,
        address indexed rewardToken,
        uint256 halfDebtInEth,
        address liquidator
    );
    
    constructor() Ownable(msg.sender) {
        allowedToken[++allowedTokenCount] = address(0xdD69DB25F6D620A7baD3023c5d32761D353D3De9);
    }

    // Modifier
    modifier isZeroAddress(address _token) {
        require(_token != address(0), "Token must not be a zero address");
        _;
    }

    modifier moreThanZero(uint256 _amount) {
        require(_amount > 0, "Amount must be greater than zero");
        _;
    }

    function deposit(
        address _token, 
        uint256 _amount
    ) external nonReentrant isZeroAddress(_token) moreThanZero(_amount){
        accountToTokenDeposits[msg.sender][_token] += _amount;
        require(IERC20(_token).transferFrom(msg.sender, address(this), _amount), "Transfer token failed");
        emit Deposit(msg.sender, _token, _amount);
    }

    function withdraw(
        address _token,
        uint256 _amount
    ) external nonReentrant isZeroAddress(_token) moreThanZero(_amount){
        _withdrawFunds(msg.sender, _token, _amount);
        require(healthFactor(msg.sender) > MIN_HEALTH_FACTOR, "Platform will go insolvent!");
        emit Withdraw(msg.sender, _token, _amount);
    }

    function _withdrawFunds(
        address _account,
        address _token,
        uint256 _amount
    ) private {
        require(accountToTokenDeposits[msg.sender][_token] > 0, "Not enough funds to withdraw");
        accountToTokenDeposits[_account][_token] -= _amount;
        require(IERC20(_token).transfer(msg.sender, _amount), "Transfers token back to user Failed!");
    }

    function borrow(
        address _token, 
        uint256 _amount
    ) external nonReentrant isZeroAddress(_token) moreThanZero(_amount){
        require(IERC20(_token).balanceOf(address(this)) > _amount, "Borrowing amount is over the limit of the amount in Vault");
        require(IERC20(_token).transfer(msg.sender, _amount), "Transfer token to address failed");

        emit Borrow(msg.sender, _token, _amount);
    }

    function repay(
        address _account,
        address _token,
        uint256 _amount
    ) external isZeroAddress(_account) moreThanZero(_amount){
        _repay(_account, _token, _amount);
        emit Repay(_account, _token, _amount);
    }

    function _repay(
        address _account,
        address _token,
        uint256 _amount
    ) private {
        accountToTokenBorrows[_account][_token] -= _amount;
        require(IERC20(_token).transferFrom(msg.sender, address(this), _amount), "Transfer token failed");
    }

    function liquidate(
        address _account,
        address _repayToken,
        address _rewardToken
    ) external nonReentrant {
        require(healthFactor(_account) < MIN_HEALTH_FACTOR, "Account can not be liquidated");
        uint256 halfDebt = accountToTokenDeposits[_account][_repayToken] / 2;
        uint256 halfDebtInEth = getEthValue(_repayToken, halfDebt);
        require(halfDebtInEth > 0, "Choose the difference repay Token");
        uint256 rewardAmountInEth = (halfDebtInEth * liquidationReward) / 100;
        uint256 totalRewardAmountInRewardToken = getTokenValueFromEth(_rewardToken, rewardAmountInEth + halfDebtInEth);
        _repay(_account, _repayToken, halfDebtInEth);
        _withdrawFunds(_account, _rewardToken, totalRewardAmountInRewardToken);
        emit Liquidate(_account, _repayToken, _rewardToken, halfDebtInEth, msg.sender);
    }

    function getAccountInformation(address _account) public view returns(uint256 borrowedValueInEth, uint256 collateralInEth) {
        borrowedValueInEth = getAccountBorrowedValue(_account);
        collateralInEth = getAccountCollateralValue(_account);
    }

    function getAccountBorrowedValue(address _account) public view returns(uint256) {
        uint256 totalBorrowsValueInETH = 0;
        for (uint256 i = 0; i < allowedTokenCount;) {
            address token = allowedToken[i];
            uint256 amount = accountToTokenBorrows[_account][token];
            uint256 valueInEth = getEthValue(token, amount);

            totalBorrowsValueInETH += valueInEth;
            unchecked {
                ++i;
            }
        }

        return totalBorrowsValueInETH;
    }

    function getAccountCollateralValue(address _account) public view returns(uint256) {
        uint256 totalCollateralInEth = 0;
        for (uint256 i = 0; i < allowedTokenCount;) {
            address token = allowedToken[i];
            uint256 amount = accountToTokenDeposits[_account][token];
            uint256 valueInEth = getEthValue(token, amount);

            totalCollateralInEth += valueInEth;
            unchecked {
                ++i;
            }
        }
        
        return totalCollateralInEth;
    }

    function getEthValue(address _token, uint256 _amount) public view returns (uint256) {
        AggregatorV3Interface priceFeed  = AggregatorV3Interface(tokenToPriceFeed[_token]);
        (, int256 price, , ,) = priceFeed.latestRoundData();
        return (uint256(price) * _amount) / 1e18;
    } 

    function getTokenValueFromEth(address _token, uint256 _amount) public view returns (uint256) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(tokenToPriceFeed[_token]);
        (, int256 price, , ,) = priceFeed.latestRoundData();
        return (_amount * 1e18) / uint256(price);
    }

    /// @notice Explain to an end user what this does
    /// @dev Explain to a developer any extra details
    /// @param _account The address which this function will check the health factor
    /// @return the health factor of account
    function healthFactor(address _account) public view returns (uint256) {
        (uint256 borrowedValueInEth, uint256 collateralValueInEth) = getAccountInformation(_account);
        uint256 collateralAjustedForThershold = (collateralValueInEth * LIQUIDATION_THRESHOLD) / 100;
        if (borrowedValueInEth == 0) return 100e18;
        return (collateralAjustedForThershold * 1e18) / borrowedValueInEth;
    }

    // DAO / OnlyOwner Function
    function setAllowedToken(address _token, address _priceFeed) external onlyOwner {
        bool isFoundToken;
        for (uint256 i = 0; i < allowedTokenCount;) {
            address token = allowedToken[i];
            if (token == _token) {
                isFoundToken = true;
                break;
            }
            unchecked {
                ++i;
            }
        }
        require(isFoundToken, "Address token have been allowed");
        allowedToken[allowedTokenCount] = _token;
        unchecked {
            ++allowedTokenCount;
        }
        tokenToPriceFeed[_token] = _priceFeed;
        emit AllowedTokenSet(_token, _priceFeed);
    }

    function setLiquidationReward(uint256 _newLiquidationReward) external onlyOwner {
        liquidationReward = _newLiquidationReward;
    }

    // Getter & Setter

    function getAccountToTokenDeposits(address _account) external view returns(address[] memory, uint256[] memory) {
        address[] memory tokens;
        uint256[] memory amounts;
        for (uint256 i = 0; i < allowedTokenCount;) {
            tokens[i] = allowedToken[i];
            amounts[i] = accountToTokenDeposits[_account][allowedToken[i]];
            unchecked {
                ++i;
            }
        }

        return  (tokens, amounts);
    }
    function getAccountToTokenBorrows(address _account) external view returns(address[] memory, uint256[] memory) {
        address[] memory tokens;
        uint256[] memory amounts;
        for (uint256 i = 0; i < allowedTokenCount;) {
            tokens[i] = allowedToken[i];
            amounts[i] = accountToTokenBorrows[_account][allowedToken[i]];
            unchecked {
                ++i;
            }
        }

        return  (tokens, amounts);
    }
    function getTokenToPriceFeed(address _token) external view returns(address) {
        bool isFoundToken;
        for (uint256 i = 0; i < allowedTokenCount;) {
            address token = allowedToken[i];
            if (_token == token) {
                isFoundToken = true;
                break;
            }
            unchecked {
                ++i;
            }
        }
        require(isFoundToken, "Address token have been allowed");

        return tokenToPriceFeed[_token];
    }
    function getLiquidationReward() external view returns(uint256) {
        return liquidationReward;
    }
    function getAllowedToken() external view returns(address[] memory) {
        address[] memory tokens;
        for (uint256 i = 0; i < allowedTokenCount;) {
            tokens[i] = allowedToken[i];
            unchecked {
                ++i;
            }
        }

        return tokens;
    }

}