/**
 * Context Data Access Layer
 *
 * Typed CRUD helpers for context tables with opt-in gating.
 * All read operations enforce opt-in checks at the data layer.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// TypeScript Types (matching migration schemas)
// ============================================================================

export type CreatorProfile = {
	id: string;
	creator_id: string;
	bio: string | null;
	tags: string[];
	interests: string[];
	specialties: string[];
	persona_text: string | null;
	context_opt_in: boolean;
	news_enabled: boolean;
	news_topics: string[];
	news_cadence: "hourly" | "daily" | "weekly";
	created_at: string;
	updated_at: string;
};

export type CreatorPostIndex = {
	id: string;
	creator_id: string;
	post_id: string;
	post_content: string;
	post_timestamp: string;
	tags: string[];
	like_count: number;
	created_at: string;
	updated_at: string;
};

export type CreatorConversationSummary = {
	id: string;
	creator_id: string;
	summary_text: string;
	token_count: number;
	conversation_count: number;
	earliest_timestamp: string;
	latest_timestamp: string;
	created_at: string;
	updated_at: string;
};

export type NewsDigestBullet = {
	source: string;
	url: string;
	timestamp: string;
	text: string;
};

export type CreatorNewsDigest = {
	id: string;
	creator_id: string;
	topic: string;
	cadence: "hourly" | "daily" | "weekly";
	digest_bullets: NewsDigestBullet[];
	last_fetched_at: string | null;
	created_at: string;
	updated_at: string;
};

export type CreatorEmbedding = {
	id: string;
	creator_id: string;
	embedding: number[];
	source_type: "post" | "conversation" | "profile";
	source_id: string;
	metadata: Record<string, unknown>;
	created_at: string;
	updated_at: string;
};

// ============================================================================
// Helper: Check Opt-In Status
// ============================================================================

async function checkOptIn(
	supabase: SupabaseClient,
	creatorId: string,
): Promise<boolean> {
	const { data } = await supabase
		.from("creator_profiles")
		.select("context_opt_in")
		.eq("creator_id", creatorId)
		.maybeSingle();

	return data?.context_opt_in === true;
}

// ============================================================================
// Profile Operations
// ============================================================================

/**
 * Get creator profile. Returns null if opt-in is OFF.
 */
export async function getProfile(
	supabase: SupabaseClient,
	creatorId: string,
): Promise<CreatorProfile | null> {
	const optedIn = await checkOptIn(supabase, creatorId);
	if (!optedIn) return null;

	const { data: profileData } = await supabase
		.from("creator_profiles")
		.select("*")
		.eq("creator_id", creatorId)
		.maybeSingle();

	if (!profileData) return null;

	const { data: creatorData } = await supabase
		.from("creators")
		.select("persona_text")
		.eq("id", creatorId)
		.maybeSingle();

	return {
		...profileData,
		persona_text: creatorData?.persona_text || null,
	} as CreatorProfile;
}

/**
 * Update or insert creator profile.
 * Does NOT enforce opt-in check (profile creation is always allowed).
 */
export async function updateProfile(
	supabase: SupabaseClient,
	creatorId: string,
	updates: Partial<
		Omit<CreatorProfile, "id" | "creator_id" | "created_at" | "updated_at">
	>,
): Promise<CreatorProfile> {
	const { data, error } = await supabase
		.from("creator_profiles")
		.upsert(
			{
				creator_id: creatorId,
				...updates,
			},
			{ onConflict: "creator_id" },
		)
		.select("*")
		.single();

	if (error) throw error;
	return data as CreatorProfile;
}

// ============================================================================
// Post Index Operations
// ============================================================================

/**
 * Get recent posts for a creator.
 * Returns empty array if opt-in is OFF.
 *
 * @param limit - Max number of posts to return (default: 20)
 * @param maxAgeDays - Max age in days (default: 90)
 */
export async function getRecentPosts(
	supabase: SupabaseClient,
	creatorId: string,
	options: { limit?: number; maxAgeDays?: number } = {},
): Promise<CreatorPostIndex[]> {
	const optedIn = await checkOptIn(supabase, creatorId);
	if (!optedIn) return [];

	const limit = options.limit ?? 20;
	const maxAgeDays = options.maxAgeDays ?? 90;
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

	const { data } = await supabase
		.from("creator_post_index")
		.select("*")
		.eq("creator_id", creatorId)
		.gte("post_timestamp", cutoffDate.toISOString())
		.order("post_timestamp", { ascending: false })
		.limit(limit);

	return (data || []) as CreatorPostIndex[];
}

// ============================================================================
// Summary Operations
// ============================================================================

/**
 * Get conversation summary for a creator.
 * Returns null if opt-in is OFF.
 */
export async function getSummary(
	supabase: SupabaseClient,
	creatorId: string,
): Promise<CreatorConversationSummary | null> {
	const optedIn = await checkOptIn(supabase, creatorId);
	if (!optedIn) return null;

	const { data } = await supabase
		.from("creator_conversation_summaries")
		.select("*")
		.eq("creator_id", creatorId)
		.maybeSingle();

	return data as CreatorConversationSummary | null;
}

// ============================================================================
// News Digest Operations
// ============================================================================

/**
 * Get news digests for a creator by topic.
 * Returns empty array if opt-in is OFF.
 */
export async function getNewsDigest(
	supabase: SupabaseClient,
	creatorId: string,
	topic?: string,
): Promise<CreatorNewsDigest[]> {
	const optedIn = await checkOptIn(supabase, creatorId);
	if (!optedIn) return [];

	let query = supabase
		.from("creator_news_digests")
		.select("*")
		.eq("creator_id", creatorId);

	if (topic) {
		query = query.eq("topic", topic);
	}

	const { data } = await query.order("updated_at", { ascending: false });

	return (data || []) as CreatorNewsDigest[];
}

// ============================================================================
// Embedding Operations
// ============================================================================

/**
 * Upsert an embedding for a creator.
 * Silently fails (no-op) if opt-in is OFF.
 */
export async function upsertEmbedding(
	supabase: SupabaseClient,
	params: {
		creatorId: string;
		embedding: number[];
		sourceType: "post" | "conversation" | "profile";
		sourceId: string;
		metadata?: Record<string, unknown>;
	},
): Promise<CreatorEmbedding | null> {
	const optedIn = await checkOptIn(supabase, params.creatorId);
	if (!optedIn) return null;

	const { data, error } = await supabase
		.from("creator_embeddings")
		.upsert(
			{
				creator_id: params.creatorId,
				embedding: params.embedding,
				source_type: params.sourceType,
				source_id: params.sourceId,
				metadata: params.metadata || {},
			},
			{
				onConflict: "creator_id,source_type,source_id",
				ignoreDuplicates: false,
			},
		)
		.select("*")
		.single();

	if (error) throw error;
	return data as CreatorEmbedding;
}
