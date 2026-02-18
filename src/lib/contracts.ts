// JSON ABI format required by wagmi v2 / viem

const CreatorRegistryABI = [
	{ type: "function", name: "registerCreator", stateMutability: "nonpayable", inputs: [{ name: "xHandle", type: "string" }, { name: "profileHash", type: "bytes32" }], outputs: [{ name: "", type: "uint256" }] },
	{ type: "function", name: "updateProfile", stateMutability: "nonpayable", inputs: [{ name: "profileHash", type: "bytes32" }], outputs: [] },
	{ type: "function", name: "deactivateCreator", stateMutability: "nonpayable", inputs: [{ name: "creatorId", type: "uint256" }], outputs: [] },
	{ type: "function", name: "getCreator", stateMutability: "view", inputs: [{ name: "creatorId", type: "uint256" }], outputs: [{ name: "", type: "tuple", components: [{ name: "id", type: "uint256" }, { name: "wallet", type: "address" }, { name: "xHandle", type: "string" }, { name: "profileHash", type: "bytes32" }, { name: "registeredAt", type: "uint256" }, { name: "isActive", type: "bool" }] }] },
	{ type: "function", name: "getCreatorIdByWallet", stateMutability: "view", inputs: [{ name: "wallet", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
	{ type: "function", name: "isXHandleAvailable", stateMutability: "view", inputs: [{ name: "xHandle", type: "string" }], outputs: [{ name: "", type: "bool" }] },
	{ type: "function", name: "getTotalCreators", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
	{ type: "event", name: "CreatorRegistered", inputs: [{ name: "creatorId", type: "uint256", indexed: true }, { name: "wallet", type: "address", indexed: true }, { name: "xHandle", type: "string", indexed: false }, { name: "profileHash", type: "bytes32", indexed: false }, { name: "timestamp", type: "uint256", indexed: false }] },
	{ type: "event", name: "CreatorUpdated", inputs: [{ name: "creatorId", type: "uint256", indexed: true }, { name: "newProfileHash", type: "bytes32", indexed: false }, { name: "timestamp", type: "uint256", indexed: false }] },
	{ type: "event", name: "CreatorDeactivated", inputs: [{ name: "creatorId", type: "uint256", indexed: true }, { name: "timestamp", type: "uint256", indexed: false }] },
] as const;

const ContentManagerABI = [
	{ type: "function", name: "publishContent", stateMutability: "nonpayable", inputs: [{ name: "creatorId", type: "uint256" }, { name: "contentHash", type: "bytes32" }, { name: "ipfsUri", type: "string" }], outputs: [{ name: "", type: "uint256" }] },
	{ type: "function", name: "likeContent", stateMutability: "nonpayable", inputs: [{ name: "contentId", type: "uint256" }], outputs: [] },
	{ type: "function", name: "unlikeContent", stateMutability: "nonpayable", inputs: [{ name: "contentId", type: "uint256" }], outputs: [] },
	{ type: "function", name: "deactivateContent", stateMutability: "nonpayable", inputs: [{ name: "contentId", type: "uint256" }], outputs: [] },
	{ type: "function", name: "getContent", stateMutability: "view", inputs: [{ name: "contentId", type: "uint256" }], outputs: [{ name: "", type: "tuple", components: [{ name: "id", type: "uint256" }, { name: "creatorId", type: "uint256" }, { name: "contentHash", type: "bytes32" }, { name: "ipfsUri", type: "string" }, { name: "publishedAt", type: "uint256" }, { name: "likeCount", type: "uint256" }, { name: "isActive", type: "bool" }] }] },
	{ type: "function", name: "getCreatorContent", stateMutability: "view", inputs: [{ name: "creatorId", type: "uint256" }], outputs: [{ name: "", type: "uint256[]" }] },
	{ type: "function", name: "hasLikedContent", stateMutability: "view", inputs: [{ name: "contentId", type: "uint256" }, { name: "voter", type: "address" }], outputs: [{ name: "", type: "bool" }] },
	{ type: "function", name: "getTotalContents", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
	{ type: "event", name: "ContentPublished", inputs: [{ name: "contentId", type: "uint256", indexed: true }, { name: "creatorId", type: "uint256", indexed: true }, { name: "contentHash", type: "bytes32", indexed: false }, { name: "ipfsUri", type: "string", indexed: false }, { name: "timestamp", type: "uint256", indexed: false }] },
	{ type: "event", name: "ContentLiked", inputs: [{ name: "contentId", type: "uint256", indexed: true }, { name: "voter", type: "address", indexed: true }, { name: "timestamp", type: "uint256", indexed: false }] },
	{ type: "event", name: "ContentUnliked", inputs: [{ name: "contentId", type: "uint256", indexed: true }, { name: "voter", type: "address", indexed: true }, { name: "timestamp", type: "uint256", indexed: false }] },
	{ type: "event", name: "ContentDeactivated", inputs: [{ name: "contentId", type: "uint256", indexed: true }, { name: "timestamp", type: "uint256", indexed: false }] },
] as const;

const RewardDistributorABI = [
	{ type: "function", name: "createEpoch", stateMutability: "nonpayable", inputs: [{ name: "startTime", type: "uint256" }, { name: "endTime", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
	{ type: "function", name: "distributeRewards", stateMutability: "nonpayable", inputs: [{ name: "epochId", type: "uint256" }, { name: "creatorIds", type: "uint256[]" }, { name: "amounts", type: "uint256[]" }], outputs: [] },
	{ type: "function", name: "claimReward", stateMutability: "nonpayable", inputs: [{ name: "epochId", type: "uint256" }], outputs: [] },
	{ type: "function", name: "withdrawExcess", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
	{ type: "function", name: "getEpoch", stateMutability: "view", inputs: [{ name: "epochId", type: "uint256" }], outputs: [{ name: "", type: "tuple", components: [{ name: "id", type: "uint256" }, { name: "startTime", type: "uint256" }, { name: "endTime", type: "uint256" }, { name: "totalRewards", type: "uint256" }, { name: "distributed", type: "bool" }, { name: "distributedAt", type: "uint256" }] }] },
	{ type: "function", name: "getReward", stateMutability: "view", inputs: [{ name: "epochId", type: "uint256" }, { name: "creatorId", type: "uint256" }], outputs: [{ name: "", type: "tuple", components: [{ name: "epochId", type: "uint256" }, { name: "creatorId", type: "uint256" }, { name: "amount", type: "uint256" }, { name: "claimed", type: "bool" }, { name: "claimedAt", type: "uint256" }] }] },
	{ type: "function", name: "getEpochCreators", stateMutability: "view", inputs: [{ name: "epochId", type: "uint256" }], outputs: [{ name: "", type: "uint256[]" }] },
	{ type: "function", name: "getPendingWithdrawal", stateMutability: "view", inputs: [{ name: "wallet", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
	{ type: "function", name: "getContractBalance", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
	{ type: "event", name: "EpochCreated", inputs: [{ name: "epochId", type: "uint256", indexed: true }, { name: "startTime", type: "uint256", indexed: false }, { name: "endTime", type: "uint256", indexed: false }, { name: "timestamp", type: "uint256", indexed: false }] },
	{ type: "event", name: "RewardsDistributed", inputs: [{ name: "epochId", type: "uint256", indexed: true }, { name: "creatorIds", type: "uint256[]", indexed: false }, { name: "amounts", type: "uint256[]", indexed: false }, { name: "timestamp", type: "uint256", indexed: false }] },
	{ type: "event", name: "RewardClaimed", inputs: [{ name: "epochId", type: "uint256", indexed: true }, { name: "creatorId", type: "uint256", indexed: true }, { name: "wallet", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }, { name: "timestamp", type: "uint256", indexed: false }] },
	{ type: "event", name: "FundsDeposited", inputs: [{ name: "sender", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }, { name: "timestamp", type: "uint256", indexed: false }] },
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
