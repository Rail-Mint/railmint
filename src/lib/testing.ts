import { frontendEnv } from "@/lib/env";

export function isStudioWalletBypassEnabled(): boolean {
	return frontendEnv.VITE_TEST_BYPASS_WALLET_LOGIN === "true";
}
