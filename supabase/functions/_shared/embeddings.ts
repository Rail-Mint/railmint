import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * OpenRouter embeddings module for RailMintAI
 *
 * CRITICAL: This module respects opt-in controls.
 * - When context_opt_in is OFF: no embeddings are generated or stored
 * - When context_opt_in is ON: embeddings are created via OpenRouter
 */

type SourceType = "post" | "conversation" | "profile";

interface EmbeddingRequest {
	creatorId: string;
	text: string;
	sourceType: SourceType;
	sourceId: string;
	metadata?: Record<string, unknown>;
}

interface EmbeddingResult {
	embeddingId: string;
	created: boolean;
}

const OPENROUTER_EMBEDDINGS_MODEL = "openai/text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Check if a creator has opted in to context usage
 */
async function checkOptIn(
	supabase: SupabaseClient,
	creatorId: string,
): Promise<boolean> {
	const { data: profile } = await supabase
		.from("creator_profiles")
		.select("context_opt_in")
		.eq("creator_id", creatorId)
		.maybeSingle();

	return profile?.context_opt_in === true;
}

/**
 * Generate embedding vector via OpenRouter
 */
async function generateEmbedding(text: string): Promise<number[]> {
	const apiKey = Deno.env.get("OPENROUTER_API_KEY");
	if (!apiKey) {
		throw new Error("OPENROUTER_API_KEY is not configured");
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

	try {
		const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
			method: "POST",
			signal: controller.signal,
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				"HTTP-Referer": Deno.env.get("SUPABASE_URL") || "",
				"X-Title": "RailMintAI",
			},
			body: JSON.stringify({
				model: OPENROUTER_EMBEDDINGS_MODEL,
				input: text.slice(0, 8000), // Limit text length to avoid token limits
			}),
		});

		if (!response.ok) {
			const errText = await response.text();
			throw new Error(
				`OpenRouter embeddings error ${response.status}: ${errText.slice(0, 200)}`,
			);
		}

		const data = await response.json();
		const embedding = data.data?.[0]?.embedding;

		if (
			!Array.isArray(embedding) ||
			embedding.length !== EMBEDDING_DIMENSIONS
		) {
			throw new Error(
				`Invalid embedding response: expected ${EMBEDDING_DIMENSIONS} dimensions`,
			);
		}

		return embedding;
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * Create and store an embedding for a creator's content
 *
 * FAIL CLOSED: If opt-in is OFF, this function returns early without creating embeddings
 *
 * @param supabase - Supabase client with service role permissions
 * @param request - Embedding request with creator ID, text, source type, and source ID
 * @returns Result with embedding ID if created, or indication that it was skipped
 */
export async function createEmbedding(
	supabase: SupabaseClient,
	request: EmbeddingRequest,
): Promise<EmbeddingResult> {
	// CRITICAL: Check opt-in first (fail closed)
	const optedIn = await checkOptIn(supabase, request.creatorId);
	if (!optedIn) {
		console.info("Embedding skipped: creator opt-in is OFF", {
			creator_id: request.creatorId,
			source_type: request.sourceType,
			source_id: request.sourceId,
		});
		return {
			embeddingId: "",
			created: false,
		};
	}

	// Generate embedding via OpenRouter
	const embedding = await generateEmbedding(request.text);

	// Store in creator_embeddings table
	const { data, error } = await supabase
		.from("creator_embeddings")
		.insert({
			creator_id: request.creatorId,
			embedding: `[${embedding.join(",")}]`, // Convert array to pgvector format
			source_type: request.sourceType,
			source_id: request.sourceId,
			metadata: request.metadata || {},
		})
		.select("id")
		.single();

	if (error) throw error;

	console.info("Embedding created", {
		embedding_id: data.id,
		creator_id: request.creatorId,
		source_type: request.sourceType,
		source_id: request.sourceId,
	});

	return {
		embeddingId: data.id,
		created: true,
	};
}

/**
 * Convenience function to create embedding for a post
 */
export async function createEmbeddingForPost(
	supabase: SupabaseClient,
	creatorId: string,
	postId: string,
	contentText: string,
): Promise<EmbeddingResult> {
	return createEmbedding(supabase, {
		creatorId,
		text: contentText,
		sourceType: "post",
		sourceId: postId,
		metadata: { post_id: postId },
	});
}

/**
 * Convenience function to create embedding for a conversation summary
 */
export async function createEmbeddingForConversation(
	supabase: SupabaseClient,
	creatorId: string,
	conversationId: string,
	summaryText: string,
): Promise<EmbeddingResult> {
	return createEmbedding(supabase, {
		creatorId,
		text: summaryText,
		sourceType: "conversation",
		sourceId: conversationId,
		metadata: { conversation_id: conversationId },
	});
}

/**
 * Convenience function to create embedding for a creator profile
 */
export async function createEmbeddingForProfile(
	supabase: SupabaseClient,
	creatorId: string,
	profileText: string,
): Promise<EmbeddingResult> {
	return createEmbedding(supabase, {
		creatorId,
		text: profileText,
		sourceType: "profile",
		sourceId: creatorId,
		metadata: { profile: true },
	});
}
