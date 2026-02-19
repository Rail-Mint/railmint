import { requireAdmin } from "../_shared/admin-auth.ts";
import { getServiceRoleKey } from "../_shared/env.ts";
import {
	errorResponse,
	handlePreflight,
	jsonResponse,
	parseJsonBody,
} from "../_shared/http.ts";
import { createInMemoryRateLimiter } from "../_shared/rate-limit.ts";
import { isWalletAddress } from "../_shared/signature.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

type CloseEpochBody = {
	epoch_id?: number;
	wallet_address?: string;
};

type PostRow = {
	id: string;
	creator_id: string;
};

type LikeRow = {
	post_id: string;
};

const checkRateLimit = createInMemoryRateLimiter();

function parseEpochId(value: unknown): number | null {
	const numeric = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(numeric) || numeric < 1) return null;
	return Math.floor(numeric);
}

Deno.serve(async (request: Request) => {
	const preflight = handlePreflight(request);
	if (preflight) return preflight;

	try {
		const body = await parseJsonBody<CloseEpochBody>(request);
		const epochId = parseEpochId(body.epoch_id);
		const walletAddress = String(body.wallet_address ?? "").trim();

		if (!epochId) {
			return errorResponse("Valid epoch_id is required", 400);
		}
		if (!isWalletAddress(walletAddress)) {
			return errorResponse("Invalid wallet address format", 400);
		}

		const supabase = createServiceRoleClient();
		const { adminId } = await requireAdmin(
			request,
			supabase,
			getServiceRoleKey(),
		);

		if (!checkRateLimit(`close-epoch:${adminId}`, 3, 60_000)) {
			return errorResponse("Rate limit exceeded. Try again later.", 429);
		}

		const { error: closeError } = await supabase
			.from("epochs")
			.update({ status: "closed" })
			.eq("id", epochId)
			.eq("status", "open");

		if (closeError) throw closeError;

		const { data: postRows, error: postsError } = await supabase
			.from("posts")
			.select("id, creator_id")
			.eq("epoch_id", epochId);

		if (postsError) throw postsError;
		const posts = (postRows ?? []) as PostRow[];
		if (posts.length === 0) {
			return jsonResponse({
				success: true,
				message: "Epoch closed, no posts to rank",
			});
		}

		const postIds = posts.map((post) => post.id);
		const { data: likeRows, error: likesError } = await supabase
			.from("likes")
			.select("post_id")
			.in("post_id", postIds);

		if (likesError) throw likesError;
		const likes = (likeRows ?? []) as LikeRow[];

		const likesByPost = new Map<string, number>();
		for (const like of likes) {
			likesByPost.set(like.post_id, (likesByPost.get(like.post_id) ?? 0) + 1);
		}

		const likesByCreator = new Map<string, number>();
		for (const post of posts) {
			likesByCreator.set(
				post.creator_id,
				(likesByCreator.get(post.creator_id) ?? 0) +
					(likesByPost.get(post.id) ?? 0),
			);
		}

		const rankings = Array.from(likesByCreator.entries())
			.map(([creator_id, like_count]) => ({ creator_id, like_count }))
			.sort((left, right) => right.like_count - left.like_count)
			.map((row, index) => ({
				epoch_id: epochId,
				creator_id: row.creator_id,
				rank: index + 1,
				like_count: row.like_count,
				reward_amount: 0,
			}));

		const { data: epochRow, error: epochError } = await supabase
			.from("epochs")
			.select("reward_pool")
			.eq("id", epochId)
			.single();

		if (epochError) throw epochError;

		const rewardPoolRaw = (epochRow as { reward_pool?: number | string } | null)
			?.reward_pool;
		const rewardPool = Number(rewardPoolRaw ?? 0);
		const shares = [0.5, 0.3, 0.2];

		for (
			let index = 0;
			index < rankings.length && index < shares.length;
			index += 1
		) {
			rankings[index].reward_amount = Number(
				(rewardPool * shares[index]).toFixed(8),
			);
		}

		if (rankings.length > 0) {
			const { error: insertError } = await supabase
				.from("epoch_rewards")
				.insert(rankings);
			if (insertError) throw insertError;
		}

		return jsonResponse({ success: true, rankings });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		console.error("close-epoch error:", message);
		return errorResponse(message, 400);
	}
});
