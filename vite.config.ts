import react from "@vitejs/plugin-react-swc";
import { componentTagger } from "lovable-tagger";
import path from "path";
import { defineConfig, loadEnv } from "vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	const supabaseUrl =
		env.VITE_SUPABASE_URL ||
		env.SUPABASE_URL ||
		"https://adwgzibjizhwqpbjpgyc.supabase.co";
	const supabasePublishableKey =
		env.VITE_SUPABASE_PUBLISHABLE_KEY ||
		env.SUPABASE_PUBLISHABLE_KEY ||
		env.SUPABASE_ANON_KEY ||
		"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkd2d6aWJqaXpod3FwYmpwZ3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MzAyMjUsImV4cCI6MjA4NjQwNjIyNX0.91Iqt-_v6oPcYwgMgCB0lSQ9ggNsBKt5H4m3j5lRixE";

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
