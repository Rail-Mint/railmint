import react from "@vitejs/plugin-react-swc";
import path from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
	server: {
		host: "::",
		port: 8080,
		hmr: {
			overlay: false,
		},
	},
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
		dedupe: ["react", "react-dom"],
	},
	build: {
		chunkSizeWarningLimit: 1700,
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (!id.includes("node_modules")) return;
					const nodeModulePath = id.split("node_modules/").pop();
					if (!nodeModulePath) return;

					if (
						id.includes("react-dom") ||
						id.includes("react/jsx-runtime") ||
						id.includes("scheduler")
					) {
						return "react-core";
					}
					if (id.includes("react-router") || id.includes("@remix-run")) {
						return "router";
					}
					if (id.includes("@tanstack/react-query")) {
						return "react-query";
					}

					if (id.includes("@walletconnect/ethereum-provider")) {
						return "web3-wc-ethereum-provider";
					}
					if (id.includes("@walletconnect/sign-client")) {
						return "web3-wc-sign-client";
					}
					if (id.includes("@walletconnect/universal-provider")) {
						return "web3-wc-universal-provider";
					}
					if (id.includes("@walletconnect/core")) {
						return "web3-wc-core";
					}
					if (id.includes("@walletconnect") || id.includes("@reown")) {
						return "web3-walletconnect";
					}
					if (id.includes("@metamask")) {
						return "web3-metamask";
					}
					if (id.includes("@rainbow-me/rainbowkit")) {
						if (nodeModulePath.includes("/wallets/")) {
							return "web3-rainbowkit-wallets";
						}
						if (nodeModulePath.includes("/components/")) {
							return "web3-rainbowkit-components";
						}
						if (nodeModulePath.includes("/modal/")) {
							return "web3-rainbowkit-modal";
						}
						return "web3-rainbowkit-core";
					}
					if (id.includes("wagmi")) {
						if (nodeModulePath.includes("/connectors")) {
							return "web3-wagmi-connectors";
						}
						if (
							nodeModulePath.includes("/actions") ||
							nodeModulePath.includes("/query")
						) {
							return "web3-wagmi-actions";
						}
						return "web3-wagmi-core";
					}
					if (
						id.includes("viem") ||
						id.includes("abitype") ||
						id.includes("@noble")
					) {
						return "web3-viem";
					}

					if (id.includes("@radix-ui")) {
						return "radix";
					}
					if (id.includes("framer-motion")) {
						return "motion";
					}
					if (id.includes("recharts") || id.includes("d3-")) {
						return "charts";
					}
					if (id.includes("@supabase")) {
						return "supabase";
					}
					return "vendor";
				},
			},
		},
	},
});
