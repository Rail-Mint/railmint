import react from "@vitejs/plugin-react-swc";
import path from "path";
import { defineConfig } from "vite";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
	define: {
		// Hardcode public Supabase credentials so the client always initialises,
		// even when .env isn't picked up by the build runner.
		'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://adwgzibjizhwqpbjpgyc.supabase.co'),
		'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
			'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkd2d6aWJqaXpod3FwYmpwZ3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MzAyMjUsImV4cCI6MjA4NjQwNjIyNX0.91Iqt-_v6oPcYwgMgCB0lSQ9ggNsBKt5H4m3j5lRixE'
		),
	},
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
}));
