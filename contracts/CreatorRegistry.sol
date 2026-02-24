// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title CreatorRegistry
 * @dev Manages creator registrations and profiles on-chain
 */
contract CreatorRegistry is Ownable, ReentrancyGuard, Pausable {
    // Custom errors
    error XHandleCannotBeEmpty();
    error ProfileHashCannotBeEmpty();
    error CreatorAlreadyRegistered();
    error XHandleAlreadyTaken();
    error CreatorNotRegistered();
    error CreatorIsDeactivated();
    error InvalidCreatorId();
    error CreatorAlreadyDeactivated();
    error ZeroAddress();

    struct Creator {
        uint256 id;
        address wallet;
        string xHandle;
        bytes32 profileHash;
        uint256 registeredAt;
        bool isActive;
    }

    // State variables
    uint256 private _creatorIdCounter;
    
    // Mappings
    mapping(uint256 => Creator) public creators;
    mapping(address => uint256) public walletToCreatorId;
    mapping(string => bool) private xHandleExists;
    
    // Events
    event CreatorRegistered(
        uint256 indexed creatorId,
        address indexed wallet,
        string xHandle,
        bytes32 profileHash,
        uint256 timestamp
    );
    
    event CreatorUpdated(
        uint256 indexed creatorId,
        bytes32 newProfileHash,
        uint256 timestamp
    );
    
    event CreatorDeactivated(
        uint256 indexed creatorId,
        uint256 timestamp
    );

    event EmergencyPause(address indexed pauser, uint256 timestamp);
    event EmergencyUnpause(address indexed unpauser, uint256 timestamp);

    constructor() Ownable(msg.sender) {
        _creatorIdCounter = 1; // Start IDs from 1
    }

    /**
     * @dev Register a new creator
     * @param _xHandle Twitter/X handle
     * @param _profileHash Hash of profile data (stored in IPFS/Supabase)
     * @return uint256 The newly assigned creator ID
     */
    function registerCreator(
        string memory _xHandle,
        bytes32 _profileHash
    ) external nonReentrant whenNotPaused returns (uint256) {
        if (bytes(_xHandle).length == 0) revert XHandleCannotBeEmpty();
        if (_profileHash == bytes32(0)) revert ProfileHashCannotBeEmpty();
        if (walletToCreatorId[msg.sender] != 0) revert CreatorAlreadyRegistered();
        if (xHandleExists[_xHandle]) revert XHandleAlreadyTaken();

        uint256 creatorId = _creatorIdCounter++;
        
        creators[creatorId] = Creator({
            id: creatorId,
            wallet: msg.sender,
            xHandle: _xHandle,
            profileHash: _profileHash,
            registeredAt: block.timestamp,
            isActive: true
        });
        
        walletToCreatorId[msg.sender] = creatorId;
        xHandleExists[_xHandle] = true;

        emit CreatorRegistered(
            creatorId,
            msg.sender,
            _xHandle,
            _profileHash,
            block.timestamp
        );

        return creatorId;
    }

    /**
     * @dev Update creator profile hash
     * @param _profileHash New profile hash
     */
    function updateProfile(bytes32 _profileHash) external nonReentrant whenNotPaused {
        uint256 creatorId = walletToCreatorId[msg.sender];
        if (creatorId == 0) revert CreatorNotRegistered();
        if (!creators[creatorId].isActive) revert CreatorIsDeactivated();
        if (_profileHash == bytes32(0)) revert ProfileHashCannotBeEmpty();

        creators[creatorId].profileHash = _profileHash;

        emit CreatorUpdated(creatorId, _profileHash, block.timestamp);
    }

    /**
     * @dev Deactivate a creator (only owner)
     * @param _creatorId Creator ID to deactivate
     */
    function deactivateCreator(uint256 _creatorId) external onlyOwner whenNotPaused {
        if (_creatorId == 0 || _creatorId >= _creatorIdCounter) revert InvalidCreatorId();
        if (!creators[_creatorId].isActive) revert CreatorAlreadyDeactivated();

        creators[_creatorId].isActive = false;

        emit CreatorDeactivated(_creatorId, block.timestamp);
    }

    /**
     * @dev Get creator by ID
     * @param _creatorId Creator ID
     * @return Creator struct
     */
    function getCreator(uint256 _creatorId) external view returns (Creator memory) {
        if (_creatorId == 0 || _creatorId >= _creatorIdCounter) revert InvalidCreatorId();
        return creators[_creatorId];
    }

    /**
     * @dev Get creator ID by wallet address
     * @param _wallet Wallet address
     * @return uint256 Creator ID (0 if not found)
     */
    function getCreatorIdByWallet(address _wallet) external view returns (uint256) {
        return walletToCreatorId[_wallet];
    }

    /**
     * @dev Check if X handle is available
     * @param _xHandle X handle to check
     * @return bool True if available
     */
    function isXHandleAvailable(string memory _xHandle) external view returns (bool) {
        return !xHandleExists[_xHandle];
    }

    /**
     * @dev Get total number of registered creators
     * @return uint256 Total creators
     */
    function getTotalCreators() external view returns (uint256) {
        return _creatorIdCounter - 1;
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
