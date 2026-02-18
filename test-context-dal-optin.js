import { createClient } from "@supabase/supabase-js";
import { randomUUID as crypto_randomUUID } from "crypto";
import {
	getNewsDigest,
	getProfile,
	getRecentPosts,
	getSummary,
	updateProfile,
} from "./supabase/functions/_shared/context-dal.ts";

const crypto = { randomUUID: crypto_randomUUID };

const supabaseUrl = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseKey =
	process.env.SUPABASE_SERVICE_ROLE_KEY || "your-service-role-key";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testOptIn() {
	console.log("=== Testing Opt-In Scenario ===\n");

	const testCreatorId = crypto.randomUUID();
	const testWallet = `0x${crypto.randomUUID().replace(/-/g, "").slice(0, 40)}`;

	const { error: creatorError } = await supabase.from("creators").insert({
		id: testCreatorId,
		x_handle: `@testcreator${Date.now()}`,
		wallet_address: testWallet,
		clone_name: "Test Creator",
		persona_text: "Test persona",
		prompt_template: "Test prompt template",
		x_verified: true,
	});

	if (creatorError) {
		console.error("Failed to create test creator:", creatorError);
		process.exit(1);
	}

	await updateProfile(supabase, testCreatorId, {
		context_opt_in: true,
		bio: "Test creator with opt-in",
		tags: ["AI", "Web3"],
		interests: ["DeFi", "BNB"],
	});

	const { error: epochError } = await supabase.from("epochs").insert({
		id: 1,
		start_at: new Date().toISOString(),
		end_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
		status: "open",
		reward_pool: 100,
	});

	if (epochError && epochError.code !== "23505") {
		console.error("Failed to create epoch:", epochError);
	}

	const postId = crypto.randomUUID();
	const { error: postError } = await supabase.from("posts").insert({
		id: postId,
		creator_id: testCreatorId,
		epoch_id: 1,
		prompt_text: "Test prompt",
		content_text: "Test post about BNB ecosystem",
		prompt_hash: "0x1234",
		content_hash: "0x5678",
		meta_hash: "0xabcd",
	});

	if (postError) {
		console.error("Failed to create post:", postError);
	}

	const { error: indexError } = await supabase
		.from("creator_post_index")
		.insert({
			creator_id: testCreatorId,
			post_id: postId,
			post_content: "Test post about BNB ecosystem",
			post_timestamp: new Date().toISOString(),
			tags: ["BNB", "DeFi"],
			like_count: 5,
		});

	if (indexError) {
		console.error("Failed to create post index:", indexError);
	}

	await supabase.from("creator_conversation_summaries").upsert({
		creator_id: testCreatorId,
		summary_text: "Active creator discussing DeFi trends",
		token_count: 150,
		conversation_count: 10,
		earliest_timestamp: new Date(
			Date.now() - 7 * 24 * 60 * 60 * 1000,
		).toISOString(),
		latest_timestamp: new Date().toISOString(),
	});

	console.log("1. Testing getProfile with opt-in ON...");
	const profile = await getProfile(supabase, testCreatorId);
	console.log(
		`   Result: ${profile !== null ? "✅ Got profile data (expected)" : "❌ NULL (unexpected)"}`,
	);
	if (profile) {
		console.log(`   Bio: ${profile.bio}`);
		console.log(`   Tags: ${profile.tags.join(", ")}`);
	}

	console.log("\n2. Testing getRecentPosts with opt-in ON...");
	const posts = await getRecentPosts(supabase, testCreatorId);
	console.log(
		`   Result: ${posts.length > 0 ? "✅ Got posts (expected)" : "❌ Empty (unexpected)"}`,
	);
	console.log(`   Post count: ${posts.length}`);

	console.log("\n3. Testing getSummary with opt-in ON...");
	const summary = await getSummary(supabase, testCreatorId);
	console.log(
		`   Result: ${summary !== null ? "✅ Got summary (expected)" : "❌ NULL (unexpected)"}`,
	);
	if (summary) {
		console.log(`   Summary: ${summary.summary_text.slice(0, 50)}...`);
		console.log(`   Token count: ${summary.token_count}`);
	}

	console.log("\n4. Testing getNewsDigest with opt-in ON...");
	const news = await getNewsDigest(supabase, testCreatorId);
	console.log(
		`   Result: ${news.length >= 0 ? "✅ Query succeeded (expected)" : "❌ Failed (unexpected)"}`,
	);
	console.log(`   Digest count: ${news.length}`);

	console.log("\n=== Opt-In Test Complete ===");
	console.log(
		`Summary: Profile=${profile !== null}, Posts=${posts.length}, Summary=${summary !== null}, News=OK`,
	);

	const allPass = profile !== null && posts.length > 0 && summary !== null;
	console.log(
		`\nVERDICT: ${allPass ? "✅ ALL CHECKS PASSED" : "❌ SOME CHECKS FAILED"}`,
	);

	process.exit(allPass ? 0 : 1);
}

testOptIn().catch((err) => {
	console.error("Test failed with error:", err);
	process.exit(1);
});
