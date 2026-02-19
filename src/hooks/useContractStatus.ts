import {
	CONTENT_MANAGER_ADDRESS,
	CREATOR_REGISTRY_ADDRESS,
	getContractMode,
	isContractDeployed,
	REWARD_DISTRIBUTOR_ADDRESS,
} from "@/lib/contracts";

export function useContractStatus() {
	const registryDeployed = isContractDeployed(CREATOR_REGISTRY_ADDRESS);
	const contentDeployed = isContractDeployed(CONTENT_MANAGER_ADDRESS);
	const rewardDeployed = isContractDeployed(REWARD_DISTRIBUTOR_ADDRESS);

	const allDeployed = registryDeployed && contentDeployed && rewardDeployed;
	const mode = getContractMode();

	return {
		isDeployed: allDeployed,
		mode,
		registryDeployed,
		contentDeployed,
		rewardDeployed,
		networkLabel: allDeployed ? "BSC Testnet" : "Contracts Unavailable",
	};
}
