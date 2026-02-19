declare const Deno: {
	serve: (handler: (request: Request) => Response | Promise<Response>) => void;
	env: {
		get: (key: string) => string | undefined;
	};
};

declare module "https://esm.sh/solc@0.8.28" {
	const solc: {
		compile: (input: string) => string;
	};
	export default solc;
}

declare module "https://esm.sh/viem@2.38.5" {
	export type Abi = readonly unknown[];
	export type Hex = `0x${string}`;
	export function http(url: string): unknown;
	export function formatEther(value: bigint): string;
	export function createPublicClient(config: unknown): {
		getBalance: (args: { address: `0x${string}` }) => Promise<bigint>;
		waitForTransactionReceipt: (args: {
			hash: Hex;
		}) => Promise<{ contractAddress?: `0x${string}` }>;
	};
	export function createWalletClient(config: unknown): {
		deployContract: (args: {
			abi: Abi;
			bytecode: Hex;
			args?: readonly unknown[];
		}) => Promise<Hex>;
	};
}

declare module "https://esm.sh/viem@2.38.5/accounts" {
	export function privateKeyToAccount(privateKey: `0x${string}`): {
		address: `0x${string}`;
	};
}

declare module "https://esm.sh/viem@2.38.5/chains" {
	export const bscTestnet: { id: number };
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
	export type SupabaseClient = {
		auth: {
			getUser: (
				token: string,
			) => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
		};
		from: (table: string) => unknown;
	};

	export function createClient(url: string, key: string): unknown;
}

declare module "https://esm.sh/ethers@6.13.4" {
	export function verifyMessage(message: string, signature: string): string;
}
