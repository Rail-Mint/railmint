import fs from "node:fs/promises";
import path from "node:path";
import { chromium, devices } from "playwright";

const baseUrl = process.argv[2] || "http://127.0.0.1:8080";
const reportPrefix = process.env.UI_AUDIT_PREFIX || "ui-audit";
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportDir = path.join("reports", `${reportPrefix}-${timestamp}`);
const screenshotDir = path.join(reportDir, "screenshots");

const defaultRoutes = [
	"/",
	"/feed",
	"/leaderboard",
	"/rewards",
	"/onboarding",
	"/studio",
	"/studio/profile",
];

const routes = process.env.UI_AUDIT_ROUTES
	? process.env.UI_AUDIT_ROUTES.split(",")
			.map((route) => route.trim())
			.filter(Boolean)
	: defaultRoutes;

const profiles = [
	{ name: "desktop", viewport: { width: 1440, height: 900 } },
	{ name: "mobile", ...devices["iPhone 12"] },
];

function slug(input) {
	return input.replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "") || "home";
}

async function ensureDirs() {
	await fs.mkdir(screenshotDir, { recursive: true });
}

async function run() {
	await ensureDirs();

	const browser = await chromium.launch({ headless: true });
	const results = [];

	for (const profile of profiles) {
		const context = await browser.newContext(profile);

		for (const route of routes) {
			const page = await context.newPage();
			const url = new URL(route, baseUrl).toString();
			const consoleErrors = [];
			const pageErrors = [];
			const failedRequests = [];

			page.on("console", (message) => {
				if (message.type() === "error" || message.type() === "warning") {
					consoleErrors.push(message.text());
				}
			});
			page.on("pageerror", (error) => pageErrors.push(error.message));
			page.on("response", (response) => {
				if (response.status() >= 400) {
					failedRequests.push({
						url: response.url(),
						status: response.status(),
					});
				}
			});

			let navigationError = null;
			try {
				await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
			} catch (error) {
				navigationError =
					error instanceof Error ? error.message : String(error);
			}

			await page.waitForTimeout(1200);

			const shotName = `${slug(route)}-${profile.name}.png`;
			const shotPath = path.join(screenshotDir, shotName);
			await page.screenshot({ path: shotPath, fullPage: true });

			const diagnostics = await page.evaluate(() => {
				const unlabeledInputs = Array.from(
					document.querySelectorAll("input, select, textarea"),
				).filter((el) => {
					const id = el.getAttribute("id");
					const ariaLabel = el.getAttribute("aria-label");
					const ariaLabelledBy = el.getAttribute("aria-labelledby");
					const hasLabel = id
						? !!document.querySelector(`label[for="${id}"]`)
						: false;
					return !(ariaLabel || ariaLabelledBy || hasLabel);
				}).length;

				const unnamedButtons = Array.from(
					document.querySelectorAll("button"),
				).filter((button) => {
					const text = (button.textContent || "").trim();
					const ariaLabel = button.getAttribute("aria-label");
					return !text && !ariaLabel;
				}).length;

				const unnamedLinks = Array.from(document.querySelectorAll("a")).filter(
					(link) => {
						const text = (link.textContent || "").trim();
						const ariaLabel = link.getAttribute("aria-label");
						return !text && !ariaLabel;
					},
				).length;

				const imagesMissingAlt =
					document.querySelectorAll("img:not([alt])").length;
				const navigationEntry = performance.getEntriesByType("navigation")[0];
				const navTiming = navigationEntry
					? {
							domContentLoaded: Math.round(
								navigationEntry.domContentLoadedEventEnd,
							),
							loadEvent: Math.round(navigationEntry.loadEventEnd),
						}
					: null;

				return {
					title: document.title,
					hasMetaDescription: !!document
						.querySelector("meta[name='description']")
						?.getAttribute("content"),
					h1Count: document.querySelectorAll("h1").length,
					unlabeledInputs,
					unnamedButtons,
					unnamedLinks,
					imagesMissingAlt,
					navTiming,
					bodyText: (document.body?.innerText || "").slice(0, 400),
				};
			});

			results.push({
				profile: profile.name,
				route,
				requestedUrl: url,
				finalUrl: page.url(),
				navigationError,
				screenshot: path.relative(reportDir, shotPath),
				consoleErrors,
				pageErrors,
				failedRequests,
				diagnostics,
			});

			await page.close();
		}

		await context.close();
	}

	await browser.close();
	const output = {
		baseUrl,
		createdAt: new Date().toISOString(),
		routes,
		profiles: profiles.map((p) => p.name),
		results,
	};

	await fs.writeFile(
		path.join(reportDir, "audit-results.json"),
		JSON.stringify(output, null, 2),
		"utf8",
	);

	process.stdout.write(`${reportDir}\n`);
}

run().catch((error) => {
	process.stderr.write(
		`${error instanceof Error ? error.stack : String(error)}\n`,
	);
	process.exit(1);
});
