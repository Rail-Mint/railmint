import {
	useReadContract,
	useWaitForTransactionReceipt,
	useWriteContract,
} from "wagmi";
import {
	CREATOR_REGISTRY_ABI,
	CREATOR_REGISTRY_ADDRESS,
	type Creator,
} from "../lib/contracts";

export function useRegisterCreator() {
	const { data: hash, writeContract, isPending, error } = useWriteContract();

	const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
		hash,
	});

	const registerCreator = (xHandle: string, profileHash: `0x${string}`) => {
		writeContract({
			address: CREATOR_REGISTRY_ADDRESS,
			abi: CREATOR_REGISTRY_ABI,
			functionName: "registerCreator",
			args: [xHandle, profileHash],
		} as any);
	};

	return {
		registerCreator,
		hash,
		isPending,
		isConfirming,
		isSuccess,
		error,
	};
}

export function useGetCreator(creatorId: bigint | undefined) {
	const { data, isLoading, error, refetch } = useReadContract({
		address: CREATOR_REGISTRY_ADDRESS,
		abi: CREATOR_REGISTRY_ABI,
		functionName: "getCreator",
		args: creatorId !== undefined ? [creatorId] : undefined,
		query: {
			enabled: creatorId !== undefined,
		},
	});

	return {
		creator: data as Creator | undefined,
		isLoading,
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
		address: CREATOR_REGISTRY_ADDRESS,
		abi: CREATOR_REGISTRY_ABI,
		functionName: "getCreatorIdByWallet",
		args: wallet ? [wallet] : undefined,
		query: {
			enabled: !!wallet,
		},
	});

	const creatorId = creatorIdData as bigint | undefined;

	const {
		data: creatorData,
		isLoading: isLoadingCreator,
		error: creatorError,
		refetch,
	} = useReadContract({
		address: CREATOR_REGISTRY_ADDRESS,
		abi: CREATOR_REGISTRY_ABI,
		functionName: "getCreator",
		args: creatorId !== undefined ? [creatorId] : undefined,
		query: {
			enabled: creatorId !== undefined && creatorId > 0n,
		},
	});

	return {
		creator: creatorData as Creator | undefined,
		creatorId,
		isLoading: isLoadingId || isLoadingCreator,
		error: idError || creatorError,
		refetch,
	};
}

export function useGetTotalCreators() {
	const { data, isLoading, error, refetch } = useReadContract({
		address: CREATOR_REGISTRY_ADDRESS,
		abi: CREATOR_REGISTRY_ABI,
		functionName: "getTotalCreators",
	});

	return {
		totalCreators: data as bigint | undefined,
		isLoading,
		error,
		refetch,
	};
}
