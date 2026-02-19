import { keccak256, toBytes } from "viem";
import { getExplorerTxUrl } from "@/lib/explorer";

export function computePromptHash(
	postId: string,
	cloneId: string,
	promptText: string,
): string {
	const input = `GOODVIBES_PROMPT_V1\n${postId}\n${cloneId}\n${promptText}`;
	return keccak256(toBytes(input));
}

export function computeContentHash(
	postId: string,
	contentText: string,
): string {
	const input = `GOODVIBES_CONTENT_V1\n${postId}\n${contentText}`;
	return keccak256(toBytes(input));
}

export function computeMetaHash(
	modelVersion: string,
	createdAtIso: string,
	authorWallet: string,
): string {
	const input = `GOODVIBES_META_V1\n${modelVersion}\n${createdAtIso}\n${authorWallet}`;
	return keccak256(toBytes(input));
}

export function getBscTestnetTxUrl(txHash: string): string {
	return getExplorerTxUrl(txHash);
}
