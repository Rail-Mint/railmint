import react from "@vitejs/plugin-react-swc";
import { componentTagger } from "lovable-tagger";
import path from "path";
import { defineConfig, loadEnv } from "vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
	const supabasePublishableKey =
		env.VITE_SUPABASE_PUBLISHABLE_KEY ||
		env.SUPABASE_PUBLISHABLE_KEY ||
		env.SUPABASE_ANON_KEY ||
		"";

	const define = {
		"import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
		"import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
			supabasePublishableKey,
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
