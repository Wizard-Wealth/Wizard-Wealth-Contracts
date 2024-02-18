//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Libraries
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

// Inheritance
import "../interfaces/IStakingRewards.sol";
import "../Pausable.sol";

contract StakingReward is Pausable, ReentrancyGuard, IStakingRewards {
    using Math for uint256;
    using SafeERC20 for IERC20;

    /* STATE VARIABLES */
    IERC20 public rewardsToken;
    IERC20 public stakingToken;

    uint256 public periodFinish;
    uint256 public rewardsDuration = 7 days;
    uint256 public lastUpdateTime;
    uint256 public rewardRate;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    // total staking amount in this contract.
    uint256 private _totalSupply;
    // staking amount token per user in this contract.
    mapping(address => uint256) private _balances;

    constructor(
        address _owner,
        address _rewardsToken,
        address _stakingToken
    ) Pausable(_owner) {
        rewardsToken = IERC20(_rewardsToken);
        stakingToken = IERC20(_stakingToken);
    }

    modifier updateReward(address _account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        // calculate the reward token user can claim
        if (_account != address(0)) {
            rewards[_account] = earned(_account);
            userRewardPerTokenPaid[msg.sender] = rewardPerTokenStored;
        }
        _;
    }

    // View Functions

    function balanceOf(address _account) public view returns (uint256) {
        return _balances[_account];
    }

    function earned(address _account) public view returns (uint256) {
        return
            ((_balances[_account] *
                (rewardPerToken() - userRewardPerTokenPaid[_account])) / 1e18) +
            rewards[_account];
    }

    function getRewardForDuration() public view returns (uint256) {
        (, uint256 reward) = rewardRate.tryMul(rewardsDuration);
        return reward;
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return Math.min(block.timestamp, periodFinish);
    }

    function rewardPerToken() public view returns (uint256) {
        if (_totalSupply == 0) return rewardPerTokenStored;
        return
            rewardPerTokenStored +
            ((rewardRate *
                (lastTimeRewardApplicable() - lastUpdateTime) *
                1e18) / _totalSupply);
    }

    // Getter Functions
    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    // Setter Functions
    function setRewardsDuration(uint256 _duration) external onlyOwner {
        require(periodFinish < block.timestamp, "Reward duration not finished");
        rewardsDuration = _duration;
    }

    function setRewardsToken(address _token) external onlyOwner {
        require(
            _token != address(rewardsToken),
            "New rewards token must be different from the old one"
        );
        rewardsToken = IERC20(_token);
    }

    function setStakingToken(address _token) external onlyOwner {
        require(
            _token != address(stakingToken),
            "New staking token must be different from the old one"
        );
        stakingToken = IERC20(_token);
    }

    function decreaseRewardRate(uint256 _rate) external onlyOwner {
        require(
            rewardRate != _rate,
            "New reward rate must be different from the old one"
        );
        require(
            _rate < rewardRate,
            "New reward rate must be lower than the old one"
        );
        rewardRate = _rate;
    }

    // Mutative Functions

    function getReward() external updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        rewards[msg.sender] = 0;
        rewardsToken.transfer(msg.sender, reward);
        emit RewardClaimed(msg.sender, reward);
    }

    function stake(uint256 _amount) external updateReward(msg.sender) {
        require(_amount > 0, "Amount must be greater than zero");
        _totalSupply += _amount;
        _balances[msg.sender] += _amount;
        stakingToken.transferFrom(msg.sender, address(this), _amount);
        emit Staked(msg.sender, _amount);
    }

    function withdraw(uint256 _amount) external updateReward(msg.sender) {
        require(_amount > 0, "Amount must be greater than zero");
        _totalSupply -= _amount;
        _balances[msg.sender] -= _amount;
        stakingToken.transfer(msg.sender, _amount);
        emit Withdraw(msg.sender, _amount);
    }

    function notifyRewardAmount(
        uint256 _amount
    ) external onlyOwner updateReward(address(0)) {
        if (block.timestamp >= periodFinish) {
            rewardRate = _amount / rewardsDuration;
        } else {
            uint256 remainingRewards = (periodFinish - block.timestamp) *
                rewardRate;
            rewardRate = (_amount + remainingRewards) / rewardsDuration;
        }

        require(rewardRate > 0, "Reward rate must be positive");
        require(
            rewardRate * rewardsDuration <=
                rewardsToken.balanceOf(address(this)),
            "Reward Amount > Balance"
        );

        periodFinish = block.timestamp + rewardsDuration;
        lastUpdateTime = block.timestamp;
    }

    // Event
    event Staked(address account, uint256 amount);
    event Withdraw(address account, uint256 amount);
    event RewardClaimed(address account, uint256 amount);
}
