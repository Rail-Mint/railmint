import { parseEther } from "viem";
import {
	useReadContract,
	useWaitForTransactionReceipt,
	useWriteContract,
} from "wagmi";
import {
	type CreatorReward,
	type Epoch,
	REWARD_DISTRIBUTOR_ABI,
	REWARD_DISTRIBUTOR_ADDRESS,
} from "../lib/contracts";

export function useDistributeRewards() {
	const { data: hash, writeContract, isPending, error } = useWriteContract();

	const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
		hash,
	});

	const distributeRewards = (
		epochId: bigint,
		creatorIds: bigint[],
		amounts: bigint[],
	) => {
		writeContract({
			address: REWARD_DISTRIBUTOR_ADDRESS,
			abi: REWARD_DISTRIBUTOR_ABI,
			functionName: "distributeRewards",
			args: [epochId, creatorIds, amounts],
		});
	};

	return {
		distributeRewards,
		hash,
		isPending,
		isConfirming,
		isSuccess,
		error,
	};
}

export function useClaimReward() {
	const { data: hash, writeContract, isPending, error } = useWriteContract();

	const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
		hash,
	});

	const claimReward = (epochId: bigint) => {
		writeContract({
			address: REWARD_DISTRIBUTOR_ADDRESS,
			abi: REWARD_DISTRIBUTOR_ABI,
			functionName: "claimReward",
			args: [epochId],
		});
	};

	return {
		claimReward,
		hash,
		isPending,
		isConfirming,
		isSuccess,
		error,
	};
}

export function useGetEpochInfo(epochId: bigint | undefined) {
	const { data, isLoading, error, refetch } = useReadContract({
		address: REWARD_DISTRIBUTOR_ADDRESS,
		abi: REWARD_DISTRIBUTOR_ABI,
		functionName: "getEpoch",
		args: epochId !== undefined ? [epochId] : undefined,
		query: {
			enabled: epochId !== undefined,
		},
	});

	return {
		epoch: data as Epoch | undefined,
		isLoading,
		error,
		refetch,
	};
}

export function useGetPendingRewards(wallet: `0x${string}` | undefined) {
	const { data, isLoading, error, refetch } = useReadContract({
		address: REWARD_DISTRIBUTOR_ADDRESS,
		abi: REWARD_DISTRIBUTOR_ABI,
		functionName: "getPendingWithdrawal",
		args: wallet ? [wallet] : undefined,
		query: {
			enabled: !!wallet,
		},
	});

	return {
		pendingRewards: data as bigint | undefined,
		isLoading,
		error,
		refetch,
	};
}

export function useGetReward(
	epochId: bigint | undefined,
	wallet: `0x${string}` | undefined,
) {
	const { data, isLoading, error, refetch } = useReadContract({
		address: REWARD_DISTRIBUTOR_ADDRESS,
		abi: REWARD_DISTRIBUTOR_ABI,
		functionName: "getReward",
		args: epochId !== undefined && wallet ? [epochId, wallet] : undefined,
		query: {
			enabled: epochId !== undefined && !!wallet,
		},
	});

	return {
		reward: data as CreatorReward | undefined,
		isLoading,
		error,
		refetch,
	};
}
