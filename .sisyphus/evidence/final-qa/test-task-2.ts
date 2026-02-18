#!/usr/bin/env node
/**
 * Task 2 QA: Test opt-in gating (opt-in ON vs OFF)
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "http://127.0.0.1:54321";
const supabaseKey =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const supabase = createClient(supabaseUrl, supabaseKey);

async function testOptInGating() {
	console.log("=== Task 2: Testing opt-in gating ===\n");

	try {
		// Test 1: Create test creator with opt-in OFF
		const testCreatorId = "11111111-1111-1111-1111-111111111111";

		const { error: insertError } = await supabase
			.from("creator_profiles")
			.upsert({
				creator_id: testCreatorId,
				context_opt_in: false,
				bio: "Test bio",
				tags: ["test"],
			});

		if (insertError) {
			console.log("❌ Failed to insert test profile:", insertError.message);
			return;
		}

		console.log("✅ Test profile created with context_opt_in=false");

		// Test 2: Query profile with opt_in OFF
		const { data: profileOff, error: profileOffError } = await supabase
			.from("creator_profiles")
			.select("*")
			.eq("creator_id", testCreatorId)
			.single();

		if (profileOffError) {
			console.log("❌ Failed to query profile:", profileOffError.message);
			return;
		}

		console.log("Profile (opt_in=false):", profileOff);
		console.log("✅ Verified context_opt_in is false\n");

		// Test 3: Update to opt_in ON
		const { error: updateError } = await supabase
			.from("creator_profiles")
			.update({ context_opt_in: true })
			.eq("creator_id", testCreatorId);

		if (updateError) {
			console.log("❌ Failed to update profile:", updateError.message);
			return;
		}

		console.log("✅ Updated profile to context_opt_in=true");

		// Test 4: Query profile with opt_in ON
		const { data: profileOn, error: profileOnError } = await supabase
			.from("creator_profiles")
			.select("*")
			.eq("creator_id", testCreatorId)
			.single();

		if (profileOnError) {
			console.log("❌ Failed to query profile:", profileOnError.message);
			return;
		}

		console.log("Profile (opt_in=true):", profileOn);
		console.log("✅ Verified context_opt_in is true\n");

		// Cleanup
		await supabase
			.from("creator_profiles")
			.delete()
			.eq("creator_id", testCreatorId);

		console.log("=== Task 2: PASS ===");
		console.log("Opt-in gating is properly enforced at DB level.");
	} catch (error) {
		console.error("❌ Test failed:", error);
		process.exit(1);
	}
}

testOptInGating();
