import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...corsHeaders, "Content-Type": "application/json" },
	});
}

function isServiceRole(req: Request): boolean {
	const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
	if (!serviceRoleKey) return false;
	const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")?.trim();
	const apikey = req.headers.get("apikey")?.trim();
	return auth === serviceRoleKey || apikey === serviceRoleKey;
}

Deno.serve(async (req: Request) => {
	if (req.method === "OPTIONS")
		return new Response(null, { headers: corsHeaders });

	try {
		const body = await req.json();
		const epoch_id = body.epoch_id;
		const wallet_address = String(body.wallet_address || "").trim();

		// --- Input validation ---
		if (!epoch_id || !Number.isFinite(Number(epoch_id)) || Number(epoch_id) < 1) {
			return json({ error: "Valid epoch_id is required" }, 400);
		}
		if (!WALLET_RE.test(wallet_address)) {
			return json({ error: "Invalid wallet address format" }, 400);
		}

		// --- Authorization: service role or admin check ---
		if (!isServiceRole(req)) {
			return json({ error: "Unauthorized: admin access required" }, 403);
		}

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

		// Get all posts for this epoch
		const { data: posts } = await supabase
			.from("posts")
			.select("id, creator_id")
			.eq("epoch_id", epoch_id);

		if (!posts || posts.length === 0) {
			return json({ success: true, message: "Epoch closed, no posts to rank" });
		}

		// Get likes for these posts
		const postIds = posts.map((p: any) => p.id);
		const { data: likes } = await supabase
			.from("likes")
			.select("post_id")
			.in("post_id", postIds);
		const likesArr = likes || [];

		// Count likes per post
		const likesByPost: Record<string, number> = {};
		for (const like of likesArr as any[]) {
			likesByPost[like.post_id] = (likesByPost[like.post_id] || 0) + 1;
		}

		// Aggregate likes per creator
		const creatorLikes: Record<string, number> = {};
		for (const p of posts as any[]) {
			if (!creatorLikes[p.creator_id]) creatorLikes[p.creator_id] = 0;
			creatorLikes[p.creator_id] += likesByPost[p.id] || 0;
		}

		// Rank by like count
		const ranked = Object.entries(creatorLikes)
			.map(([creator_id, like_count]) => ({ creator_id, like_count }))
			.sort((a, b) => b.like_count - a.like_count)
			.map((row, i) => ({
				epoch_id,
				creator_id: row.creator_id,
				rank: i + 1,
				like_count: row.like_count,
				reward_amount: 0,
			}));

		// Get reward pool
		const { data: epoch } = await supabase
			.from("epochs")
			.select("reward_pool")
			.eq("id", epoch_id)
			.single();
		const pool = Number((epoch as any)?.reward_pool || 0);

		// Distribute rewards: top 3 get 50/30/20
		const shares = [0.5, 0.3, 0.2];
		for (let i = 0; i < ranked.length && i < shares.length; i++) {
			ranked[i].reward_amount = pool * shares[i];
		}

		if (ranked.length > 0) {
			await supabase.from("epoch_rewards").insert(ranked);
		}

		return json({ success: true, rankings: ranked });
	} catch (e) {
		console.error("close-epoch error:", e);
		return json({ error: e instanceof Error ? e.message : "Unknown error" }, 400);
	}
});
