// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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
contract RewardDistributor is Ownable, ReentrancyGuard {
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
    
    // Mappings
    mapping(uint256 => Epoch) public epochs;
    mapping(uint256 => mapping(uint256 => CreatorReward)) public rewards; // epochId => creatorId => reward
    mapping(uint256 => uint256[]) public epochCreators; // epochId => creatorIds[]
    mapping(address => uint256) public pendingWithdrawals;
    
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

    constructor(address _creatorRegistry) Ownable(msg.sender) {
        require(_creatorRegistry != address(0), "Invalid registry address");
        creatorRegistry = ICreatorRegistry(_creatorRegistry);
        _epochIdCounter = 1; // Start IDs from 1
    }

    /**
     * @dev Receive BNB for reward pool
     */
    receive() external payable {
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
    ) external onlyOwner returns (uint256) {
        require(_startTime < _endTime, "Invalid time range");
        require(_startTime >= block.timestamp, "Start time must be in future");

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
    ) external onlyOwner nonReentrant {
        require(_epochId > 0 && _epochId < _epochIdCounter, "Invalid epoch ID");
        require(_creatorIds.length == _amounts.length, "Array length mismatch");
        require(_creatorIds.length > 0, "Empty arrays");
        require(!epochs[_epochId].distributed, "Rewards already distributed");
        require(block.timestamp >= epochs[_epochId].endTime, "Epoch not ended yet");

        uint256 totalAmount = 0;
        
        for (uint256 i = 0; i < _creatorIds.length; i++) {
            uint256 creatorId = _creatorIds[i];
            uint256 amount = _amounts[i];
            
            require(amount > 0, "Amount must be greater than 0");
            
            // Verify creator exists and is active
            ICreatorRegistry.Creator memory creator = creatorRegistry.getCreator(creatorId);
            require(creator.id != 0, "Creator not found");
            require(creator.isActive, "Creator is not active");
            
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
            
            totalAmount += amount;
            epochCreators[_epochId].push(creatorId);
        }
        
        require(address(this).balance >= totalAmount, "Insufficient contract balance");
        
        epochs[_epochId].totalRewards = totalAmount;
        epochs[_epochId].distributed = true;
        epochs[_epochId].distributedAt = block.timestamp;

        emit RewardsDistributed(_epochId, _creatorIds, _amounts, block.timestamp);
    }

    /**
     * @dev Claim rewards for a specific epoch
     * @param _epochId Epoch ID
     */
    function claimReward(uint256 _epochId) external nonReentrant {
        require(_epochId > 0 && _epochId < _epochIdCounter, "Invalid epoch ID");
        require(epochs[_epochId].distributed, "Rewards not distributed yet");

        // Find creator's reward in this epoch
        uint256[] memory creatorIds = epochCreators[_epochId];
        uint256 creatorId = 0;
        
        for (uint256 i = 0; i < creatorIds.length; i++) {
            ICreatorRegistry.Creator memory creator = creatorRegistry.getCreator(creatorIds[i]);
            if (creator.wallet == msg.sender) {
                creatorId = creatorIds[i];
                break;
            }
        }
        
        require(creatorId != 0, "No reward for this creator in this epoch");
        
        CreatorReward storage reward = rewards[_epochId][creatorId];
        require(!reward.claimed, "Reward already claimed");
        require(reward.amount > 0, "No reward to claim");

        reward.claimed = true;
        reward.claimedAt = block.timestamp;
        
        uint256 amount = reward.amount;
        pendingWithdrawals[msg.sender] -= amount;

        // Transfer BNB
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit RewardClaimed(_epochId, creatorId, msg.sender, amount, block.timestamp);
    }

    /**
     * @dev Get epoch details
     * @param _epochId Epoch ID
     * @return Epoch struct
     */
    function getEpoch(uint256 _epochId) external view returns (Epoch memory) {
        require(_epochId > 0 && _epochId < _epochIdCounter, "Invalid epoch ID");
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
    function withdrawExcess(uint256 _amount) external onlyOwner nonReentrant {
        require(_amount <= address(this).balance, "Insufficient balance");
        
        (bool success, ) = msg.sender.call{value: _amount}("");
        require(success, "Transfer failed");
    }
}
