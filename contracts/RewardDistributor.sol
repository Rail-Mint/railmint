// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface ICreatorRegistry {
    struct Creator {
        uint256 id;
        address wallet;
        string xHandle;
        bytes32 profileHash;
        uint256 registeredAt;
        bool isActive;
    }
    
    function getCreator(uint256 _creatorId) external view returns (Creator memory);
}

/**
 * @title RewardDistributor
 * @dev Distributes BNB rewards to creators based on performance epochs
 */
contract RewardDistributor is Ownable, ReentrancyGuard, Pausable {
    // Custom errors
    error InvalidRegistryAddress();
    error InvalidTimeRange();
    error StartTimeMustBeFuture();
    error ArrayLengthMismatch();
    error EmptyArrays();
    error RewardsAlreadyDistributed();
    error EpochNotEndedYet();
    error AmountMustBeGreaterThanZero();
    error CreatorNotFound();
    error CreatorNotActive();
    error InsufficientContractBalance();
    error InvalidEpochId();
    error NoRewardForCreator();
    error RewardAlreadyClaimed();
    error NoRewardToClaim();
    error TransferFailed();
    error InsufficientBalance();
    error MaxEpochDurationExceeded();
    error RewardCapExceeded();
    error ZeroAddress();

    struct Epoch {
        uint256 id;
        uint256 startTime;
        uint256 endTime;
        uint256 totalRewards;
        bool distributed;
        uint256 distributedAt;
    }

    struct CreatorReward {
        uint256 epochId;
        uint256 creatorId;
        uint256 amount;
        bool claimed;
        uint256 claimedAt;
    }

    // State variables
    uint256 private _epochIdCounter;
    ICreatorRegistry public creatorRegistry;
    
    // Max epoch duration (90 days)
    uint256 public constant MAX_EPOCH_DURATION = 90 days;
    // Max reward per creator in an epoch (100 BNB)
    uint256 public constant MAX_REWARD_PER_CREATOR = 100e18;
    // Max total rewards per epoch (10000 BNB)
    uint256 public constant MAX_TOTAL_REWARDS = 10000e18;
    
    // Mappings
    mapping(uint256 => Epoch) public epochs;
    mapping(uint256 => mapping(uint256 => CreatorReward)) public rewards; // epochId => creatorId => reward
    mapping(uint256 => uint256[]) public epochCreators; // epochId => creatorIds[]
    mapping(address => uint256) public pendingWithdrawals;
    
    // Reverse mapping for O(1) claim lookup: epochId => creatorWallet => creatorId
    mapping(uint256 => mapping(address => uint256)) public epochCreatorByWallet;
    
    // Events
    event EpochCreated(
        uint256 indexed epochId,
        uint256 startTime,
        uint256 endTime,
        uint256 timestamp
    );
    
    event RewardsDistributed(
        uint256 indexed epochId,
        uint256[] creatorIds,
        uint256[] amounts,
        uint256 timestamp
    );
    
    event RewardClaimed(
        uint256 indexed epochId,
        uint256 indexed creatorId,
        address indexed wallet,
        uint256 amount,
        uint256 timestamp
    );
    
    event FundsDeposited(
        address indexed sender,
        uint256 amount,
        uint256 timestamp
    );

    event EmergencyPause(address indexed pauser, uint256 timestamp);
    event EmergencyUnpause(address indexed unpauser, uint256 timestamp);
    
    constructor(address _creatorRegistry) Ownable(msg.sender) {
        if (_creatorRegistry == address(0)) revert ZeroAddress();
        creatorRegistry = ICreatorRegistry(_creatorRegistry);
        _epochIdCounter = 1; // Start IDs from 1
    }

    /**
     * @dev Receive BNB for reward pool
     */
    receive() external payable whenNotPaused {
        emit FundsDeposited(msg.sender, msg.value, block.timestamp);
    }

    /**
     * @dev Create a new reward epoch
     * @param _startTime Epoch start timestamp
     * @param _endTime Epoch end timestamp
     * @return uint256 The newly assigned epoch ID
     */
    function createEpoch(
        uint256 _startTime,
        uint256 _endTime
    ) external onlyOwner whenNotPaused returns (uint256) {
        if (_startTime >= _endTime) revert InvalidTimeRange();
        if (_startTime < block.timestamp) revert StartTimeMustBeFuture();
        if (_endTime - _startTime > MAX_EPOCH_DURATION) revert MaxEpochDurationExceeded();

        uint256 epochId = _epochIdCounter++;
        
        epochs[epochId] = Epoch({
            id: epochId,
            startTime: _startTime,
            endTime: _endTime,
            totalRewards: 0,
            distributed: false,
            distributedAt: 0
        });

        emit EpochCreated(epochId, _startTime, _endTime, block.timestamp);

        return epochId;
    }

    /**
     * @dev Distribute rewards to creators for an epoch
     * @param _epochId Epoch ID
     * @param _creatorIds Array of creator IDs
     * @param _amounts Array of reward amounts (in wei)
     */
    function distributeRewards(
        uint256 _epochId,
        uint256[] memory _creatorIds,
        uint256[] memory _amounts
    ) external onlyOwner nonReentrant whenNotPaused {
        if (_epochId == 0 || _epochId >= _epochIdCounter) revert InvalidEpochId();
        if (_creatorIds.length != _amounts.length) revert ArrayLengthMismatch();
        if (_creatorIds.length == 0) revert EmptyArrays();
        if (epochs[_epochId].distributed) revert RewardsAlreadyDistributed();
        if (block.timestamp < epochs[_epochId].endTime) revert EpochNotEndedYet();

        uint256 totalAmount = 0;
        
        for (uint256 i = 0; i < _creatorIds.length; i++) {
            uint256 creatorId = _creatorIds[i];
            uint256 amount = _amounts[i];
            
            if (amount == 0) revert AmountMustBeGreaterThanZero();
            if (amount > MAX_REWARD_PER_CREATOR) revert RewardCapExceeded();
            
            // Verify creator exists and is active
            ICreatorRegistry.Creator memory creator = creatorRegistry.getCreator(creatorId);
            if (creator.id == 0) revert CreatorNotFound();
            if (!creator.isActive) revert CreatorNotActive();
            
            // Store reward
            rewards[_epochId][creatorId] = CreatorReward({
                epochId: _epochId,
                creatorId: creatorId,
                amount: amount,
                claimed: false,
                claimedAt: 0
            });
            
            // Add to pending withdrawals
            pendingWithdrawals[creator.wallet] += amount;
            
            // Store reverse mapping for O(1) lookup
            epochCreatorByWallet[_epochId][creator.wallet] = creatorId;
            
            totalAmount += amount;
            epochCreators[_epochId].push(creatorId);
        }
        
        if (totalAmount > MAX_TOTAL_REWARDS) revert RewardCapExceeded();
        if (address(this).balance < totalAmount) revert InsufficientContractBalance();
        
        epochs[_epochId].totalRewards = totalAmount;
        epochs[_epochId].distributed = true;
        epochs[_epochId].distributedAt = block.timestamp;

        emit RewardsDistributed(_epochId, _creatorIds, _amounts, block.timestamp);
    }

    /**
     * @dev Claim rewards for a specific epoch
     * @param _epochId Epoch ID
     */
    function claimReward(uint256 _epochId) external nonReentrant whenNotPaused {
        if (_epochId == 0 || _epochId >= _epochIdCounter) revert InvalidEpochId();
        if (!epochs[_epochId].distributed) revert EpochNotEndedYet();

        // O(1) lookup instead of O(n) loop
        uint256 creatorId = epochCreatorByWallet[_epochId][msg.sender];
        if (creatorId == 0) revert NoRewardForCreator();
        
        CreatorReward storage reward = rewards[_epochId][creatorId];
        if (reward.claimed) revert RewardAlreadyClaimed();
        if (reward.amount == 0) revert NoRewardToClaim();

        // CEI pattern: Update state BEFORE transfer
        uint256 amount = reward.amount;
        reward.claimed = true;
        reward.claimedAt = block.timestamp;
        pendingWithdrawals[msg.sender] -= amount;

        // Transfer BNB
        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit RewardClaimed(_epochId, creatorId, msg.sender, amount, block.timestamp);
    }

    /**
     * @dev Get epoch details
     * @param _epochId Epoch ID
     * @return Epoch struct
     */
    function getEpoch(uint256 _epochId) external view returns (Epoch memory) {
        if (_epochId == 0 || _epochId >= _epochIdCounter) revert InvalidEpochId();
        return epochs[_epochId];
    }

    /**
     * @dev Get reward details for a creator in an epoch
     * @param _epochId Epoch ID
     * @param _creatorId Creator ID
     * @return CreatorReward struct
     */
    function getReward(uint256 _epochId, uint256 _creatorId) external view returns (CreatorReward memory) {
        return rewards[_epochId][_creatorId];
    }

    /**
     * @dev Get all creators who received rewards in an epoch
     * @param _epochId Epoch ID
     * @return uint256[] Array of creator IDs
     */
    function getEpochCreators(uint256 _epochId) external view returns (uint256[] memory) {
        return epochCreators[_epochId];
    }

    /**
     * @dev Get pending withdrawal amount for an address
     * @param _wallet Wallet address
     * @return uint256 Pending amount
     */
    function getPendingWithdrawal(address _wallet) external view returns (uint256) {
        return pendingWithdrawals[_wallet];
    }

    /**
     * @dev Get contract balance
     * @return uint256 Contract BNB balance
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @dev Withdraw excess funds (only owner)
     * @param _amount Amount to withdraw
     */
    function withdrawExcess(uint256 _amount) external onlyOwner nonReentrant whenNotPaused {
        if (_amount > address(this).balance) revert InsufficientBalance();
        
        (bool success, ) = msg.sender.call{value: _amount}("");
        if (!success) revert TransferFailed();
    }

    /**
     * @dev Pause the contract in case of emergency
     */
    function pause() external onlyOwner whenNotPaused {
        _pause();
        emit EmergencyPause(msg.sender, block.timestamp);
    }

    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyOwner whenPaused {
        _unpause();
        emit EmergencyUnpause(msg.sender, block.timestamp);
    }
}
