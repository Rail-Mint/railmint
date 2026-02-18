import { createClient } from "@supabase/supabase-js";
import {
	getNewsDigest,
	getProfile,
	getRecentPosts,
	getSummary,
} from "./supabase/functions/_shared/context-dal.ts";

const supabaseUrl = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseKey =
	process.env.SUPABASE_SERVICE_ROLE_KEY || "your-service-role-key";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testOptOut() {
	console.log("=== Testing Opt-Out Scenario ===\n");

	const testCreatorId = "00000000-0000-0000-0000-000000000001";

	await supabase.from("creator_profiles").upsert({
		creator_id: testCreatorId,
		context_opt_in: false,
		bio: "Test bio",
		tags: ["test"],
	});

	console.log("1. Testing getProfile with opt-in OFF...");
	const profile = await getProfile(supabase, testCreatorId);
	console.log(
		`   Result: ${profile === null ? "✅ NULL (expected)" : "❌ Got data (unexpected)"}`,
	);

	console.log("\n2. Testing getRecentPosts with opt-in OFF...");
	const posts = await getRecentPosts(supabase, testCreatorId);
	console.log(
		`   Result: ${posts.length === 0 ? "✅ Empty array (expected)" : "❌ Got data (unexpected)"}`,
	);

	console.log("\n3. Testing getSummary with opt-in OFF...");
	const summary = await getSummary(supabase, testCreatorId);
	console.log(
		`   Result: ${summary === null ? "✅ NULL (expected)" : "❌ Got data (unexpected)"}`,
	);

	console.log("\n4. Testing getNewsDigest with opt-in OFF...");
	const news = await getNewsDigest(supabase, testCreatorId);
	console.log(
		`   Result: ${news.length === 0 ? "✅ Empty array (expected)" : "❌ Got data (unexpected)"}`,
	);

	console.log("\n=== Opt-Out Test Complete ===");
	console.log(
		`Summary: Profile=${profile === null}, Posts=${posts.length === 0}, Summary=${summary === null}, News=${news.length === 0}`,
	);

	const allPass =
		profile === null &&
		posts.length === 0 &&
		summary === null &&
		news.length === 0;
	console.log(
		`\nVERDICT: ${allPass ? "✅ ALL CHECKS PASSED" : "❌ SOME CHECKS FAILED"}`,
	);

	process.exit(allPass ? 0 : 1);
}

testOptOut().catch((err) => {
	console.error("Test failed with error:", err);
	process.exit(1);
});
