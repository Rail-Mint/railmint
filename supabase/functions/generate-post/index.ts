import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { keccak256, toHex, toBytes } from "https://esm.sh/viem@2.21.0";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
	if (req.method === "OPTIONS")
		return new Response(null, { headers: corsHeaders });

	try {
		const { wallet_address } = await req.json();
		if (!wallet_address) throw new Error("wallet_address is required");

		const supabase = createClient(
			Deno.env.get("SUPABASE_URL")!,
			Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
		);

		// Get the creator
		const { data: creator, error: creatorErr } = await supabase
			.from("creators")
			.select("*")
			.eq("wallet_address", wallet_address)
			.single();

		if (creatorErr || !creator)
			throw new Error("Creator not found. Create a clone first.");

		const creatorData = creator as any;

		// Get current open epoch
		const { data: epoch } = await supabase
			.from("epochs")
			.select("*")
			.eq("status", "open")
			.order("id", { ascending: false })
			.limit(1)
			.single();

		if (!epoch) throw new Error("No open epoch found.");
		const epochData = epoch as any;

		// BNB topic seeds
		const topics = [
			"BNB Chain ecosystem growth and developer adoption",
			"opBNB Layer 2 scaling and transaction throughput",
			"BNB Greenfield decentralized storage",
			"DeFi innovations on BNB Smart Chain",
			"BNB Chain governance and community proposals",
			"Cross-chain interoperability with BNB Chain",
			"NFT and gaming ecosystem on BNB Chain",
			"BNB Chain security and audit best practices",
		];
		const topic = topics[Math.floor(Math.random() * topics.length)];
		const promptText = creatorData.prompt_template.replace("{{topic}}", topic);

		let contentText: string;
		let isFallback = false;
		const modelVersion = "google/gemini-2.5-flash";

		// Try AI generation via OpenRouter
		const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
		if (!OPENROUTER_API_KEY)
			throw new Error("OPENROUTER_API_KEY is not configured");
		try {
			const aiRes = await fetch(
				"https://openrouter.ai/api/v1/chat/completions",
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${OPENROUTER_API_KEY}`,
						"Content-Type": "application/json",
						"HTTP-Referer": Deno.env.get("SUPABASE_URL") || "",
						"X-Title": "RailMintAI",
					},
					body: JSON.stringify({
						model: modelVersion,
						messages: [
							{
								role: "system",
								content: `You are an AI content creator clone with this persona: ${creatorData.persona_text}. Generate engaging, informative content about the BNB ecosystem. Write 150-300 words. Do not include any markdown formatting.`,
							},
							{ role: "user", content: promptText },
						],
					}),
				},
			);

			if (!aiRes.ok) {
				console.error("AI error:", aiRes.status, await aiRes.text());
				throw new Error("AI generation failed");
			}

			const aiData = await aiRes.json();
			contentText = aiData.choices?.[0]?.message?.content || "";
			if (!contentText) throw new Error("Empty AI response");
		} catch (aiErr) {
			console.error("Falling back to template:", aiErr);
		isFallback = true;
			contentText = `[${creatorData.clone_name}] The BNB Chain ecosystem continues to evolve with exciting developments in ${topic}. As a growing network supporting thousands of dApps, BNB Chain remains a key player in the blockchain space. Developers and users alike are benefiting from low transaction fees, fast confirmation times, and a robust infrastructure. The community's commitment to innovation ensures BNB Chain stays at the forefront of Web3 adoption. Stay tuned for more updates as the ecosystem expands.`;
		}

		// Compute hashes using keccak256 (matching client-side verification in PostDetail)
		const postId = crypto.randomUUID();

		// Use real newline characters (\n) — must match mock-contract.ts on the client
		const promptHash = keccak256(
			toBytes("GOODVIBES_PROMPT_V1\n" + postId + "\n" + creatorData.id + "\n" + promptText),
		);
		const contentHash = keccak256(
			toBytes("GOODVIBES_CONTENT_V1\n" + postId + "\n" + contentText),
		);
		const createdAt = new Date().toISOString();
		const metaHash = keccak256(
			toBytes("GOODVIBES_META_V1\n" + modelVersion + "\n" + createdAt + "\n" + creatorData.wallet_address),
		);

		// Mock tx hash (also keccak256 for consistency)
		const commitTxHash = keccak256(
			toBytes("mock-commit-" + postId + "-" + Date.now()),
		);

		// Insert post
		const { error: insertErr } = await supabase.from("posts").insert({
			id: postId,
			creator_id: creatorData.id,
			epoch_id: epochData.id,
			prompt_text: promptText,
			content_text: contentText,
			prompt_hash: promptHash,
			content_hash: contentHash,
			meta_hash: metaHash,
			commit_tx_hash: commitTxHash,
			is_fallback: isFallback,
			created_at: createdAt,
		});

		if (insertErr) throw insertErr;

		return new Response(JSON.stringify({ success: true, post_id: postId }), {
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	} catch (e) {
		console.error("generate-post error:", e);
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
