import {
	useReadContract,
	useWaitForTransactionReceipt,
	useWriteContract,
} from "wagmi";
import {
	CREATOR_REGISTRY_ABI,
	CREATOR_REGISTRY_ADDRESS,
	type Creator,
	isContractDeployed,
} from "../lib/contracts";

const deployed = isContractDeployed(CREATOR_REGISTRY_ADDRESS);

export function useRegisterCreator() {
	const { data: hash, writeContract, isPending, error } = useWriteContract();

	const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
		hash,
	});

	const registerCreator = (xHandle: string, profileHash: `0x${string}`) => {
		if (!deployed) {
			console.warn("[useRegisterCreator] Contract not deployed, skipping on-chain call");
			return;
		}
		writeContract({
			address: CREATOR_REGISTRY_ADDRESS!,
			abi: CREATOR_REGISTRY_ABI,
			functionName: "registerCreator",
			args: [xHandle, profileHash],
		} as any);
	};

	return {
		registerCreator,
		hash,
		isPending: deployed ? isPending : false,
		isConfirming: deployed ? isConfirming : false,
		isSuccess: deployed ? isSuccess : false,
		isDeployed: deployed,
		error,
	};
}

export function useGetCreator(creatorId: bigint | undefined) {
	const { data, isLoading, error, refetch } = useReadContract({
		address: CREATOR_REGISTRY_ADDRESS as `0x${string}`,
		abi: CREATOR_REGISTRY_ABI,
		functionName: "getCreator",
		args: creatorId !== undefined ? [creatorId] : undefined,
		query: {
			enabled: deployed && creatorId !== undefined,
		},
	});

	return {
		creator: data as Creator | undefined,
		isLoading: deployed ? isLoading : false,
		error,
		refetch,
	};
}

export function useGetCreatorByWallet(wallet: `0x${string}` | undefined) {
	const {
		data: creatorIdData,
		isLoading: isLoadingId,
		error: idError,
	} = useReadContract({
		address: CREATOR_REGISTRY_ADDRESS as `0x${string}`,
		abi: CREATOR_REGISTRY_ABI,
		functionName: "getCreatorIdByWallet",
		args: wallet ? [wallet] : undefined,
		query: {
			enabled: deployed && !!wallet,
		},
	});

	const creatorId = creatorIdData as bigint | undefined;

	const {
		data: creatorData,
		isLoading: isLoadingCreator,
		error: creatorError,
		refetch,
	} = useReadContract({
		address: CREATOR_REGISTRY_ADDRESS as `0x${string}`,
		abi: CREATOR_REGISTRY_ABI,
		functionName: "getCreator",
		args: creatorId !== undefined ? [creatorId] : undefined,
		query: {
			enabled: deployed && creatorId !== undefined && creatorId > 0n,
		},
	});

	return {
		creator: creatorData as Creator | undefined,
		creatorId,
		isLoading: deployed ? (isLoadingId || isLoadingCreator) : false,
		error: idError || creatorError,
		refetch,
	};
}

export function useGetTotalCreators() {
	const { data, isLoading, error, refetch } = useReadContract({
		address: CREATOR_REGISTRY_ADDRESS as `0x${string}`,
		abi: CREATOR_REGISTRY_ABI,
		functionName: "getTotalCreators",
		query: {
			enabled: deployed,
		},
	});

	return {
		totalCreators: data as bigint | undefined,
		isLoading: deployed ? isLoading : false,
		error,
		refetch,
	};
}
