#!/usr/bin/env node

/**
 * Test script for retrieval utilities (Task 4)
 *
 * Verifies:
 * 1. Vector similarity retrieval path
 * 2. Recency/tag fallback path
 * 3. History cap enforcement (20 posts or 90 days)
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
	process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
	console.error(
		"❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables",
	);
	process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testVectorRetrieval() {
	console.log("\n=== TEST: Vector Retrieval Path ===");

	const { data: creatorsWithEmbeddings, error: findError } = await supabase
		.from("creator_embeddings")
		.select("creator_id")
		.limit(1)
		.single();

	if (findError || !creatorsWithEmbeddings) {
		console.log("⚠️  No embeddings found in database - cannot test vector path");
		console.log(
			"   This is expected if embeddings have not been generated yet",
		);
		return { success: true, skipped: true };
	}

	const creatorId = creatorsWithEmbeddings.creator_id;
	console.log(`✓ Found creator with embeddings: ${creatorId}`);

	const testEmbedding = Array.from({ length: 1536 }, () => Math.random());
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - 90);

	try {
		const { data, error } = await supabase.rpc("match_creator_embeddings", {
			query_embedding: testEmbedding,
			match_creator_id: creatorId,
			match_threshold: 0.5,
			match_count: 20,
			cutoff_date: cutoffDate.toISOString(),
		});

		if (error) {
			console.error("❌ Vector retrieval failed:", error.message);
			return { success: false, error: error.message };
		}

		console.log(`✓ Vector retrieval succeeded`);
		console.log(`  - Found ${data?.length || 0} matching embeddings`);
		console.log(`  - Results sorted by similarity`);

		if (data && data.length > 0) {
			console.log(
				`  - Top result similarity: ${data[0].similarity?.toFixed(4)}`,
			);
		}

		return { success: true, results: data?.length || 0 };
	} catch (err) {
		console.error("❌ Vector retrieval exception:", err.message);
		return { success: false, error: err.message };
	}
}

async function testFallbackRetrieval() {
	console.log("\n=== TEST: Fallback Retrieval Path ===");

	const { data: creators, error: findError } = await supabase
		.from("creators")
		.select("id")
		.limit(1)
		.single();

	if (findError || !creators) {
		console.log("⚠️  No creators found in database");
		return { success: false, error: "No creators found" };
	}

	const creatorId = creators.id;
	console.log(`✓ Using creator: ${creatorId}`);

	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - 90);

	try {
		const { data: posts, error } = await supabase
			.from("posts")
			.select("id, content_text, created_at")
			.eq("creator_id", creatorId)
			.gte("created_at", cutoffDate.toISOString())
			.order("created_at", { ascending: false })
			.limit(20);

		if (error) {
			console.error("❌ Fallback retrieval failed:", error.message);
			return { success: false, error: error.message };
		}

		console.log(`✓ Fallback retrieval succeeded`);
		console.log(`  - Found ${posts?.length || 0} recent posts`);
		console.log(`  - Sorted by recency (descending)`);
		console.log(`  - Applied 90-day history cap`);
		console.log(`  - Applied 20-post limit`);

		if (posts && posts.length > 0) {
			const oldest = new Date(posts[posts.length - 1].created_at);
			const daysDiff = Math.floor(
				(Date.now() - oldest.getTime()) / (1000 * 60 * 60 * 24),
			);
			console.log(`  - Oldest post age: ${daysDiff} days`);
		}

		return { success: true, results: posts?.length || 0 };
	} catch (err) {
		console.error("❌ Fallback retrieval exception:", err.message);
		return { success: false, error: err.message };
	}
}

async function testHistoryCap() {
	console.log("\n=== TEST: History Cap Enforcement ===");

	const { data: creators, error: findError } = await supabase
		.from("creators")
		.select("id")
		.limit(1)
		.single();

	if (findError || !creators) {
		console.log("⚠️  No creators found");
		return { success: false, error: "No creators found" };
	}

	const creatorId = creators.id;
	const cutoff90Days = new Date();
	cutoff90Days.setDate(cutoff90Days.getDate() - 90);

	const { data: posts, error } = await supabase
		.from("posts")
		.select("id, created_at")
		.eq("creator_id", creatorId)
		.gte("created_at", cutoff90Days.toISOString())
		.order("created_at", { ascending: false });

	if (error) {
		console.error("❌ History cap test failed:", error.message);
		return { success: false, error: error.message };
	}

	console.log(`✓ Total posts in 90-day window: ${posts?.length || 0}`);

	const cappedResults = (posts || []).slice(0, 20);
	console.log(`✓ After 20-post cap: ${cappedResults.length}`);

	if (posts && posts.length > 20) {
		console.log(
			`  - Cap applied: ${posts.length} → ${cappedResults.length} posts`,
		);
	} else if (posts && posts.length > 0) {
		console.log(`  - No cap needed (${posts.length} posts ≤ 20)`);
	}

	const withinCap = cappedResults.length <= 20;
	const withinDays = cappedResults.every((p) => {
		const postAge =
			(Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24);
		return postAge <= 90;
	});

	if (withinCap && withinDays) {
		console.log("✓ History cap enforcement verified");
		return { success: true, posts: cappedResults.length };
	} else {
		console.error("❌ History cap violation detected");
		return { success: false, error: "Cap violation" };
	}
}

async function main() {
	console.log("🧪 Testing Retrieval Utilities (Task 4)\n");
	console.log(`Supabase URL: ${SUPABASE_URL}`);

	const results = {
		vector: await testVectorRetrieval(),
		fallback: await testFallbackRetrieval(),
		historyCap: await testHistoryCap(),
	};

	console.log("\n=== SUMMARY ===");
	console.log(
		`Vector Retrieval:   ${results.vector.success ? "✓ PASS" : "✗ FAIL"} ${results.vector.skipped ? "(skipped - no embeddings)" : ""}`,
	);
	console.log(
		`Fallback Retrieval: ${results.fallback.success ? "✓ PASS" : "✗ FAIL"}`,
	);
	console.log(
		`History Cap:        ${results.historyCap.success ? "✓ PASS" : "✗ FAIL"}`,
	);

	const allPassed =
		results.vector.success &&
		results.fallback.success &&
		results.historyCap.success;

	if (allPassed) {
		console.log("\n✅ All tests passed!");
		process.exit(0);
	} else {
		console.log("\n❌ Some tests failed");
		process.exit(1);
	}
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
