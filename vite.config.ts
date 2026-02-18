import react from "@vitejs/plugin-react-swc";
import { componentTagger } from "lovable-tagger";
import path from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
	const isLovable = mode !== 'sandbox';
	
	const define = !isLovable ? {} : {
		// Hardcode public Supabase credentials for Lovable
		// Sandbox mode will use environment variables from .env.local
		'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://adwgzibjizhwqpbjpgyc.supabase.co'),
		'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
			'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkd2d6aWJqaXpod3FwYmpwZ3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MzAyMjUsImV4cCI6MjA4NjQwNjIyNX0.91Iqt-_v6oPcYwgMgCB0lSQ9ggNsBKt5H4m3j5lRixE'
		),
	};

	return ({
	define,
	server: {
		host: "::",
		port: 8080,
		hmr: {
			overlay: false,
		},
	},
	plugins: [
		react(),
		mode === 'development' && componentTagger(),
	].filter(Boolean),
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
	});
});
