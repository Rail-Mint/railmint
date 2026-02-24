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
 * @title ContentManager
 * @dev Manages content publishing and voting on-chain
 */
contract ContentManager is Ownable, ReentrancyGuard, Pausable {
    // Custom errors
    error InvalidRegistryAddress();
    error ContentHashCannotBeEmpty();
    error IpfsUriCannotBeEmpty();
    error InvalidCreatorId();
    error CreatorIsNotActive();
    error NotCreatorsWallet();
    error InvalidContentId();
    error ContentIsNotActive();
    error AlreadyLikedContent();
    error HavenotLikedContent();
    error NotAuthorized();
    error ContentAlreadyDeactivated();
    error ZeroAddress();

    struct Content {
        uint256 id;
        uint256 creatorId;
        bytes32 contentHash;
        string ipfsUri;
        uint256 publishedAt;
        uint256 likeCount;
        bool isActive;
    }

    // State variables
    uint256 private _contentIdCounter;
    ICreatorRegistry public creatorRegistry;
    
    // Mappings
    mapping(uint256 => Content) public contents;
    mapping(uint256 => mapping(address => bool)) public hasLiked; // contentId => voter => hasLiked
    mapping(uint256 => uint256[]) public creatorContents; // creatorId => contentIds[]
    
    // Events
    event ContentPublished(
        uint256 indexed contentId,
        uint256 indexed creatorId,
        bytes32 contentHash,
        string ipfsUri,
        uint256 timestamp
    );
    
    event ContentLiked(
        uint256 indexed contentId,
        address indexed voter,
        uint256 timestamp
    );
    
    event ContentUnliked(
        uint256 indexed contentId,
        address indexed voter,
        uint256 timestamp
    );
    
    event ContentDeactivated(
        uint256 indexed contentId,
        uint256 timestamp
    );

    event EmergencyPause(address indexed pauser, uint256 timestamp);
    event EmergencyUnpause(address indexed unpauser, uint256 timestamp);

    constructor(address _creatorRegistry) Ownable(msg.sender) {
        if (_creatorRegistry == address(0)) revert ZeroAddress();
        creatorRegistry = ICreatorRegistry(_creatorRegistry);
        _contentIdCounter = 1; // Start IDs from 1
    }

    /**
     * @dev Publish new content
     * @param _creatorId Creator ID
     * @param _contentHash Hash of content data
     * @param _ipfsUri IPFS URI of content
     * @return uint256 The newly assigned content ID
     */
    function publishContent(
        uint256 _creatorId,
        bytes32 _contentHash,
        string memory _ipfsUri
    ) external nonReentrant whenNotPaused returns (uint256) {
        if (_contentHash == bytes32(0)) revert ContentHashCannotBeEmpty();
        if (bytes(_ipfsUri).length == 0) revert IpfsUriCannotBeEmpty();

        // Verify creator exists and is active
        ICreatorRegistry.Creator memory creator = creatorRegistry.getCreator(_creatorId);
        if (creator.id == 0) revert InvalidCreatorId();
        if (!creator.isActive) revert CreatorIsNotActive();
        if (creator.wallet != msg.sender) revert NotCreatorsWallet();

        uint256 contentId = _contentIdCounter++;
        
        contents[contentId] = Content({
            id: contentId,
            creatorId: _creatorId,
            contentHash: _contentHash,
            ipfsUri: _ipfsUri,
            publishedAt: block.timestamp,
            likeCount: 0,
            isActive: true
        });
        
        creatorContents[_creatorId].push(contentId);

        emit ContentPublished(
            contentId,
            _creatorId,
            _contentHash,
            _ipfsUri,
            block.timestamp
        );
        return contentId;
    }

    /**
     * @dev Like content (one vote per wallet)
     * @param _contentId Content ID to like
     */
    function likeContent(uint256 _contentId) external nonReentrant whenNotPaused {
        if (_contentId == 0 || _contentId >= _contentIdCounter) revert InvalidContentId();
        if (!contents[_contentId].isActive) revert ContentIsNotActive();
        if (hasLiked[_contentId][msg.sender]) revert AlreadyLikedContent();

        contents[_contentId].likeCount++;
        hasLiked[_contentId][msg.sender] = true;

        emit ContentLiked(_contentId, msg.sender, block.timestamp);
    }

    /**
     * @dev Unlike content
     * @param _contentId Content ID to unlike
     */
    function unlikeContent(uint256 _contentId) external nonReentrant whenNotPaused {
        if (_contentId == 0 || _contentId >= _contentIdCounter) revert InvalidContentId();
        if (!contents[_contentId].isActive) revert ContentIsNotActive();
        if (!hasLiked[_contentId][msg.sender]) revert HavenotLikedContent();

        contents[_contentId].likeCount--;
        hasLiked[_contentId][msg.sender] = false;

        emit ContentUnliked(_contentId, msg.sender, block.timestamp);
    }

    /**
     * @dev Deactivate content (only owner or creator)
     * @param _contentId Content ID to deactivate
     */
    function deactivateContent(uint256 _contentId) external nonReentrant whenNotPaused {
        if (_contentId == 0 || _contentId >= _contentIdCounter) revert InvalidContentId();
        if (!contents[_contentId].isActive) revert ContentAlreadyDeactivated();

        Content storage content = contents[_contentId];
        
        // Check if caller is owner or content creator
        ICreatorRegistry.Creator memory creator = creatorRegistry.getCreator(content.creatorId);
        if (msg.sender != owner() && msg.sender != creator.wallet) revert NotAuthorized();

        content.isActive = false;

        emit ContentDeactivated(_contentId, block.timestamp);
    }

    /**
     * @dev Get content by ID
     * @param _contentId Content ID
     * @return Content struct
     */
    function getContent(uint256 _contentId) external view returns (Content memory) {
        if (_contentId == 0 || _contentId >= _contentIdCounter) revert InvalidContentId();
        return contents[_contentId];
    }

    /**
     * @dev Get all content IDs by creator
     * @param _creatorId Creator ID
     * @return uint256[] Array of content IDs
     */
    function getCreatorContent(uint256 _creatorId) external view returns (uint256[] memory) {
        return creatorContents[_creatorId];
    }

    /**
     * @dev Check if wallet has liked content
     * @param _contentId Content ID
     * @param _voter Voter address
     * @return bool True if liked
     */
    function hasLikedContent(uint256 _contentId, address _voter) external view returns (bool) {
        return hasLiked[_contentId][_voter];
    }

    /**
     * @dev Get total number of published contents
     * @return uint256 Total contents
     */
    function getTotalContents() external view returns (uint256) {
        return _contentIdCounter - 1;
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
