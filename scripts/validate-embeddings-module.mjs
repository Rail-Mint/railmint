#!/usr/bin/env node

/**
 * Dry-run test for embeddings module structure validation
 *
 * This validates:
 * 1. Module exports are correct
 * 2. Type interfaces are properly defined
 * 3. Opt-in check logic is present
 */

import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function validateModuleStructure() {
	console.log("=== Validating embeddings module structure ===\n");

	const embeddingsPath = join(
		__dirname,
		"../supabase/functions/_shared/embeddings.ts",
	);

	try {
		const content = await readFile(embeddingsPath, "utf-8");

		const checks = [
			{
				name: "OpenRouter embeddings model constant",
				pattern: /OPENROUTER_EMBEDDINGS_MODEL.*openai\/text-embedding/,
				required: true,
			},
			{
				name: "Embedding dimensions constant (1536)",
				pattern: /EMBEDDING_DIMENSIONS.*1536/,
				required: true,
			},
			{
				name: "checkOptIn function exists",
				pattern: /async function checkOptIn/,
				required: true,
			},
			{
				name: "Opt-in check uses context_opt_in field",
				pattern: /context_opt_in/,
				required: true,
			},
			{
				name: "generateEmbedding function exists",
				pattern: /async function generateEmbedding/,
				required: true,
			},
			{
				name: "OpenRouter API endpoint",
				pattern: /openrouter\.ai.*embeddings/,
				required: true,
			},
			{
				name: "createEmbedding export with opt-in check",
				pattern: /export async function createEmbedding/,
				required: true,
			},
			{
				name: "Fail-closed: returns early when opt-in OFF",
				pattern: /if.*!optedIn.*return/,
				required: true,
			},
			{
				name: "createEmbeddingForPost convenience export",
				pattern: /export async function createEmbeddingForPost/,
				required: true,
			},
			{
				name: "createEmbeddingForConversation export",
				pattern: /export async function createEmbeddingForConversation/,
				required: true,
			},
			{
				name: "createEmbeddingForProfile export",
				pattern: /export async function createEmbeddingForProfile/,
				required: true,
			},
			{
				name: "Source type validation (post|conversation|profile)",
				pattern:
					/source_type.*=.*["']post["']|["']conversation["']|["']profile["']/,
				required: true,
			},
			{
				name: "Stores in creator_embeddings table",
				pattern: /creator_embeddings.*insert/,
				required: true,
			},
			{
				name: "Timeout protection (AbortController)",
				pattern: /AbortController/,
				required: true,
			},
			{
				name: "OPENROUTER_API_KEY check",
				pattern: /OPENROUTER_API_KEY.*is not configured/,
				required: true,
			},
		];

		let passed = 0;
		let failed = 0;

		for (const check of checks) {
			const found = check.pattern.test(content);
			if (found) {
				console.log(`✅ ${check.name}`);
				passed++;
			} else if (check.required) {
				console.log(`❌ ${check.name} - REQUIRED`);
				failed++;
			} else {
				console.log(`⚠️  ${check.name} - optional, not found`);
			}
		}

		console.log(`\n=== Summary ===`);
		console.log(`Passed: ${passed}/${checks.length}`);
		console.log(`Failed: ${failed}/${checks.length}`);

		return failed === 0;
	} catch (error) {
		console.error("Error reading module:", error);
		return false;
	}
}

async function validateOptInLogic() {
	console.log("\n=== Validating opt-in logic flow ===\n");

	const embeddingsPath = join(
		__dirname,
		"../supabase/functions/_shared/embeddings.ts",
	);

	try {
		const content = await readFile(embeddingsPath, "utf-8");

		const functionMatch = content.match(
			/export async function createEmbedding[\s\S]*?^}/m,
		);

		if (!functionMatch) {
			console.error("❌ Could not find createEmbedding function");
			return false;
		}

		const functionBody = functionMatch[0];

		const checks = [
			{
				name: "Opt-in check is FIRST operation",
				test: () => {
					const optInIndex = functionBody.indexOf("checkOptIn");
					const generateIndex = functionBody.indexOf("generateEmbedding");
					const insertIndex = functionBody.indexOf(".insert(");
					return (
						optInIndex > 0 &&
						optInIndex < generateIndex &&
						optInIndex < insertIndex
					);
				},
			},
			{
				name: "Early return when opt-in is OFF",
				test: () =>
					functionBody.includes("return") &&
					functionBody.includes("created: false"),
			},
			{
				name: "No embedding generation when opt-out",
				test: () => {
					const lines = functionBody.split("\n");
					const optInReturnLine = lines.findIndex(
						(l) => l.includes("!optedIn") && l.includes("return"),
					);
					const generateLine = lines.findIndex((l) =>
						l.includes("generateEmbedding"),
					);
					return optInReturnLine > 0 && optInReturnLine < generateLine;
				},
			},
			{
				name: "Logs embedding skip with context",
				test: () =>
					functionBody.includes("Embedding skipped") &&
					functionBody.includes("opt-in is OFF"),
			},
		];

		let passed = 0;
		for (const check of checks) {
			if (check.test()) {
				console.log(`✅ ${check.name}`);
				passed++;
			} else {
				console.log(`❌ ${check.name}`);
			}
		}

		console.log(`\nOpt-in logic checks: ${passed}/${checks.length} passed`);
		return passed === checks.length;
	} catch (error) {
		console.error("Error validating opt-in logic:", error);
		return false;
	}
}

async function main() {
	console.log("Embeddings Module Validation (Dry Run)\n");
	console.log("This validates the module structure without making API calls\n");

	const structureValid = await validateModuleStructure();
	const logicValid = await validateOptInLogic();

	console.log("\n=== FINAL RESULT ===");
	if (structureValid && logicValid) {
		console.log("✅ All validations passed!");
		console.log("\nModule is ready for integration testing with:");
		console.log("  - Live Supabase instance");
		console.log("  - OpenRouter API key");
		console.log("  - Test creators with opt-in ON/OFF");
		return 0;
	} else {
		console.log("❌ Some validations failed");
		if (!structureValid) console.log("  - Module structure issues detected");
		if (!logicValid) console.log("  - Opt-in logic flow issues detected");
		return 1;
	}
}

main()
	.then(process.exit)
	.catch((error) => {
		console.error("Fatal error:", error);
		process.exit(1);
	});
