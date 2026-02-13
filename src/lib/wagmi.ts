import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
	braveWallet,
	injectedWallet,
	metaMaskWallet,
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

const connectors = connectorsForWallets(
	[
		{
			groupName: "Recommended",
			wallets: [braveWallet, metaMaskWallet, injectedWallet],
		},
	],
	{
		appName: "RailMintAI",
		projectId: "railmindai-demo",
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
