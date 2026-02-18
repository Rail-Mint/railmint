import { useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { supabase } from "@/integrations/supabase/client";
export function useSignedAction() {
	const { address } = useAccount();
	const { signMessageAsync } = useSignMessage();

	const getCachedSignature = useCallback(
		(functionName: string, wallet: string) => {
			try {
				const raw = window.localStorage.getItem(
					`rail-signed-action:${functionName}:${wallet}`,
				);
				if (!raw) return null;
				const parsed = JSON.parse(raw) as {
					signature: string;
					timestamp: number;
				};
				if (!parsed?.signature || !parsed?.timestamp) return null;
				if (Date.now() - parsed.timestamp > 270_000) return null;
				return parsed;
			} catch {
				return null;
			}
		},
		[],
	);

	const setCachedSignature = useCallback(
		(
			functionName: string,
			wallet: string,
			signature: string,
			timestamp: number,
		) => {
			try {
				window.localStorage.setItem(
					`rail-signed-action:${functionName}:${wallet}`,
					JSON.stringify({ signature, timestamp }),
				);
			} catch {
				return;
			}
		},
		[],
	);

	const invokeWithSignature = useCallback(
		async (
			functionName: string,
			body: Record<string, unknown>,
			walletAddress?: string,
		) => {
			const wallet = walletAddress || address;
			if (!wallet) throw new Error("Wallet not connected");

			const cached = getCachedSignature(functionName, wallet);
			let signature: string;
			let timestamp: number;
			if (cached) {
				signature = cached.signature;
				timestamp = cached.timestamp;
			} else {
				timestamp = Date.now();
				const message = `RailMintAI Action\nFunction: ${functionName}\nWallet: ${wallet}\nTimestamp: ${timestamp}`;
				signature = await signMessageAsync({
					message,
					account: wallet as `0x${string}`,
				});
				setCachedSignature(functionName, wallet, signature, timestamp);
			}

			const { data, error } = await supabase.functions.invoke(functionName, {
				body: {
					...body,
					wallet_address: wallet,
					signature,
					sign_timestamp: timestamp,
				},
			});

			if (error) throw error;
			if (data?.error) throw new Error(data.error);

			return data;
		},
		[address, getCachedSignature, setCachedSignature, signMessageAsync],
	);

	return { invokeWithSignature };
}
