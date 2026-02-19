/**
 * Context Retrieval Module
 *
 * Provides vector-based semantic search with recency/tag fallback for creator context.
 * - Vector similarity queries against creator_embeddings (pgvector)
 * - Fallback to recency + topic tags when embeddings unavailable
 * - Enforces history caps: last 20 posts OR 90 days (whichever smaller)
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRequiredEnv, getSupabaseUrl } from "./env.ts";

const HISTORY_CAP_POSTS = 20;
const HISTORY_CAP_DAYS = 90;

export type RetrievalResult = {
	posts: Array<{
		id: string;
		content_text: string;
		created_at: string;
		similarity?: number;
		tags?: string[];
	}>;
	method: "vector" | "fallback";
	truncated: boolean;
	metadata: {
		total_found: number;
		cap_applied: "posts" | "days" | "both" | "none";
	};
};

export type RetrievalOptions = {
	limit?: number;
	similarityThreshold?: number;
	tags?: string[];
};

/**
 * Generate embedding for query text using OpenRouter API
 */
async function generateQueryEmbedding(query: string): Promise<number[]> {
	const apiKey = getRequiredEnv("OPENROUTER_API_KEY");
	const embeddingsApiUrl = getRequiredEnv("OPENROUTER_EMBEDDINGS_API_URL");

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 15000);

	try {
		const response = await fetch(embeddingsApiUrl, {
			method: "POST",
			signal: controller.signal,
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				"HTTP-Referer": getSupabaseUrl(),
				"X-Title": "RailMintAI",
			},
			body: JSON.stringify({
				model: "text-embedding-ada-002",
				input: query,
			}),
		});

		if (!response.ok) {
			const errText = await response.text();
			throw new Error(
				`OpenRouter embeddings failed: ${response.status} ${errText.slice(0, 200)}`,
			);
		}

		const data = await response.json();
		const embedding = data.data?.[0]?.embedding;

		if (!embedding || !Array.isArray(embedding)) {
			throw new Error("Invalid embedding response from OpenRouter");
		}

		return embedding;
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * Calculate history cutoff date (90 days ago)
 */
function getHistoryCutoffDate(): string {
	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - HISTORY_CAP_DAYS);
	return cutoff.toISOString();
}

/**
 * Retrieve context using vector similarity search
 *
 * Queries creator_embeddings for similar posts, joins with posts table,
 * and enforces history caps.
 */
export async function retrieveVectorContext(
	supabase: SupabaseClient,
	creatorId: string,
	query: string,
	options: RetrievalOptions = {},
): Promise<RetrievalResult> {
	const limit = options.limit || HISTORY_CAP_POSTS;
	const threshold = options.similarityThreshold || 0.7;

	// Generate query embedding
	const queryEmbedding = await generateQueryEmbedding(query);

	// Calculate history cutoff
	const cutoffDate = getHistoryCutoffDate();

	// Query for similar embeddings with history constraints
	// Using pgvector's cosine similarity operator (<=>)
	const { data: embeddings, error } = await supabase.rpc(
		"match_creator_embeddings",
		{
			query_embedding: queryEmbedding,
			match_creator_id: creatorId,
			match_threshold: threshold,
			match_count: limit,
			cutoff_date: cutoffDate,
		},
	);

	if (error) {
		console.error("Vector similarity query failed:", error);
		throw new Error(`Vector retrieval failed: ${error.message}`);
	}

	if (!embeddings || embeddings.length === 0) {
		return {
			posts: [],
			method: "vector",
			truncated: false,
			metadata: {
				total_found: 0,
				cap_applied: "none",
			},
		};
	}

	// Fetch full post details for matched embeddings
	const postIds = embeddings.map((e: any) => e.source_id);
	const { data: posts, error: postsError } = await supabase
		.from("posts")
		.select("id, content_text, created_at")
		.in("id", postIds)
		.order("created_at", { ascending: false })
		.limit(HISTORY_CAP_POSTS);

	if (postsError) {
		throw new Error(`Failed to fetch posts: ${postsError.message}`);
	}

	// Merge similarity scores
	const postsWithSimilarity = (posts || []).map((post: any) => {
		const embedding = embeddings.find((e: any) => e.source_id === post.id);
		return {
			...post,
			similarity: embedding?.similarity || 0,
		};
	});

	const truncated = (posts?.length || 0) >= limit;
	const capApplied =
		truncated && (posts?.length || 0) < embeddings.length ? "both" : "posts";

	return {
		posts: postsWithSimilarity,
		method: "vector",
		truncated,
		metadata: {
			total_found: embeddings.length,
			cap_applied: capApplied,
		},
	};
}

/**
 * Retrieve context using recency + tag fallback
 *
 * Used when vector embeddings are unavailable or empty.
 * Returns most recent posts filtered by tags (if provided) and history caps.
 */
export async function retrieveFallbackContext(
	supabase: SupabaseClient,
	creatorId: string,
	options: RetrievalOptions = {},
): Promise<RetrievalResult> {
	const limit = options.limit || HISTORY_CAP_POSTS;
	const tags = options.tags || [];

	// Calculate history cutoff
	const cutoffDate = getHistoryCutoffDate();

	// Build query with recency and tag filters
	let query = supabase
		.from("posts")
		.select("id, content_text, created_at")
		.eq("creator_id", creatorId)
		.gte("created_at", cutoffDate)
		.order("created_at", { ascending: false })
		.limit(limit);

	// Apply tag filter if provided (assuming posts have a tags column)
	// Note: This requires posts table to have a tags column (JSONB or TEXT[])
	// If tags column doesn't exist, this filter is skipped
	if (tags.length > 0) {
		// Using contains for TEXT[] or JSONB array
		query = query.contains("tags", tags);
	}

	const { data: posts, error } = await query;

	if (error) {
		console.error("Fallback retrieval query failed:", error);
		throw new Error(`Fallback retrieval failed: ${error.message}`);
	}

	const truncated = (posts?.length || 0) >= limit;

	return {
		posts: (posts || []).map((post: any) => ({
			id: post.id,
			content_text: post.content_text,
			created_at: post.created_at,
		})),
		method: "fallback",
		truncated,
		metadata: {
			total_found: posts?.length || 0,
			cap_applied: truncated ? "posts" : "days",
		},
	};
}

/**
 * Main retrieval function with automatic fallback
 *
 * Attempts vector similarity search first, falls back to recency if:
 * - No embeddings exist for creator
 * - Vector search returns empty results
 * - Vector search fails
 */
export async function retrieveContext(
	supabase: SupabaseClient,
	creatorId: string,
	query: string,
	options: RetrievalOptions = {},
): Promise<RetrievalResult> {
	try {
		// First, check if creator has any embeddings
		const { count, error: countError } = await supabase
			.from("creator_embeddings")
			.select("*", { count: "exact", head: true })
			.eq("creator_id", creatorId)
			.limit(1);

		if (countError) {
			console.warn(
				"Failed to check embeddings count, using fallback:",
				countError,
			);
			return retrieveFallbackContext(supabase, creatorId, options);
		}

		// If no embeddings exist, use fallback immediately
		if (count === 0) {
			console.info(
				`No embeddings found for creator ${creatorId}, using fallback`,
			);
			return retrieveFallbackContext(supabase, creatorId, options);
		}

		// Try vector similarity search
		const vectorResult = await retrieveVectorContext(
			supabase,
			creatorId,
			query,
			options,
		);

		// If vector search returns empty, use fallback
		if (vectorResult.posts.length === 0) {
			console.info(
				`Vector search returned empty for creator ${creatorId}, using fallback`,
			);
			return retrieveFallbackContext(supabase, creatorId, options);
		}

		return vectorResult;
	} catch (error) {
		console.error("Vector retrieval error, falling back to recency:", error);
		return retrieveFallbackContext(supabase, creatorId, options);
	}
}

/**
 * SQL function to be created in Supabase for vector similarity matching.
 * This function should be created via migration:
 *
 * CREATE OR REPLACE FUNCTION match_creator_embeddings(
 *   query_embedding vector(1536),
 *   match_creator_id uuid,
 *   match_threshold float,
 *   match_count int,
 *   cutoff_date timestamptz
 * )
 * RETURNS TABLE (
 *   id uuid,
 *   creator_id uuid,
 *   source_id uuid,
 *   source_type text,
 *   similarity float,
 *   created_at timestamptz
 * )
 * LANGUAGE plpgsql
 * AS $$
 * BEGIN
 *   RETURN QUERY
 *   SELECT
 *     ce.id,
 *     ce.creator_id,
 *     ce.source_id,
 *     ce.source_type,
 *     1 - (ce.embedding <=> query_embedding) as similarity,
 *     ce.created_at
 *   FROM creator_embeddings ce
 *   WHERE ce.creator_id = match_creator_id
 *     AND ce.created_at >= cutoff_date
 *     AND 1 - (ce.embedding <=> query_embedding) > match_threshold
 *   ORDER BY ce.embedding <=> query_embedding
 *   LIMIT match_count;
 * END;
 * $$;
 */
