#!/usr/bin/env node

/**
 * Verification test for retrieval utilities (Task 4)
 *
 * Validates code structure and API contracts without requiring database data.
 */

import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function validateMigration() {
	console.log("\n=== Validate SQL Migration ===");

	const migrationPath = join(
		__dirname,
		"../supabase/migrations/20260218120600_match_creator_embeddings.sql",
	);

	try {
		const content = await readFile(migrationPath, "utf-8");

		const checks = [
			{ name: "Function name", pattern: /match_creator_embeddings/i },
			{
				name: "Query embedding parameter",
				pattern: /query_embedding\s+vector\(1536\)/i,
			},
			{ name: "Similarity calculation", pattern: /1\s*-\s*\(.+?<=>.+?\)/i },
			{
				name: "History cutoff filter",
				pattern: /created_at\s*>=\s*cutoff_date/i,
			},
			{ name: "Threshold filter", pattern: />\s*match_threshold/i },
			{ name: "Order by similarity", pattern: /ORDER BY.+?<=>/i },
			{ name: "Result limit", pattern: /LIMIT\s+match_count/i },
		];

		let allPassed = true;
		for (const check of checks) {
			if (check.pattern.test(content)) {
				console.log(`✓ ${check.name}`);
			} else {
				console.log(`✗ ${check.name}`);
				allPassed = false;
			}
		}

		return allPassed;
	} catch (err) {
		console.error("✗ Migration file not found or unreadable");
		return false;
	}
}

async function validateRetrievalModule() {
	console.log("\n=== Validate Retrieval Module ===");

	const modulePath = join(
		__dirname,
		"../supabase/functions/_shared/retrieval.ts",
	);

	try {
		const content = await readFile(modulePath, "utf-8");

		const checks = [
			{
				name: "Vector retrieval function",
				pattern: /export\s+async\s+function\s+retrieveVectorContext/i,
			},
			{
				name: "Fallback retrieval function",
				pattern: /export\s+async\s+function\s+retrieveFallbackContext/i,
			},
			{
				name: "Main retrieval function",
				pattern: /export\s+async\s+function\s+retrieveContext/i,
			},
			{
				name: "History cap constant (20 posts)",
				pattern: /HISTORY_CAP_POSTS\s*=\s*20/i,
			},
			{
				name: "History cap constant (90 days)",
				pattern: /HISTORY_CAP_DAYS\s*=\s*90/i,
			},
			{
				name: "Calls match_creator_embeddings RPC",
				pattern: /supabase\.rpc\s*\(\s*['"']match_creator_embeddings['"']/i,
			},
			{
				name: "Fallback to recency on empty",
				pattern: /retrieveFallbackContext.+vector.+empty/is,
			},
			{
				name: "Cutoff date calculation",
				pattern: /setDate.+getDate.+HISTORY_CAP_DAYS/is,
			},
			{
				name: "Result type definition",
				pattern: /export\s+type\s+RetrievalResult/i,
			},
			{
				name: "Method field in result",
				pattern: /method:\s*['"](vector|fallback)['"]/i,
			},
		];

		let allPassed = true;
		for (const check of checks) {
			if (check.pattern.test(content)) {
				console.log(`✓ ${check.name}`);
			} else {
				console.log(`✗ ${check.name}`);
				allPassed = false;
			}
		}

		return allPassed;
	} catch (err) {
		console.error("✗ Retrieval module not found or unreadable");
		return false;
	}
}

async function validateStructure() {
	console.log("\n=== Validate Project Structure ===");

	const paths = [
		"supabase/functions/_shared/retrieval.ts",
		"supabase/migrations/20260218120600_match_creator_embeddings.sql",
		"supabase/migrations/20260218120000_enable_pgvector.sql",
		"supabase/migrations/20260218120500_creator_embeddings.sql",
	];

	let allExist = true;
	for (const path of paths) {
		try {
			const fullPath = join(__dirname, "..", path);
			await readFile(fullPath, "utf-8");
			console.log(`✓ ${path}`);
		} catch {
			console.log(`✗ ${path} (missing)`);
			allExist = false;
		}
	}

	return allExist;
}

async function main() {
	console.log("🧪 Verification Test for Retrieval Utilities (Task 4)\n");

	const results = {
		structure: await validateStructure(),
		migration: await validateMigration(),
		module: await validateRetrievalModule(),
	};

	console.log("\n=== SUMMARY ===");
	console.log(`Project Structure:  ${results.structure ? "✓ PASS" : "✗ FAIL"}`);
	console.log(`SQL Migration:      ${results.migration ? "✓ PASS" : "✗ FAIL"}`);
	console.log(`Retrieval Module:   ${results.module ? "✓ PASS" : "✗ FAIL"}`);

	const allPassed = results.structure && results.migration && results.module;

	if (allPassed) {
		console.log("\n✅ All validations passed!");
		console.log("\nImplemented features:");
		console.log("  • Vector similarity queries via pgvector");
		console.log("  • Recency + tag fallback when embeddings unavailable");
		console.log("  • History cap enforcement (20 posts OR 90 days)");
		console.log("  • Automatic fallback on empty vector results");
		process.exit(0);
	} else {
		console.log("\n❌ Some validations failed");
		process.exit(1);
	}
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
