import { keccak256, toBytes } from "https://esm.sh/viem@2.21.0";
import {
	errorResponse,
	handlePreflight,
	jsonResponse,
	parseJsonBody,
} from "../_shared/http.ts";
import { verifyWalletSignature } from "../_shared/signature.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

type CreatePostBody = {
	wallet_address?: string;
	signature?: string;
	sign_timestamp?: number;
	content_text?: string;
	content_html?: string;
};

Deno.serve(async (request: Request) => {
	const preflight = handlePreflight(request);
	if (preflight) return preflight;

	try {
		const body = await parseJsonBody<CreatePostBody>(request);
		const walletAddress = await verifyWalletSignature(body, "create-post");
		const contentText = String(body.content_text ?? "").trim();

		if (!contentText || contentText.length < 1 || contentText.length > 10000) {
			return errorResponse("Content text must be 1-10000 characters", 400);
		}

		const supabase = createServiceRoleClient();
		const { data: creator, error: creatorError } = await supabase
			.from("creators")
			.select("id")
			.ilike("wallet_address", walletAddress)
			.single();

		if (creatorError || !creator) {
			return errorResponse("Creator not found for this wallet", 403);
		}

		const creatorId = (creator as { id?: string }).id;
		if (!creatorId) {
			return errorResponse("Creator not found for this wallet", 403);
		}

		const { data: epoch } = await supabase
			.from("epochs")
			.select("id")
			.in("status", ["open", "active"])
			.order("id", { ascending: false })
			.limit(1)
			.single();

		const epochId = (epoch as { id?: number } | null)?.id ?? 1;
		const postId = crypto.randomUUID();
		const createdAt = new Date().toISOString();
		const promptText = "Manual post from Studio";

		const promptHash = keccak256(
			toBytes(`GOODVIBES_PROMPT_V1\n${postId}\n${creatorId}\n${promptText}`),
		);
		const contentHash = keccak256(
			toBytes(`GOODVIBES_CONTENT_V1\n${postId}\n${contentText}`),
		);
		const metaHash = keccak256(
			toBytes(`GOODVIBES_META_V1\nmanual\n${createdAt}\n${walletAddress}`),
		);

		const { error: insertError } = await supabase.from("posts").insert({
			id: postId,
			creator_id: creatorId,
			epoch_id: epochId,
			prompt_text: promptText,
			content_text: contentText,
			prompt_hash: promptHash,
			content_hash: contentHash,
			meta_hash: metaHash,
			created_at: createdAt,
		});

		if (insertError) throw insertError;
		return jsonResponse({ success: true, post_id: postId });
	} catch (error) {
		const errorId = crypto.randomUUID().slice(0, 8);
		const message = error instanceof Error ? error.message : String(error);
		console.error(`[create-post:${errorId}]`, message);
		const userMessage = /signature|expired|wallet/i.test(message)
			? message
			: "Failed to create post";
		return jsonResponse({ error: userMessage, error_id: errorId }, 400);
	}
});
