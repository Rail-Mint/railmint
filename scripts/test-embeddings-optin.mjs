#!/usr/bin/env node

/**
 * Test script for embeddings opt-in/opt-out behavior
 *
 * This script validates that:
 * 1. Embeddings are created when opt-in is ON
 * 2. Embeddings are NOT created when opt-in is OFF
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
	console.error("Missing required environment variables:");
	console.error("  SUPABASE_URL");
	console.error("  SUPABASE_SERVICE_ROLE_KEY");
	process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testEmbeddingOptIn() {
	console.log("\n=== TEST: Embedding created for opt-in creator ===");

	const testCreatorId = crypto.randomUUID();
	const testPostId = crypto.randomUUID();

	try {
		await supabase.from("creators").insert({
			id: testCreatorId,
			x_handle: `@test_optin_${Date.now()}`,
			wallet_address: `0x${Date.now().toString(16).padStart(40, "0")}`,
			clone_name: "Test Creator OptIn",
		});

		await supabase.from("creator_profiles").insert({
			creator_id: testCreatorId,
			context_opt_in: true,
		});

		await supabase.from("posts").insert({
			id: testPostId,
			creator_id: testCreatorId,
			epoch_id: 1,
			prompt_text: "test prompt",
			content_text: "This is test content for embedding generation",
			prompt_hash: "0x1234",
			content_hash: "0x5678",
			meta_hash: "0x9abc",
			commit_tx_hash: "0xdef0",
		});

		const { createEmbeddingForPost } = await import(
			"../supabase/functions/_shared/embeddings.ts"
		);

		const result = await createEmbeddingForPost(
			supabase,
			testCreatorId,
			testPostId,
			"This is test content for embedding generation",
		);

		console.log("Result:", result);

		const { data: embeddings, error: queryError } = await supabase
			.from("creator_embeddings")
			.select("*")
			.eq("source_id", testPostId);

		if (queryError) throw queryError;

		console.log(`Found ${embeddings?.length || 0} embedding(s)`);

		if (embeddings && embeddings.length === 1) {
			console.log("✅ PASS: Embedding created for opt-in creator");
			return true;
		} else {
			console.error("❌ FAIL: Expected 1 embedding, found", embeddings?.length);
			return false;
		}
	} catch (error) {
		console.error("❌ FAIL: Error during opt-in test:", error);
		return false;
	} finally {
		await supabase
			.from("creator_embeddings")
			.delete()
			.eq("source_id", testPostId);
		await supabase.from("posts").delete().eq("id", testPostId);
		await supabase
			.from("creator_profiles")
			.delete()
			.eq("creator_id", testCreatorId);
		await supabase.from("creators").delete().eq("id", testCreatorId);
	}
}

async function testEmbeddingOptOut() {
	console.log("\n=== TEST: Embedding skipped for opt-out creator ===");

	const testCreatorId = crypto.randomUUID();
	const testPostId = crypto.randomUUID();

	try {
		await supabase.from("creators").insert({
			id: testCreatorId,
			x_handle: `@test_optout_${Date.now()}`,
			wallet_address: `0x${Date.now().toString(16).padStart(40, "0")}`,
			clone_name: "Test Creator OptOut",
		});

		await supabase.from("creator_profiles").insert({
			creator_id: testCreatorId,
			context_opt_in: false,
		});

		await supabase.from("posts").insert({
			id: testPostId,
			creator_id: testCreatorId,
			epoch_id: 1,
			prompt_text: "test prompt",
			content_text: "This is test content that should NOT generate embedding",
			prompt_hash: "0x1234",
			content_hash: "0x5678",
			meta_hash: "0x9abc",
			commit_tx_hash: "0xdef0",
		});

		const { createEmbeddingForPost } = await import(
			"../supabase/functions/_shared/embeddings.ts"
		);

		const result = await createEmbeddingForPost(
			supabase,
			testCreatorId,
			testPostId,
			"This is test content that should NOT generate embedding",
		);

		console.log("Result:", result);

		const { data: embeddings, error: queryError } = await supabase
			.from("creator_embeddings")
			.select("*")
			.eq("source_id", testPostId);

		if (queryError) throw queryError;

		console.log(`Found ${embeddings?.length || 0} embedding(s)`);

		if (!embeddings || embeddings.length === 0) {
			console.log("✅ PASS: Embedding skipped for opt-out creator");
			return true;
		} else {
			console.error(
				"❌ FAIL: Expected 0 embeddings, found",
				embeddings?.length,
			);
			return false;
		}
	} catch (error) {
		console.error("❌ FAIL: Error during opt-out test:", error);
		return false;
	} finally {
		await supabase
			.from("creator_embeddings")
			.delete()
			.eq("source_id", testPostId);
		await supabase.from("posts").delete().eq("id", testPostId);
		await supabase
			.from("creator_profiles")
			.delete()
			.eq("creator_id", testCreatorId);
		await supabase.from("creators").delete().eq("id", testCreatorId);
	}
}

async function main() {
	console.log("Starting embeddings opt-in/opt-out tests...");

	const optInPass = await testEmbeddingOptIn();
	const optOutPass = await testEmbeddingOptOut();

	console.log("\n=== TEST SUMMARY ===");
	console.log(`Opt-in test: ${optInPass ? "✅ PASS" : "❌ FAIL"}`);
	console.log(`Opt-out test: ${optOutPass ? "✅ PASS" : "❌ FAIL"}`);

	if (optInPass && optOutPass) {
		console.log("\n✅ All tests passed!");
		process.exit(0);
	} else {
		console.log("\n❌ Some tests failed");
		process.exit(1);
	}
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
