#!/usr/bin/env -S deno run --allow-net --allow-env

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
	getNewsDigest,
	getProfile,
	getRecentPosts,
	getSummary,
	updateProfile,
} from "../supabase/functions/_shared/context-dal.ts";

const SUPABASE_URL = "http://127.0.0.1:54321";
const SUPABASE_SERVICE_KEY =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function setupTestData() {
	console.log("Setting up test data...");

	// Create a test creator with opt-in OFF
	const { data: creator1, error: err1 } = await supabase
		.from("creators")
		.insert({
			wallet_address: "0xTEST_OPT_OUT",
			x_handle: "@test_opt_out",
		})
		.select("id")
		.single();

	if (err1) {
		console.error("Error creating opt-out creator:", err1);
		return null;
	}

	// Create profile with opt-in OFF
	const { error: err2 } = await supabase.from("creator_profiles").insert({
		creator_id: creator1.id,
		context_opt_in: false,
		news_enabled: false,
		news_topics: [],
		news_cadence: "daily",
	});

	if (err2) {
		console.error("Error creating profile:", err2);
		return null;
	}

	// Create a test creator with opt-in ON
	const { data: creator2, error: err3 } = await supabase
		.from("creators")
		.insert({
			wallet_address: "0xTEST_OPT_IN",
			x_handle: "@test_opt_in",
		})
		.select("id")
		.single();

	if (err3) {
		console.error("Error creating opt-in creator:", err3);
		return null;
	}

	// Create profile with opt-in ON
	const { error: err4 } = await supabase.from("creator_profiles").insert({
		creator_id: creator2.id,
		context_opt_in: true,
		news_enabled: true,
		news_topics: ["AI", "Web3"],
		news_cadence: "daily",
		bio: "Test bio",
		tags: ["test"],
		interests: ["coding"],
		specialties: ["testing"],
	});

	if (err4) {
		console.error("Error creating opt-in profile:", err4);
		return null;
	}

	// Add post for opt-in creator
	const { error: err5 } = await supabase.from("creator_post_index").insert({
		creator_id: creator2.id,
		post_id: "post-1",
		post_content: "Test post content",
		post_timestamp: new Date().toISOString(),
		tags: ["test"],
		like_count: 0,
	});

	if (err5) {
		console.error("Error creating post:", err5);
		return null;
	}

	// Add summary for opt-in creator
	const { error: err6 } = await supabase
		.from("creator_conversation_summaries")
		.insert({
			creator_id: creator2.id,
			summary_text: "Test summary",
			token_count: 10,
			conversation_count: 1,
			earliest_timestamp: new Date().toISOString(),
			latest_timestamp: new Date().toISOString(),
		});

	if (err6) {
		console.error("Error creating summary:", err6);
		return null;
	}

	console.log("Test data created:");
	console.log(`  Opt-out creator: ${creator1.id}`);
	console.log(`  Opt-in creator: ${creator2.id}`);

	return { optOutId: creator1.id, optInId: creator2.id };
}

async function testOptOutBehavior(creatorId: string) {
	console.log("\n=== Testing OPT-OUT Behavior ===");

	const profile = await getProfile(supabase, creatorId);
	console.log(
		`✓ getProfile result: ${profile === null ? "NULL (expected)" : "UNEXPECTED DATA"}`,
	);

	const posts = await getRecentPosts(supabase, creatorId);
	console.log(
		`✓ getRecentPosts result: ${posts.length === 0 ? "EMPTY (expected)" : `UNEXPECTED ${posts.length} posts`}`,
	);

	const summary = await getSummary(supabase, creatorId);
	console.log(
		`✓ getSummary result: ${summary === null ? "NULL (expected)" : "UNEXPECTED DATA"}`,
	);

	const news = await getNewsDigest(supabase, creatorId);
	console.log(
		`✓ getNewsDigest result: ${news.length === 0 ? "EMPTY (expected)" : `UNEXPECTED ${news.length} digests`}`,
	);

	return (
		profile === null &&
		posts.length === 0 &&
		summary === null &&
		news.length === 0
	);
}

async function testOptInBehavior(creatorId: string) {
	console.log("\n=== Testing OPT-IN Behavior ===");

	const profile = await getProfile(supabase, creatorId);
	console.log(
		`✓ getProfile result: ${profile !== null ? "DATA RETURNED (expected)" : "NULL (unexpected)"}`,
	);

	const posts = await getRecentPosts(supabase, creatorId);
	console.log(
		`✓ getRecentPosts result: ${posts.length > 0 ? `${posts.length} posts (expected)` : "EMPTY (unexpected)"}`,
	);

	const summary = await getSummary(supabase, creatorId);
	console.log(
		`✓ getSummary result: ${summary !== null ? "DATA RETURNED (expected)" : "NULL (unexpected)"}`,
	);

	const news = await getNewsDigest(supabase, creatorId);
	console.log(
		`✓ getNewsDigest result: ${news.length >= 0 ? `${news.length} digests (expected)` : "ERROR"}`,
	);

	return profile !== null && posts.length > 0 && summary !== null;
}

async function cleanup(optOutId: string, optInId: string) {
	console.log("\n=== Cleaning up test data ===");
	await supabase.from("creators").delete().eq("id", optOutId);
	await supabase.from("creators").delete().eq("id", optInId);
	console.log("✓ Cleanup complete");
}

async function main() {
	try {
		const ids = await setupTestData();
		if (!ids) {
			console.error("Failed to set up test data");
			Deno.exit(1);
		}

		const optOutPass = await testOptOutBehavior(ids.optOutId);
		const optInPass = await testOptInBehavior(ids.optInId);

		await cleanup(ids.optOutId, ids.optInId);

		console.log("\n=== TEST RESULTS ===");
		console.log(`Opt-out behavior: ${optOutPass ? "✅ PASS" : "❌ FAIL"}`);
		console.log(`Opt-in behavior: ${optInPass ? "✅ PASS" : "❌ FAIL"}`);

		if (optOutPass && optInPass) {
			console.log("\n✅ ALL TESTS PASSED");
			Deno.exit(0);
		} else {
			console.log("\n❌ SOME TESTS FAILED");
			Deno.exit(1);
		}
	} catch (error) {
		console.error("Test error:", error);
		Deno.exit(1);
	}
}

main();
