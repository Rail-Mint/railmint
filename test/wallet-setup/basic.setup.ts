import { defineWalletSetup } from "@synthetixio/synpress";
import { getExtensionId, MetaMask } from "@synthetixio/synpress/playwright";

const walletPassword = process.env.WALLET_PASSWORD || "TestWallet123!";
const walletSeedPhrase =
	process.env.WALLET_SEED_PHRASE ||
	"test test test test test test test test test test test junk";

const networkMode = process.env.WALLET_NETWORK_MODE || "local";
const localNetwork = {
	name: process.env.WALLET_LOCAL_NETWORK_NAME || "Anvil Local",
	rpcUrl: process.env.WALLET_LOCAL_RPC_URL || "http://127.0.0.1:8545",
	chainId: Number(process.env.WALLET_LOCAL_CHAIN_ID || "31337"),
	symbol: process.env.WALLET_LOCAL_SYMBOL || "ETH",
	blockExplorerUrl: process.env.WALLET_LOCAL_EXPLORER_URL || "",
};

const targetNetworkName =
	process.env.WALLET_TARGET_NETWORK_NAME || localNetwork.name;

export default defineWalletSetup(
	walletPassword,
	async (context, walletPage) => {
		const extensionId = await getExtensionId(context, "MetaMask");
		const metamask = new MetaMask(
			context,
			walletPage,
			walletPassword,
			extensionId,
		);

		await metamask.importWallet(walletSeedPhrase);

		if (networkMode === "local") {
			try {
				await metamask.addNetwork({
					name: localNetwork.name,
					rpcUrl: localNetwork.rpcUrl,
					chainId: localNetwork.chainId,
					symbol: localNetwork.symbol,
					blockExplorerUrl: localNetwork.blockExplorerUrl,
				});
			} catch (error) {
				console.warn("[wallet-setup] addNetwork skipped:", error);
			}
		}

		try {
			await metamask.switchNetwork(targetNetworkName);
		} catch (error) {
			console.warn("[wallet-setup] switchNetwork skipped:", error);
		}
	},
);
