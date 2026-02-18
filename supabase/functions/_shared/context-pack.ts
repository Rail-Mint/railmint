/**
 * Context Pack Builder
 *
 * Assembles persona + posts + news sections with strict token budgeting.
 * - Hard limit: ≤1,000 tokens total
 * - Drop order: news first, then posts, always keep persona
 * - Enforces opt-in gating (empty pack when OFF)
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
	type CreatorConversationSummary,
	type CreatorNewsDigest,
	type CreatorPostIndex,
	type CreatorProfile,
	getNewsDigest,
	getProfile,
	getRecentPosts,
	getSummary,
} from "./context-dal.ts";

// ============================================================================
// Constants
// ============================================================================

const TOKEN_BUDGET = 1000;
const CHARS_PER_TOKEN = 4; // Estimation: 1 token ≈ 4 characters

// ============================================================================
// Types
// ============================================================================

export type ContextPack = {
	persona: string | null;
	posts: CreatorPostIndex[] | null;
	news: CreatorNewsDigest[] | null;
	totalTokens: number;
};

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Estimate token count from text length.
 * Uses simple heuristic: 1 token ≈ 4 characters.
 *
 * For production accuracy, consider tiktoken via esm.sh.
 */
function estimateTokens(text: string): number {
	if (!text) return 0;
	return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimate tokens for persona section.
 * Includes bio, tags, interests, specialties.
 */
function estimatePersonaTokens(profile: CreatorProfile): number {
	let text = profile.bio || "";
	text += ` ${profile.tags.join(", ")}`;
	text += ` ${profile.interests.join(", ")}`;
	text += ` ${profile.specialties.join(", ")}`;
	return estimateTokens(text);
}

/**
 * Estimate tokens for posts section.
 * Includes post content and tags.
 */
function estimatePostsTokens(posts: CreatorPostIndex[]): number {
	let totalChars = 0;
	for (const post of posts) {
		totalChars += post.post_content.length;
		if (post.tags.length > 0) {
			totalChars += post.tags.join(", ").length;
		}
	}
	return Math.ceil(totalChars / CHARS_PER_TOKEN);
}

/**
 * Estimate tokens for news section.
 * Includes all digest bullets (text + source + url).
 */
function estimateNewsTokens(news: CreatorNewsDigest[]): number {
	let totalChars = 0;
	for (const digest of news) {
		for (const bullet of digest.digest_bullets) {
			totalChars += bullet.text.length;
			totalChars += bullet.source.length;
			totalChars += bullet.url.length;
		}
	}
	return Math.ceil(totalChars / CHARS_PER_TOKEN);
}

// ============================================================================
// Context Pack Builder
// ============================================================================

/**
 * Build context pack with strict token budgeting.
 *
 * Drop order:
 * 1. Drop news first (lowest priority)
 * 2. Drop posts next (medium priority)
 * 3. Always keep persona (highest priority)
 *
 * Returns empty pack when opt-in is OFF.
 *
 * @param supabase - Supabase client (service role)
 * @param creatorId - Creator UUID
 * @returns Context pack with totalTokens count
 */
export async function buildContextPack(
	supabase: SupabaseClient,
	creatorId: string,
): Promise<ContextPack> {
	// Check opt-in status (via getProfile - returns null if opt-out)
	const profile = await getProfile(supabase, creatorId);
	if (!profile) {
		// Opt-in is OFF - return empty pack
		return {
			persona: null,
			posts: null,
			news: null,
			totalTokens: 0,
		};
	}

	// Fetch all context data in parallel
	const [posts, summary, newsDigests] = await Promise.all([
		getRecentPosts(supabase, creatorId),
		getSummary(supabase, creatorId),
		getNewsDigest(supabase, creatorId),
	]);

	// Build persona text from profile + summary
	let personaText = "";
	if (profile.bio) {
		personaText += profile.bio;
	}
	if (summary?.summary_text) {
		personaText += `\n\n${summary.summary_text}`;
	}
	if (profile.tags.length > 0) {
		personaText += `\nTags: ${profile.tags.join(", ")}`;
	}
	if (profile.interests.length > 0) {
		personaText += `\nInterests: ${profile.interests.join(", ")}`;
	}
	if (profile.specialties.length > 0) {
		personaText += `\nSpecialties: ${profile.specialties.join(", ")}`;
	}
	if (profile.persona_text) {
		personaText += `\n\n${profile.persona_text}`;
	}

	const rawPersonaTokens = estimateTokens(personaText);
	const PERSONA_TOKEN_CAP = 500;
	if (rawPersonaTokens > PERSONA_TOKEN_CAP) {
		const targetLength = Math.floor(
			personaText.length * (PERSONA_TOKEN_CAP / rawPersonaTokens),
		);
		personaText = personaText.substring(0, targetLength);
	}

	// Calculate token counts for each section
	const personaTokens = estimateTokens(personaText);
	const postsTokens = estimatePostsTokens(posts);
	const newsTokens = estimateNewsTokens(newsDigests);

	// Initialize pack with persona (always included)
	let totalTokens = personaTokens;
	const pack: ContextPack = {
		persona: personaText || null,
		posts: null,
		news: null,
		totalTokens: 0,
	};

	// Drop order logic: include posts, then news, if budget allows
	// Priority 1: Persona (already included above)
	// Priority 2: Posts
	if (totalTokens + postsTokens <= TOKEN_BUDGET && posts.length > 0) {
		pack.posts = posts;
		totalTokens += postsTokens;
	}

	// Priority 3: News (only if posts fit AND news fits)
	if (totalTokens + newsTokens <= TOKEN_BUDGET && newsDigests.length > 0) {
		pack.news = newsDigests;
		totalTokens += newsTokens;
	}

	// Set final token count
	pack.totalTokens = totalTokens;

	return pack;
}
