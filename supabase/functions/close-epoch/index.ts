import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type CreatorAggregate = {
	likeCount: number;
	qualitySum: number;
	moderationSum: number;
	compositeSum: number;
	postCount: number;
};

function round4(value: number): number {
	return Math.round(value * 10000) / 10000;
}

serve(async (req) => {
	if (req.method === "OPTIONS")
		return new Response(null, { headers: corsHeaders });

	try {
		const { epoch_id, wallet_address } = await req.json();
		if (!epoch_id || !wallet_address)
			throw new Error("epoch_id and wallet_address required");

		const supabase = createClient(
			Deno.env.get("SUPABASE_URL")!,
			Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
		);

		// Update epoch status
		const { error: updateErr } = await supabase
			.from("epochs")
			.update({ status: "closed" })
			.eq("id", epoch_id)
			.eq("status", "open");

		if (updateErr) throw updateErr;

		const { data: posts } = await supabase
			.from("posts")
			.select(
				"id, creator_id, quality_score, moderation_score, composite_score",
			)
			.eq("epoch_id", epoch_id);

		if (!posts || posts.length === 0) {
			return new Response(
				JSON.stringify({
					success: true,
					message: "Epoch closed, no posts to rank",
				}),
				{
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				},
			);
		}

		const postIds = posts.map((p) => p.id);
		const { data: likes } = await supabase
			.from("likes")
			.select("post_id")
			.in("post_id", postIds);
		const likesArr = likes || [];
		const likesByPost: Record<string, number> = {};
		for (const like of likesArr) {
			likesByPost[like.post_id] = (likesByPost[like.post_id] || 0) + 1;
		}

		const creatorStats: Record<string, CreatorAggregate> = {};
		for (const p of posts) {
			if (!creatorStats[p.creator_id]) {
				creatorStats[p.creator_id] = {
					likeCount: 0,
					qualitySum: 0,
					moderationSum: 0,
					compositeSum: 0,
					postCount: 0,
				};
			}
			const stat = creatorStats[p.creator_id];
			stat.likeCount += likesByPost[p.id] || 0;
			stat.qualitySum += Number(p.quality_score || 0);
			stat.moderationSum += Number(p.moderation_score || 1);
			stat.compositeSum += Number(p.composite_score || 0);
			stat.postCount += 1;
		}

		const ranked = Object.entries(creatorStats)
			.map(([creator_id, stat]) => {
				const avgQuality =
					stat.postCount > 0 ? stat.qualitySum / stat.postCount : 0;
				const avgModeration =
					stat.postCount > 0 ? stat.moderationSum / stat.postCount : 1;
				const avgComposite =
					stat.postCount > 0 ? stat.compositeSum / stat.postCount : 0;
				const rankingScore =
					stat.likeCount +
					avgComposite * 20 +
					avgQuality * 5 +
					avgModeration * 5;
				return {
					creator_id,
					like_count: stat.likeCount,
					quality_score: round4(avgQuality),
					moderation_score: round4(avgModeration),
					composite_score: round4(rankingScore),
				};
			})
			.sort((a, b) => b.composite_score - a.composite_score)
			.map((row, i) => ({
				epoch_id,
				creator_id: row.creator_id,
				rank: i + 1,
				like_count: row.like_count,
				quality_score: row.quality_score,
				moderation_score: row.moderation_score,
				composite_score: row.composite_score,
				reward_amount: 0,
			}));

		const { data: epoch } = await supabase
			.from("epochs")
			.select("reward_pool")
			.eq("id", epoch_id)
			.single();
		const pool = Number(epoch?.reward_pool || 0);

		const shares = [0.5, 0.3, 0.2];
		for (let i = 0; i < ranked.length && i < shares.length; i++) {
			ranked[i].reward_amount = pool * shares[i];
		}

		if (ranked.length > 0) {
			await supabase.from("epoch_rewards").insert(ranked);
		}

		return new Response(JSON.stringify({ success: true, rankings: ranked }), {
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	} catch (e) {
		console.error("close-epoch error:", e);
		return new Response(
			JSON.stringify({
				error: e instanceof Error ? e.message : "Unknown error",
			}),
			{
				status: 400,
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			},
		);
	}
});
