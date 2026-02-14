import ContentManagerArtifact from "../../artifacts/contracts/ContentManager.sol/ContentManager.json";
import CreatorRegistryArtifact from "../../artifacts/contracts/CreatorRegistry.sol/CreatorRegistry.json";
import RewardDistributorArtifact from "../../artifacts/contracts/RewardDistributor.sol/RewardDistributor.json";

// Contract Addresses from Environment Variables
export const CREATOR_REGISTRY_ADDRESS = import.meta.env
	.VITE_CREATOR_REGISTRY_ADDRESS as `0x${string}`;
export const CONTENT_MANAGER_ADDRESS = import.meta.env
	.VITE_CONTENT_PUBLISHING_ADDRESS as `0x${string}`;
export const REWARD_DISTRIBUTOR_ADDRESS = import.meta.env
	.VITE_REWARD_DISTRIBUTOR_ADDRESS as `0x${string}`;

// Contract ABIs
export const CREATOR_REGISTRY_ABI = CreatorRegistryArtifact.abi;
export const CONTENT_MANAGER_ABI = ContentManagerArtifact.abi;
export const REWARD_DISTRIBUTOR_ABI = RewardDistributorArtifact.abi;

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
