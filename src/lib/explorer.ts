import { frontendEnv } from "@/lib/env";

const explorerBaseUrlRaw = frontendEnv.VITE_BLOCKCHAIN_EXPLORER_BASE_URL;

function normalizeBaseUrl(baseUrl: string): string {
	return baseUrl.replace(/\/+$/, "");
}

export function getExplorerTxUrl(txHash: string): string {
	const baseUrl = normalizeBaseUrl(explorerBaseUrlRaw);
	return `${baseUrl}/tx/${txHash}`;
}

export function getExplorerAddressUrl(address: string): string {
	const baseUrl = normalizeBaseUrl(explorerBaseUrlRaw);
	return `${baseUrl}/address/${address}`;
}
