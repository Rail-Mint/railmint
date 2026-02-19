import {
	type Abi,
	createPublicClient,
	createWalletClient,
	formatEther,
	type Hex,
	http,
} from "https://esm.sh/viem@2.38.5";
import { privateKeyToAccount } from "https://esm.sh/viem@2.38.5/accounts";
import { bscTestnet } from "https://esm.sh/viem@2.38.5/chains";
import { requireAdmin } from "../_shared/admin-auth.ts";
import {
	getOptionalEnv,
	getServiceRoleKey,
	getSupabaseUrl,
} from "../_shared/env.ts";
import {
	errorResponse,
	handlePreflight,
	jsonResponse,
	parseJsonBody,
} from "../_shared/http.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

type DeployRequest = {
	step?: "balance" | "deploy" | string;
	abi?: unknown;
	bytecode?: string;
	args?: unknown[];
	name?: string;
};

function authStatus(message: string): number {
	if (message === "Unauthorized" || message === "Forbidden") return 403;
	return 400;
}

function normalizeBytecode(bytecode: string): Hex {
	const trimmed = bytecode.trim();
	if (!trimmed) {
		throw new Error("bytecode is required");
	}
	const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
	return prefixed as Hex;
}

function parseAbi(value: unknown): Abi {
	if (!Array.isArray(value)) {
		throw new Error("abi must be an array");
	}
	return value as Abi;
}

Deno.serve(async (request: Request) => {
	const preflight = handlePreflight(request);
	if (preflight) return preflight;

	try {
		const body = await parseJsonBody<DeployRequest>(request);
		const step = String(body.step ?? "balance").toLowerCase();

		const supabase = createServiceRoleClient();
		await requireAdmin(request, supabase, getServiceRoleKey());

		const privateKeyValue = getOptionalEnv("BNB_TESTNET_PRIVATE_KEY");
		if (!privateKeyValue) {
			return errorResponse("BNB_TESTNET_PRIVATE_KEY is required", 400);
		}

		const rpcUrl =
			getOptionalEnv("BNB_TESTNET_RPC_URL") ||
			"https://data-seed-prebsc-1-s1.binance.org:8545";
		const account = privateKeyToAccount(privateKeyValue as `0x${string}`);
		const transport = http(rpcUrl);
		const publicClient = createPublicClient({
			chain: bscTestnet,
			transport,
		});
		const walletClient = createWalletClient({
			account,
			chain: bscTestnet,
			transport,
		});

		if (step === "balance") {
			const balance = await publicClient.getBalance({
				address: account.address,
			});
			return jsonResponse({
				address: account.address,
				balance: formatEther(balance),
				chainId: bscTestnet.id,
				rpcUrl,
			});
		}

		if (step !== "deploy") {
			return errorResponse("Unsupported step. Use 'balance' or 'deploy'", 400);
		}

		const abi = parseAbi(body.abi);
		const bytecode = normalizeBytecode(String(body.bytecode ?? ""));
		const args = Array.isArray(body.args) ? body.args : [];
		const contractName = String(body.name ?? "Contract").trim() || "Contract";

		const txHash = await walletClient.deployContract({
			abi,
			bytecode,
			args: args as readonly unknown[],
		});

		const receipt = await publicClient.waitForTransactionReceipt({
			hash: txHash,
		});
		if (!receipt.contractAddress) {
			throw new Error("Deployment failed: no contract address returned");
		}

		return jsonResponse({
			success: true,
			name: contractName,
			address: receipt.contractAddress,
			txHash,
			explorer: `https://testnet.bscscan.com/address/${receipt.contractAddress}`,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		console.error("[deploy-contracts]", message);
		return errorResponse(message, authStatus(message));
	}
});
