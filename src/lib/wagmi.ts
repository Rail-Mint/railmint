import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
	braveWallet,
	coinbaseWallet,
	metaMaskWallet,
	rainbowWallet,
	trustWallet,
	walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { defineChain } from "viem";
import { createConfig, http } from "wagmi";
import { bscTestnet } from "wagmi/chains";

export const opBNBTestnet = defineChain({
	id: 5611,
	name: "opBNB Testnet",
	nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
	rpcUrls: {
		default: { http: ["https://opbnb-testnet-rpc.bnbchain.org"] },
	},
	blockExplorers: {
		default: { name: "opBNBScan", url: "https://testnet.opbnbscan.com" },
	},
	testnet: true,
});

// WalletConnect requires a valid projectId from cloud.walletconnect.com.
// When no valid ID is set, we exclude WalletConnect to avoid console errors.
const wcProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;
const hasValidWcId = wcProjectId && wcProjectId.length > 10 && wcProjectId !== "railmindai-demo";

const connectors = connectorsForWallets(
	[
		{
			groupName: "Recommended",
			wallets: [metaMaskWallet, trustWallet, coinbaseWallet],
		},
		{
			groupName: "More wallets",
			wallets: hasValidWcId
				? [walletConnectWallet, rainbowWallet, braveWallet]
				: [rainbowWallet, braveWallet],
		},
	],
	{
		appName: "RailMintAI",
		projectId: wcProjectId || "placeholder",
	},
);

export const config = createConfig({
	chains: [opBNBTestnet, bscTestnet],
	connectors,
	transports: {
		[opBNBTestnet.id]: http(),
		[bscTestnet.id]: http(),
	},
});
