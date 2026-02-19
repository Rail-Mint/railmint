import {
	JsonRpcProvider,
	parseEther,
	Wallet,
} from "https://esm.sh/ethers@6.13.4";
import { requireAdmin } from "../_shared/admin-auth.ts";
import { getOptionalEnv, getServiceRoleKey } from "../_shared/env.ts";
import {
	errorResponse,
	handlePreflight,
	jsonResponse,
	parseJsonBody,
} from "../_shared/http.ts";
import { createInMemoryRateLimiter } from "../_shared/rate-limit.ts";
import { isWalletAddress } from "../_shared/signature.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

type TriggerPayoutBody = {
	epoch_id?: number;
	wallet_address?: string;
};

const checkRateLimit = createInMemoryRateLimiter();

function parseEpochId(value: unknown): number | null {
	const numeric = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(numeric) || numeric < 1) return null;
	return Math.floor(numeric);
}

Deno.serve(async (request: Request) => {
	const preflight = handlePreflight(request);
	if (preflight) return preflight;

	try {
		const body = await parseJsonBody<TriggerPayoutBody>(request);
		const epochId = parseEpochId(body.epoch_id);
		const walletAddress = String(body.wallet_address ?? "").trim();

		if (!epochId) {
			return errorResponse("Valid epoch_id is required", 400);
		}
		if (!isWalletAddress(walletAddress)) {
			return errorResponse("Invalid wallet address format", 400);
		}

		const supabase = createServiceRoleClient();
		const { adminId } = await requireAdmin(
			request,
			supabase,
			getServiceRoleKey(),
		);

		if (!checkRateLimit(`trigger-payout:${adminId}`, 3, 60_000)) {
			return errorResponse("Rate limit exceeded. Try again later.", 429);
		}

		const payoutSignerKey =
			getOptionalEnv("PAYOUT_SIGNER_PRIVATE_KEY") ||
			getOptionalEnv("BNB_TESTNET_PRIVATE_KEY");
		const payoutRpcUrl =
			getOptionalEnv("PAYOUT_RPC_URL") || getOptionalEnv("BNB_TESTNET_RPC_URL");

		if (!payoutSignerKey) {
			throw new Error(
				"PAYOUT_SIGNER_PRIVATE_KEY (or BNB_TESTNET_PRIVATE_KEY) is required",
			);
		}
		if (!payoutRpcUrl) {
			throw new Error("PAYOUT_RPC_URL (or BNB_TESTNET_RPC_URL) is required");
		}

		const provider = new JsonRpcProvider(payoutRpcUrl);
		const signer = new Wallet(payoutSignerKey, provider);
		const payoutTx = await signer.sendTransaction({
			to: walletAddress,
			value: parseEther("0"),
		});
		const txHash = payoutTx.hash;

		const { error: updateError } = await supabase
			.from("epochs")
			.update({ status: "paid", payout_tx_hash: txHash })
			.eq("id", epochId)
			.eq("status", "closed");

		if (updateError) throw updateError;

		return jsonResponse({ success: true, tx_hash: txHash });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		console.error("trigger-payout error:", message);
		return errorResponse(message, 400);
	}
});
