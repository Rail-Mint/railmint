// Complete ABI stubs matching actual Solidity contracts.
// These are human-readable ABIs used by wagmi/viem.

const CreatorRegistryABI = [
	// Write functions
	"function registerCreator(string xHandle, bytes32 profileHash) external returns (uint256)",
	"function updateProfile(bytes32 profileHash) external",
	"function deactivateCreator(uint256 creatorId) external",
	// Read functions
	"function getCreator(uint256 creatorId) external view returns (tuple(uint256 id, address wallet, string xHandle, bytes32 profileHash, uint256 registeredAt, bool isActive))",
	"function getCreatorIdByWallet(address wallet) external view returns (uint256)",
	"function isXHandleAvailable(string xHandle) external view returns (bool)",
	"function getTotalCreators() external view returns (uint256)",
	// Events
	"event CreatorRegistered(uint256 indexed creatorId, address indexed wallet, string xHandle, bytes32 profileHash, uint256 timestamp)",
	"event CreatorUpdated(uint256 indexed creatorId, bytes32 newProfileHash, uint256 timestamp)",
	"event CreatorDeactivated(uint256 indexed creatorId, uint256 timestamp)",
] as const;

const ContentManagerABI = [
	// Write functions
	"function publishContent(uint256 creatorId, bytes32 contentHash, string ipfsUri) external returns (uint256)",
	"function likeContent(uint256 contentId) external",
	"function unlikeContent(uint256 contentId) external",
	"function deactivateContent(uint256 contentId) external",
	// Read functions
	"function getContent(uint256 contentId) external view returns (tuple(uint256 id, uint256 creatorId, bytes32 contentHash, string ipfsUri, uint256 publishedAt, uint256 likeCount, bool isActive))",
	"function getCreatorContent(uint256 creatorId) external view returns (uint256[])",
	"function hasLikedContent(uint256 contentId, address voter) external view returns (bool)",
	"function getTotalContents() external view returns (uint256)",
	// Events
	"event ContentPublished(uint256 indexed contentId, uint256 indexed creatorId, bytes32 contentHash, string ipfsUri, uint256 timestamp)",
	"event ContentLiked(uint256 indexed contentId, address indexed voter, uint256 timestamp)",
	"event ContentUnliked(uint256 indexed contentId, address indexed voter, uint256 timestamp)",
	"event ContentDeactivated(uint256 indexed contentId, uint256 timestamp)",
] as const;

const RewardDistributorABI = [
	// Write functions
	"function createEpoch(uint256 startTime, uint256 endTime) external returns (uint256)",
	"function distributeRewards(uint256 epochId, uint256[] creatorIds, uint256[] amounts) external",
	"function claimReward(uint256 epochId) external",
	"function withdrawExcess(uint256 amount) external",
	// Read functions
	"function getEpoch(uint256 epochId) external view returns (tuple(uint256 id, uint256 startTime, uint256 endTime, uint256 totalRewards, bool distributed, uint256 distributedAt))",
	"function getReward(uint256 epochId, uint256 creatorId) external view returns (tuple(uint256 epochId, uint256 creatorId, uint256 amount, bool claimed, uint256 claimedAt))",
	"function getEpochCreators(uint256 epochId) external view returns (uint256[])",
	"function getPendingWithdrawal(address wallet) external view returns (uint256)",
	"function getContractBalance() external view returns (uint256)",
	// Events
	"event EpochCreated(uint256 indexed epochId, uint256 startTime, uint256 endTime, uint256 timestamp)",
	"event RewardsDistributed(uint256 indexed epochId, uint256[] creatorIds, uint256[] amounts, uint256 timestamp)",
	"event RewardClaimed(uint256 indexed epochId, uint256 indexed creatorId, address indexed wallet, uint256 amount, uint256 timestamp)",
	"event FundsDeposited(address indexed sender, uint256 amount, uint256 timestamp)",
] as const;

// Contract Addresses from Environment Variables
export const CREATOR_REGISTRY_ADDRESS = (import.meta.env
	.VITE_CREATOR_REGISTRY_ADDRESS || "0x5d506f9a720a4639881b269f4899868bed800504") as `0x${string}` | undefined;
export const CONTENT_MANAGER_ADDRESS = (import.meta.env
	.VITE_CONTENT_PUBLISHING_ADDRESS || "0x9c458963d17142d0c28341b30b1055a1e73f562f") as `0x${string}` | undefined;
export const REWARD_DISTRIBUTOR_ADDRESS = (import.meta.env
	.VITE_REWARD_DISTRIBUTOR_ADDRESS || "0xef7f43074521b0e941c1be89df390a93cafb588f") as `0x${string}` | undefined;

// Contract ABIs
export const CREATOR_REGISTRY_ABI = CreatorRegistryABI;
export const CONTENT_MANAGER_ABI = ContentManagerABI;
export const REWARD_DISTRIBUTOR_ABI = RewardDistributorABI;

// Helper to check if contracts are deployed
export function isContractDeployed(address: `0x${string}` | undefined): address is `0x${string}` {
	return !!address && address.startsWith("0x") && address.length === 42;
}

export function getContractMode(): "live" | "mock" {
	if (
		isContractDeployed(CREATOR_REGISTRY_ADDRESS) &&
		isContractDeployed(CONTENT_MANAGER_ADDRESS) &&
		isContractDeployed(REWARD_DISTRIBUTOR_ADDRESS)
	) {
		return "live";
	}
	return "mock";
}

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
