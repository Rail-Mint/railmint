/// <reference path="./deno.d.ts" />
import { verifyMessage } from "https://esm.sh/ethers@6.13.4";

const walletPattern = /^0x[a-fA-F0-9]{40}$/;

type SignatureBody = {
	wallet_address?: string;
	signature?: string;
	sign_timestamp?: number;
};

export function isWalletAddress(value: string): boolean {
	return walletPattern.test(value.trim());
}

export async function verifyWalletSignature(
	body: SignatureBody,
	functionName: string,
	maxAgeMs = 5 * 60 * 1000,
): Promise<string> {
	const walletAddress = body.wallet_address?.trim() ?? "";
	const signature = body.signature?.trim() ?? "";
	const signTimestamp = Number(body.sign_timestamp ?? 0);

	if (!walletAddress || !signature || !signTimestamp) {
		throw new Error("Missing wallet signature payload");
	}

	if (!isWalletAddress(walletAddress)) {
		throw new Error("Invalid wallet address format");
	}

	const now = Date.now();
	if (Math.abs(now - signTimestamp) > maxAgeMs) {
		throw new Error("Signature expired");
	}

	const message = `RailMintAI Action\nFunction: ${functionName}\nWallet: ${walletAddress}\nTimestamp: ${signTimestamp}`;
	const recoveredAddress = verifyMessage(message, signature);
	if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
		throw new Error("Invalid signature");
	}

	return walletAddress;
}
