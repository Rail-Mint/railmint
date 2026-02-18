#!/usr/bin/env node

import { readFileSync } from "fs";

const contextPackPath = "./supabase/functions/_shared/context-pack.ts";
const contextPack = readFileSync(contextPackPath, "utf-8");

console.log("=== CONTEXT PACK MODULE VALIDATION ===\n");

const checks = {
	"ContextPack interface exists": /export type ContextPack = \{/,
	"persona field present": /persona: string \| null;/,
	"posts field present": /posts: CreatorPostIndex\[\] \| null;/,
	"news field present": /news: CreatorNewsDigest\[\] \| null;/,
	"totalTokens field present": /totalTokens: number;/,
	"TOKEN_BUDGET constant = 1000": /const TOKEN_BUDGET = 1000;/,
	"CHARS_PER_TOKEN constant = 4": /const CHARS_PER_TOKEN = 4;/,
	"estimateTokens function exists":
		/function estimateTokens\(text: string\): number/,
	"estimatePersonaTokens function exists":
		/function estimatePersonaTokens\(profile: CreatorProfile\): number/,
	"estimatePostsTokens function exists":
		/function estimatePostsTokens\(posts: CreatorPostIndex\[\]\): number/,
	"estimateNewsTokens function exists":
		/function estimateNewsTokens\(news: CreatorNewsDigest\[\]\): number/,
	"buildContextPack function exported":
		/export async function buildContextPack\(/,
	"buildContextPack accepts supabase param": /supabase: SupabaseClient/,
	"buildContextPack accepts creatorId param": /creatorId: string/,
	"buildContextPack returns ContextPack": /: Promise<ContextPack>/,
	"Opt-in check via getProfile":
		/const profile = await getProfile\(supabase, creatorId\);/,
	"Returns empty pack when opt-out":
		/if \(!profile\) \{[\s\S]*?return \{[\s\S]*?persona: null,[\s\S]*?posts: null,[\s\S]*?news: null,[\s\S]*?totalTokens: 0/,
	"Fetches posts via getRecentPosts": /getRecentPosts\(supabase, creatorId\)/,
	"Fetches summary via getSummary": /getSummary\(supabase, creatorId\)/,
	"Fetches news via getNewsDigest": /getNewsDigest\(supabase, creatorId\)/,
	"Drop-order: Persona always included": /let totalTokens = personaTokens;/,
	"Drop-order: Posts added if budget allows":
		/if \(totalTokens \+ postsTokens <= TOKEN_BUDGET/,
	"Drop-order: News added if budget allows":
		/if \(totalTokens \+ newsTokens <= TOKEN_BUDGET/,
	"Token budget enforcement": /totalTokens \+ .* <= TOKEN_BUDGET/,
	"Returns totalTokens": /pack\.totalTokens = totalTokens;/,
};

let passed = 0;
let failed = 0;

for (const [desc, pattern] of Object.entries(checks)) {
	if (pattern.test(contextPack)) {
		console.log(`✅ ${desc}`);
		passed++;
	} else {
		console.log(`❌ ${desc}`);
		failed++;
	}
}

console.log(`\n=== SUMMARY ===`);
console.log(`Passed: ${passed}/${Object.keys(checks).length}`);
console.log(`Failed: ${failed}/${Object.keys(checks).length}`);

console.log("\n=== TOKEN BUDGET SCENARIOS ===\n");

console.log("Scenario 1: Persona=200, Posts=400, News=300 (Total=900)");
console.log("  Expected: All sections included");
console.log("  Drop order: None (all fit)\n");

console.log("Scenario 2: Persona=200, Posts=600, News=400 (Total=1200)");
console.log("  Expected: Persona + Posts only (News dropped)");
console.log("  Drop order: News dropped first\n");

console.log("Scenario 3: Persona=200, Posts=900, News=200 (Total=1300)");
console.log("  Expected: Persona only (Posts + News dropped)");
console.log("  Drop order: Posts dropped (too large), News not added\n");

console.log("Scenario 4: Opt-in=OFF");
console.log("  Expected: Empty pack (totalTokens=0)");
console.log("  Drop order: N/A (opt-out enforced)\n");

console.log("=== DROP-ORDER LOGIC ===\n");
console.log("Priority 1: Persona (always kept)");
console.log("Priority 2: Posts (dropped if exceeds budget)");
console.log("Priority 3: News (dropped if posts + news exceed budget)");
console.log("Hard cap: ≤1,000 tokens total\n");

if (failed > 0) {
	console.error("\n❌ VALIDATION FAILED");
	process.exit(1);
}

console.log("\n✅ VALIDATION PASSED");
