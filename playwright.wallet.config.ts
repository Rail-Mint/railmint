import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL;

if (!baseURL) {
	throw new Error(
		"Missing PLAYWRIGHT_BASE_URL for wallet E2E lane. Example: PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080",
	);
}

const headless = process.env.HEADLESS === "true";

export default defineConfig({
	testDir: "./tests/wallet",
	timeout: 120_000,
	expect: {
		timeout: 15_000,
	},
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	reporter: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL,
		trace: "on-first-retry",
		headless,
		...devices["Desktop Chrome"],
	},
	webServer: {
		command: "npm run dev -- --host 127.0.0.1 --port 8080",
		url: baseURL,
		timeout: 180_000,
		reuseExistingServer: true,
	},
});
