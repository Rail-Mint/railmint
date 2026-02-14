import { keccak256, toBytes, toHex } from 'viem';

// Canonical hash computation matching the spec
export function computePromptHash(postId: string, cloneId: string, promptText: string): string {
  const input = `GOODVIBES_PROMPT_V1\n${postId}\n${cloneId}\n${promptText}`;
  return keccak256(toBytes(input));
}

export function computeContentHash(postId: string, contentText: string): string {
  const input = `GOODVIBES_CONTENT_V1\n${postId}\n${contentText}`;
  return keccak256(toBytes(input));
}

export function computeMetaHash(modelVersion: string, createdAtIso: string, authorWallet: string): string {
  const input = `GOODVIBES_META_V1\n${modelVersion}\n${createdAtIso}\n${authorWallet}`;
  return keccak256(toBytes(input));
}

// Mock contract interactions - returns fake tx hashes
export async function mockCommitProof(
  postId: string,
  promptHash: string,
  contentHash: string,
  metaHash: string
): Promise<string> {
  // Simulate tx delay
  await new Promise(r => setTimeout(r, 1000));
  return toHex(keccak256(toBytes(`mock-commit-${postId}-${Date.now()}`)));
}

export async function mockPayoutEpoch(
  epochId: number,
  winners: string[],
  amounts: bigint[]
): Promise<string> {
  await new Promise(r => setTimeout(r, 1500));
  return toHex(keccak256(toBytes(`mock-payout-${epochId}-${Date.now()}`)));
}

export function getExplorerUrl(txHash: string): string {
  return `https://testnet.bscscan.com/tx/${txHash}`;
}
