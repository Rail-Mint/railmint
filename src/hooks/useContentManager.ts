import {
	useAccount,
	useReadContract,
	useWaitForTransactionReceipt,
	useWriteContract,
} from "wagmi";
import {
	CONTENT_MANAGER_ABI,
	CONTENT_MANAGER_ADDRESS,
	type Content,
	isContractDeployed,
} from "../lib/contracts";

const deployed = isContractDeployed(CONTENT_MANAGER_ADDRESS);

export function usePublishContent() {
	const { data: hash, writeContract, isPending, error } = useWriteContract();

	const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
		hash,
	});

	const publishContent = (
		creatorId: bigint,
		contentHash: `0x${string}`,
		ipfsUri: string,
	) => {
		if (!deployed) {
			console.warn("[usePublishContent] Contract not deployed, skipping");
			return;
		}
		writeContract({
			address: CONTENT_MANAGER_ADDRESS!,
			abi: CONTENT_MANAGER_ABI,
			functionName: "publishContent",
			args: [creatorId, contentHash, ipfsUri],
		} as any);
	};

	return {
		publishContent,
		hash,
		isPending,
		isConfirming,
		isSuccess,
		error,
	};
}

export function useLikeContent() {
	const { data: hash, writeContract, isPending, error } = useWriteContract();

	const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
		hash,
	});

	const likeContent = (contentId: bigint) => {
		if (!deployed) {
			console.warn("[useLikeContent] Contract not deployed, skipping");
			return;
		}
		writeContract({
			address: CONTENT_MANAGER_ADDRESS!,
			abi: CONTENT_MANAGER_ABI,
			functionName: "likeContent",
			args: [contentId],
		} as any);
	};

	return {
		likeContent,
		hash,
		isPending,
		isConfirming,
		isSuccess,
		error,
	};
}

export function useGetContent(contentId: bigint | undefined) {
	const { data, isLoading, error, refetch } = useReadContract({
		address: CONTENT_MANAGER_ADDRESS as `0x${string}`,
		abi: CONTENT_MANAGER_ABI,
		functionName: "getContent",
		args: contentId !== undefined ? [contentId] : undefined,
		query: {
			enabled: deployed && contentId !== undefined,
		},
	});

	return {
		content: data as Content | undefined,
		isLoading,
		error,
		refetch,
	};
}

export function useGetContentsByCreator(creatorId: bigint | undefined) {
	const { data, isLoading, error, refetch } = useReadContract({
		address: CONTENT_MANAGER_ADDRESS as `0x${string}`,
		abi: CONTENT_MANAGER_ABI,
		functionName: "getCreatorContent",
		args: creatorId !== undefined ? [creatorId] : undefined,
		query: {
			enabled: deployed && creatorId !== undefined,
		},
	});

	return {
		contents: data as readonly bigint[] | undefined,
		isLoading,
		error,
		refetch,
	};
}

export function useHasUserLiked(
	contentId: bigint | undefined,
	voter: `0x${string}` | undefined,
) {
	const { address } = useAccount();
	const voterAddress = voter || address;

	const { data, isLoading, error, refetch } = useReadContract({
		address: CONTENT_MANAGER_ADDRESS as `0x${string}`,
		abi: CONTENT_MANAGER_ABI,
		functionName: "hasLikedContent",
		args:
			contentId !== undefined && voterAddress
				? [contentId, voterAddress]
				: undefined,
		query: {
			enabled: deployed && contentId !== undefined && !!voterAddress,
		},
	});

	return {
		hasLiked: data as boolean | undefined,
		isLoading,
		error,
		refetch,
	};
}
