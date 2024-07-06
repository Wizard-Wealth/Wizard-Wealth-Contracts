//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "hardhat/console.sol";

contract Lending is ReentrancyGuard, Ownable {
    // Deposit: Address => Token => Amount
    mapping(address => mapping(address => uint256))
        private accountToTokenDeposits;
    // Borrow: Address => Token => Amount
    mapping(address => mapping(address => uint256))
        private accountToTokenBorrows;
    // Token => Price Feed
    mapping(address => address) private tokenToPriceFeed;
    // Deposit: Address => Token => Timestamp
    mapping(address => mapping(address => uint256)) private depositTimestamp;
    // Borrow: Address => Token => Timestamp
    mapping(address => mapping(address => uint256)) private borrowTimestamp;

    // 5% Liquidation Reward
    uint256 private liquidationReward = 500;
    // At 80% Loan to Value Ratio, the loan can be liquidated
    uint256 public constant LIQUIDATION_THRESHOLD = 8000;
    uint256 public constant MIN_HEALTH_FACTOR = 1e18;
    uint256 public constant SECONDS_IN_WEEK = 604800;
    // Deposit, Borrow Interest rate: 5% and 10% per week
    uint256 private depositInterestRate = 500;
    uint256 private borrowInterestRate = 1000;
    // // Assuming fixed interest rates (for simplicity)
    // uint256 public constant COMPOUNDING_PERIODS = 4; // Quarterly compounding

    // the list of the allowed token, structured as a mapping for gas saving reason
    mapping(uint256 => address) private allowedToken;

    mapping(address => bool) private isAllowedToken;

    uint256 private allowedTokenCount;

    event AllowedTokenSet(address indexed token, address indexed priceFeed);
    event Deposit(
        address indexed account,
        address indexed token,
        uint256 indexed amount
    );
    event Borrow(
        address indexed account,
        address indexed token,
        uint256 indexed amount
    );
    event Withdraw(
        address indexed account,
        address indexed token,
        uint256 indexed amount
    );
    event Repay(
        address indexed account,
        address indexed token,
        uint256 indexed amount
    );
    event Liquidate(
        address indexed account,
        address indexed repayToken,
        address indexed rewardToken,
        uint256 halfDebtInEth,
        address liquidator
    );

    constructor() Ownable(msg.sender) {}

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
    ) external nonReentrant isZeroAddress(_token) moreThanZero(_amount) {
        // Calculate interest accrued on existing deposits before adding new deposits
        _calculateDepositInterestAccrued(msg.sender, _token);
        // Update user's deposit balance
        accountToTokenDeposits[msg.sender][_token] += _amount;
        // Update the deposit timestamp for the user and token
        depositTimestamp[msg.sender][_token] = block.timestamp;
        require(
            IERC20(_token).transferFrom(msg.sender, address(this), _amount),
            "Transfer token failed"
        );
        emit Deposit(msg.sender, _token, _amount);
    }

    function _calculateDepositInterestAccrued(
        address _account,
        address _token
    ) internal {
        // Get time for last deposit
        uint256 timeStampLastDeposit = block.timestamp -
            depositTimestamp[_account][_token];
        // Calculate interest accrued on existing deposits
        uint256 interestAccrued = (accountToTokenDeposits[_account][_token] *
            depositInterestRate *
            timeStampLastDeposit) /
            SECONDS_IN_WEEK /
            10000;
        // Add to interest accrued to the user's deposit balance
        accountToTokenDeposits[_account][_token] += interestAccrued;
    }

    function withdraw(
        address _token,
        uint256 _amount
    ) external nonReentrant isZeroAddress(_token) moreThanZero(_amount) {
        _withdrawFunds(msg.sender, _token, _amount);
        require(
            healthFactor(msg.sender) > MIN_HEALTH_FACTOR,
            "Platform will go insolvent!"
        );
        emit Withdraw(msg.sender, _token, _amount);
    }

    function _withdrawFunds(
        address _account,
        address _token,
        uint256 _amount
    ) internal {
        require(
            accountToTokenDeposits[msg.sender][_token] > 0,
            "Insufficient funds to withdraw"
        );
        // Calculate interest accrued on the amount being withdrawn
        uint256 interestAccrued = _calculateDepositInterest(
            _account,
            _token,
            _amount
        );
        accountToTokenDeposits[_account][_token] -= _amount;
        uint256 amountToTransfer = _amount + interestAccrued;
        require(
            IERC20(_token).transfer(msg.sender, amountToTransfer),
            "Transfers token back to user Failed!"
        );
    }

    function _calculateDepositInterest(
        address _account,
        address _token,
        uint256 _amount
    ) internal view returns (uint256) {
        // Get time since deposit
        uint256 timeSinceDeposit = block.timestamp -
            depositTimestamp[_account][_token];
        // Calculate interest rate based on the time since depositing
        uint256 interestRate = (depositInterestRate * timeSinceDeposit) /
            SECONDS_IN_WEEK;
        // Calculate interest accrued on the amount being withdrawn
        uint256 interestAccrued = (_amount * interestRate) / 10000;

        return interestAccrued;
    }

    function _calculateBorrowInterest(
        address _account,
        address _token
    ) internal view returns (uint256) {
        // Get time for last borrow
        uint256 timeStampLastBorrow = block.timestamp -
            borrowTimestamp[_account][_token];
        // Calculate interest accrued on existing borrows
        uint256 interestAccrued = (accountToTokenBorrows[_account][_token] *
            borrowInterestRate *
            timeStampLastBorrow) /
            SECONDS_IN_WEEK /
            10000;
        return interestAccrued;
    }

    function _calculateBorrowInterestAccrued(
        address _account,
        address _token
    ) internal {
        uint256 interestAccrued = _calculateBorrowInterest(_account, _token);
        // Add to interest accrused to the user's borrow balance
        accountToTokenBorrows[_account][_token] += interestAccrued;
    }

    function calculateMaxRepayAmount(
        address _account,
        address _token
    ) public view returns (uint256) {
        uint256 interestAccrued = _calculateBorrowInterest(_account, _token);
        return accountToTokenBorrows[_account][_token] + interestAccrued;
    }

    function borrow(
        address _token,
        uint256 _amount
    ) external nonReentrant isZeroAddress(_token) moreThanZero(_amount) {
        require(
            IERC20(_token).balanceOf(address(this)) >= _amount,
            "Borrowing amount is over the limit of the amount in Vault"
        );

        _calculateBorrowInterestAccrued(msg.sender, _token);
        accountToTokenBorrows[msg.sender][_token] += _amount;
        borrowTimestamp[msg.sender][_token] = block.timestamp;

        require(
            IERC20(_token).transfer(msg.sender, _amount),
            "Transfer token to address failed"
        );
        require(
            healthFactor(msg.sender) >= MIN_HEALTH_FACTOR,
            "Platform will go insolvent!"
        );
        emit Borrow(msg.sender, _token, _amount);
    }

    function repay(
        address _token,
        uint256 _amount
    ) external isZeroAddress(_token) moreThanZero(_amount) {
        emit Repay(msg.sender, _token, _amount);
        _repay(msg.sender, _token, _amount);
    }

    function repayAllBorrowedToken(
        address _token
    ) external isZeroAddress(_token) {
        uint256 _amount = calculateMaxRepayAmount(msg.sender, _token);
        emit Repay(msg.sender, _token, _amount);
        _repay(msg.sender, _token, _amount);
    }

    function _repay(
        address _account,
        address _token,
        uint256 _amount
    ) internal {
        _calculateBorrowInterestAccrued(_account, _token);
        require(
            IERC20(_token).balanceOf(_account) >= _amount,
            "Insufficient balance to repay"
        );
        accountToTokenBorrows[_account][_token] -= _amount;
        require(
            IERC20(_token).transferFrom(msg.sender, address(this), _amount),
            "Transfer token failed"
        );
    }

    function liquidate(
        address _account,
        address _repayToken,
        address _rewardToken
    ) external nonReentrant {
        require(
            healthFactor(_account) < MIN_HEALTH_FACTOR,
            "Account can not be liquidated"
        );
        uint256 halfDebt = accountToTokenDeposits[_account][_repayToken] / 2;
        uint256 halfDebtInEth = getEthValue(_repayToken, halfDebt);
        require(halfDebtInEth > 0, "Choose the difference repay Token");
        uint256 rewardAmountInEth = (halfDebtInEth * liquidationReward) / 10000;
        uint256 totalRewardAmountInRewardToken = getTokenValueFromEth(
            _rewardToken,
            rewardAmountInEth + halfDebtInEth
        );
        _repay(_account, _repayToken, halfDebtInEth);
        _withdrawFunds(_account, _rewardToken, totalRewardAmountInRewardToken);
        emit Liquidate(
            _account,
            _repayToken,
            _rewardToken,
            halfDebtInEth,
            msg.sender
        );
    }

    function getAccountInformation(
        address _account
    )
        public
        view
        returns (uint256 borrowedValueInEth, uint256 collateralInEth)
    {
        borrowedValueInEth = getAccountBorrowedValue(_account);
        collateralInEth = getAccountCollateralValue(_account);
    }

    function getAccountBorrowedValue(
        address _account
    ) public view returns (uint256) {
        uint256 totalBorrowsValueInETH = 0;
        uint256 _allowedTokenCount = allowedTokenCount;
        for (uint256 i = 0; i < _allowedTokenCount; i++) {
            address token = allowedToken[i];
            uint256 amount = accountToTokenBorrows[_account][token];
            uint256 valueInEth = getEthValue(token, amount);
            totalBorrowsValueInETH += valueInEth;
        }

        return totalBorrowsValueInETH;
    }

    function getAccountCollateralValue(
        address _account
    ) public view returns (uint256) {
        uint256 totalCollateralInEth = 0;
        uint256 _allowedTokenCount = allowedTokenCount;
        for (uint256 i = 0; i < _allowedTokenCount; i++) {
            address token = allowedToken[i];
            uint256 amount = accountToTokenDeposits[_account][token];
            uint256 valueInEth = getEthValue(token, amount);

            totalCollateralInEth += valueInEth;
        }

        return totalCollateralInEth;
    }

    function getEthValue(
        address _token,
        uint256 _amount
    ) public view returns (uint256) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(
            tokenToPriceFeed[_token]
        );
        (, int256 price, , , ) = priceFeed.latestRoundData();
        return (uint256(price) * _amount) / 1e18;
    }

    function getTokenValueFromEth(
        address _token,
        uint256 _amount
    ) public view returns (uint256) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(
            tokenToPriceFeed[_token]
        );
        (, int256 price, , , ) = priceFeed.latestRoundData();
        return (_amount * 1e18) / uint256(price);
    }

    function healthFactor(address _account) public view returns (uint256) {
        (
            uint256 borrowedValueInEth,
            uint256 collateralValueInEth
        ) = getAccountInformation(_account);
        return
            _healthFactorByValueInEth(borrowedValueInEth, collateralValueInEth);
    }

    function adjustHealthFactorByBorrow(
        address _token,
        uint256 _amount
    ) public view returns (uint256) {
        require(isAllowedToken[_token], "Address token have not been allowed");
        uint256 amountValueInEth = getEthValue(_token, _amount);

        (
            uint256 borrowedValueInEth,
            uint256 collateralValueInEth
        ) = getAccountInformation(msg.sender);

        return
            _healthFactorByValueInEth(
                borrowedValueInEth + amountValueInEth,
                collateralValueInEth
            );
    }

    function _healthFactorByValueInEth(
        uint256 borrowedValueInEth,
        uint256 collateralValueInEth
    ) internal pure returns (uint256) {
        uint256 collateralAjustedForThershold = (collateralValueInEth *
            LIQUIDATION_THRESHOLD) / 10000;
        if (borrowedValueInEth == 0) return 100e18;
        return (collateralAjustedForThershold * 1e18) / borrowedValueInEth;
    }

    // function calculateAPY(address _account) external view returns (uint256) {
    //     uint256 totalDeposits = getAccountToTokenDeposits(_account);
    //     uint256 totalBorrows = getAccountToTokenBorrows(_account);

    //     // Calculate interest earned on deposits
    //     uint256 interestEarned = (totalDeposits * depositInterestRate) / 100;

    //     // Calculate interest paid on borrows
    //     uint256 interestPaid = (totalBorrows * borrowInterestRate) / 100;

    //     // Adjust for compounding (for simplicity, assuming quarterly compounding)
    //     interestEarned = compoundInterest(interestEarned, COMPOUNDING_PERIODS);
    //     interestPaid = compoundInterest(interestPaid, COMPOUNDING_PERIODS);

    //     // Calculate APY
    //     uint256 APY = ((1 + (interestEarned / totalDeposits)) *
    //         (1 - (interestPaid / totalBorrows)) -
    //         1) * 100;

    //     return APY;
    // }

    // function compoundInterest(
    //     uint256 _amount,
    //     uint256 _periods
    // ) internal pure returns (uint256) {
    //     return _amount * ((1 + (_amount / 100)) ** _periods);
    // }

    function setAllowedToken(
        address _token,
        address _priceFeed
    ) external onlyOwner {
        require(!isAllowedToken[_token], "Address token have been allowed");
        isAllowedToken[_token] = true;

        uint256 _allowedTokenCount = allowedTokenCount;
        allowedToken[_allowedTokenCount++] = _token;
        allowedTokenCount = _allowedTokenCount;
        tokenToPriceFeed[_token] = _priceFeed;
        emit AllowedTokenSet(_token, _priceFeed);
    }

    function setLiquidationReward(
        uint256 _newLiquidationReward
    ) external onlyOwner {
        liquidationReward = _newLiquidationReward;
    }

    // Getter & Setter

    function getAccountToTokenDeposits(
        address _account
    ) external view returns (address[] memory, uint256[] memory) {
        uint256 _allowedTokenCount = allowedTokenCount;
        address[] memory tokens = new address[](_allowedTokenCount);
        uint256[] memory amounts = new uint256[](_allowedTokenCount);
        for (uint256 i = 0; i < _allowedTokenCount; i++) {
            tokens[i] = allowedToken[i];
            amounts[i] = accountToTokenDeposits[_account][allowedToken[i]];
        }

        return (tokens, amounts);
    }

    function getAccountToTokenBorrows(
        address _account
    ) external view returns (address[] memory, uint256[] memory) {
        uint256 _allowedTokenCount = allowedTokenCount;
        address[] memory tokens = new address[](_allowedTokenCount);
        uint256[] memory amounts = new uint256[](_allowedTokenCount);
        for (uint256 i = 0; i < _allowedTokenCount; i++) {
            tokens[i] = allowedToken[i];
            amounts[i] = accountToTokenBorrows[_account][allowedToken[i]];
        }

        return (tokens, amounts);
    }

    function getTokenToPriceFeed(
        address _token
    ) external view returns (address) {
        bool isFoundToken;
        uint256 _allowedTokenCount = allowedTokenCount;
        for (uint256 i = 0; i < _allowedTokenCount; i++) {
            address token = allowedToken[i];
            if (_token == token) {
                isFoundToken = true;
                break;
            }
        }
        require(isFoundToken, "Address token have not been allowed");

        return tokenToPriceFeed[_token];
    }

    function getLiquidationReward() external view returns (uint256) {
        return liquidationReward;
    }

    function getDepositInterestRate() external view returns (uint256) {
        return depositInterestRate;
    }

    function getBorrowInterestRate() external view returns (uint256) {
        return borrowInterestRate;
    }

    function getAllowedToken() external view returns (address[] memory) {
        uint256 _allowedTokenCount = allowedTokenCount;
        address[] memory tokens = new address[](_allowedTokenCount);
        for (uint256 i = 0; i < _allowedTokenCount; i++) {
            tokens[i] = allowedToken[i];
        }

        return tokens;
    }

    // enable receiving ETH functionality
    // receive() external payable {}
}
