import solc from "https://esm.sh/solc@0.8.28";
import { requireAdmin } from "../_shared/admin-auth.ts";
import { getServiceRoleKey } from "../_shared/env.ts";
import {
	errorResponse,
	handlePreflight,
	jsonResponse,
	parseJsonBody,
} from "../_shared/http.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

type CompileRequest = {
	contractName?: string;
	source?: string;
};

type SolcError = {
	severity?: string;
	formattedMessage?: string;
	message?: string;
};

type SolcArtifact = {
	abi?: unknown[];
	evm?: {
		bytecode?: {
			object?: string;
		};
	};
};

type SolcOutput = {
	contracts?: Record<string, Record<string, SolcArtifact>>;
	errors?: SolcError[];
};

function parseSolcOutput(raw: string): SolcOutput {
	try {
		return JSON.parse(raw) as SolcOutput;
	} catch {
		throw new Error("Compiler returned invalid output");
	}
}

function authStatus(message: string): number {
	if (message === "Unauthorized" || message === "Forbidden") return 403;
	return 400;
}

Deno.serve(async (request: Request) => {
	const preflight = handlePreflight(request);
	if (preflight) return preflight;

	try {
		const body = await parseJsonBody<CompileRequest>(request);
		const contractName = String(body.contractName ?? "").trim();
		const source = String(body.source ?? "").trim();

		if (!contractName || !source) {
			return errorResponse("contractName and source are required", 400);
		}

		const supabase = createServiceRoleClient();
		await requireAdmin(request, supabase, getServiceRoleKey());

		const input = {
			language: "Solidity",
			sources: {
				"Contract.sol": { content: source },
			},
			settings: {
				outputSelection: {
					"*": {
						"*": ["abi", "evm.bytecode"],
					},
				},
			},
		};

		const output = parseSolcOutput(solc.compile(JSON.stringify(input)));
		const compilerErrors = (output.errors ?? []).filter(
			(entry) => entry.severity === "error",
		);
		if (compilerErrors.length > 0) {
			const details = compilerErrors
				.map(
					(entry) =>
						entry.formattedMessage || entry.message || "Compilation failed",
				)
				.join("\n");
			return errorResponse(details, 400);
		}

		const artifact = output.contracts?.["Contract.sol"]?.[contractName];
		const abi = artifact?.abi;
		const bytecode = artifact?.evm?.bytecode?.object;

		if (!artifact || !Array.isArray(abi) || typeof bytecode !== "string") {
			return errorResponse("Compiled artifact not found", 400);
		}

		return jsonResponse({
			contractName,
			abi,
			bytecode: bytecode.startsWith("0x") ? bytecode : `0x${bytecode}`,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		console.error("[compile-contract]", message);
		return errorResponse(message, authStatus(message));
	}
});
