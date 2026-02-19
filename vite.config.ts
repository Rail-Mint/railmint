import react from "@vitejs/plugin-react-swc";
import { componentTagger } from "lovable-tagger";
import path from "path";
import { defineConfig, loadEnv } from "vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
	const isLovable = mode !== "sandbox";
	const env = loadEnv(mode, process.cwd(), "");

	const define = !isLovable
		? {}
		: {
				"import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
					env.VITE_SUPABASE_URL || "",
				),
				"import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
					env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
				),
				"import.meta.env.VITE_BLOCKCHAIN_EXPLORER_BASE_URL": JSON.stringify(
					env.VITE_BLOCKCHAIN_EXPLORER_BASE_URL || "https://testnet.bscscan.com",
				),
			};

	return {
		define,
		server: {
			host: "::",
			port: 8080,
			hmr: {
				overlay: false,
			},
		},
		plugins: [react(), mode === "development" && componentTagger()].filter(
			Boolean,
		),
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src"),
			},
		},
		build: {
			target: "esnext",
		},
		optimizeDeps: {
			include: ["react", "react-dom", "react-router-dom", "events"],
		},
	};
});
