// Inline ABI stubs – the full Hardhat artifacts are only available after
// `npx hardhat compile`. These minimal ABIs keep the build working and
// provide enough surface for the hooks that reference them.

const CreatorRegistryABI = [
	"function registerCreator(string xHandle, bytes32 profileHash) external",
	"function getCreator(uint256 creatorId) external view returns (tuple(uint256 id, address wallet, string xHandle, bytes32 profileHash, uint256 registeredAt, bool isActive))",
	"function getCreatorByWallet(address wallet) external view returns (tuple(uint256 id, address wallet, string xHandle, bytes32 profileHash, uint256 registeredAt, bool isActive))",
	"function creatorCount() external view returns (uint256)",
	"event CreatorRegistered(uint256 indexed creatorId, address indexed wallet, string xHandle)",
] as const;

const ContentManagerABI = [
	"function publishContent(uint256 creatorId, bytes32 contentHash, string ipfsUri) external",
	"function likeContent(uint256 contentId) external",
	"function getContent(uint256 contentId) external view returns (tuple(uint256 id, uint256 creatorId, bytes32 contentHash, string ipfsUri, uint256 publishedAt, uint256 likeCount, bool isActive))",
	"function contentCount() external view returns (uint256)",
	"event ContentPublished(uint256 indexed contentId, uint256 indexed creatorId, bytes32 contentHash)",
	"event ContentLiked(uint256 indexed contentId, address indexed liker)",
] as const;

const RewardDistributorABI = [
	"function createEpoch(uint256 startTime, uint256 endTime) external",
	"function distributeRewards(uint256 epochId, uint256[] creatorIds, uint256[] amounts) external",
	"function claimReward(uint256 epochId) external",
	"function getEpoch(uint256 epochId) external view returns (tuple(uint256 id, uint256 startTime, uint256 endTime, uint256 totalRewards, bool distributed, uint256 distributedAt))",
	"function epochCount() external view returns (uint256)",
	"event EpochCreated(uint256 indexed epochId, uint256 startTime, uint256 endTime)",
	"event RewardsDistributed(uint256 indexed epochId, uint256 totalAmount)",
	"event RewardClaimed(uint256 indexed epochId, uint256 indexed creatorId, uint256 amount)",
] as const;

// Contract Addresses from Environment Variables
export const CREATOR_REGISTRY_ADDRESS = import.meta.env
	.VITE_CREATOR_REGISTRY_ADDRESS as `0x${string}`;
export const CONTENT_MANAGER_ADDRESS = import.meta.env
	.VITE_CONTENT_PUBLISHING_ADDRESS as `0x${string}`;
export const REWARD_DISTRIBUTOR_ADDRESS = import.meta.env
	.VITE_REWARD_DISTRIBUTOR_ADDRESS as `0x${string}`;

// Contract ABIs
export const CREATOR_REGISTRY_ABI = CreatorRegistryABI;
export const CONTENT_MANAGER_ABI = ContentManagerABI;
export const REWARD_DISTRIBUTOR_ABI = RewardDistributorABI;

// TypeScript Types matching Solidity structs

export type Creator = {
	id: bigint;
	wallet: `0x${string}`;
	xHandle: string;
	profileHash: `0x${string}`;
	registeredAt: bigint;
	isActive: boolean;
};

export type Content = {
	id: bigint;
	creatorId: bigint;
	contentHash: `0x${string}`;
	ipfsUri: string;
	publishedAt: bigint;
	likeCount: bigint;
	isActive: boolean;
};

export type Epoch = {
	id: bigint;
	startTime: bigint;
	endTime: bigint;
	totalRewards: bigint;
	distributed: boolean;
	distributedAt: bigint;
};

export type CreatorReward = {
	epochId: bigint;
	creatorId: bigint;
	amount: bigint;
	claimed: boolean;
	claimedAt: bigint;
};
