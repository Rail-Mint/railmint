import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.argv[2] || "http://127.0.0.1:8080";
const authFilePath = process.argv[3] || "reports/auth-session.json";

const chromeSkillDir = path.join(
	process.env.HOME || "",
	".config/opencode/skills/chrome-devtools/scripts",
);

const injectScript = path.join(chromeSkillDir, "inject-auth.js");

const protectedRoutes = [
	"/studio",
	"/studio/profile",
	"/studio/content",
	"/studio/bot-tester",
	"/studio/analytics",
	"/studio/leaderboard",
	"/studio/rewards",
	"/studio/wallet",
	"/studio/security",
	"/studio/settings",
];

function run(command, args, env = process.env) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			env,
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";

		child.stdout.on("data", (chunk) => {
			const text = chunk.toString();
			stdout += text;
			process.stdout.write(text);
		});

		child.stderr.on("data", (chunk) => {
			const text = chunk.toString();
			stderr += text;
			process.stderr.write(text);
		});

		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) {
				resolve({ stdout, stderr });
				return;
			}
			reject(new Error(`${command} exited with code ${code}`));
		});
	});
}

async function main() {
	const raw = await fs.readFile(authFilePath, "utf8");
	const auth = JSON.parse(raw);

	const injectArgs = [injectScript, "--url", baseUrl, "--reload", "true"];

	if (auth.cookies) {
		injectArgs.push("--cookies", JSON.stringify(auth.cookies));
	}
	if (auth.localStorage) {
		injectArgs.push("--local-storage", JSON.stringify(auth.localStorage));
	}
	if (auth.sessionStorage) {
		injectArgs.push("--session-storage", JSON.stringify(auth.sessionStorage));
	}
	if (auth.token) {
		injectArgs.push("--token", String(auth.token));
		if (auth.header) {
			injectArgs.push("--header", String(auth.header));
		}
		if (auth.tokenKey) {
			injectArgs.push("--token-key", String(auth.tokenKey));
		}
	}

	if (injectArgs.length <= 5) {
		throw new Error(
			"Auth file must include at least one of: cookies, localStorage, sessionStorage, token",
		);
	}

	await run("node", injectArgs);

	const env = {
		...process.env,
		UI_AUDIT_PREFIX: "ui-audit-authenticated",
		UI_AUDIT_ROUTES: protectedRoutes.join(","),
	};

	const { stdout } = await run("node", ["scripts/ui-audit.mjs", baseUrl], env);
	const reportDir = stdout.trim().split("\n").filter(Boolean).at(-1) || "";

	if (!reportDir) {
		throw new Error("Failed to determine authenticated audit report directory");
	}

	const summary = {
		success: true,
		baseUrl,
		authFilePath,
		reportDir,
		routes: protectedRoutes,
	};

	await fs.writeFile(
		path.join(reportDir, "auth-audit-run.json"),
		JSON.stringify(summary, null, 2),
		"utf8",
	);
}

main().catch((error) => {
	process.stderr.write(
		`${error instanceof Error ? error.message : String(error)}\n`,
	);
	process.exit(1);
});
