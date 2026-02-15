import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { keccak256, toHex, toBytes } from "https://esm.sh/viem@2.21.0";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;
const VALID_TONES = ["default", "educational", "casual", "professional", "hype"];
const VALID_LENGTHS = ["short", "medium", "long"];

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...corsHeaders, "Content-Type": "application/json" },
	});
}

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, number[]>();
function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
	const now = Date.now();
	const timestamps = (rateLimitMap.get(key) || []).filter(t => now - t < windowMs);
	if (timestamps.length >= maxRequests) return false;
	timestamps.push(now);
	rateLimitMap.set(key, timestamps);
	return true;
}

Deno.serve(async (req: Request) => {
	if (req.method === "OPTIONS")
		return new Response(null, { headers: corsHeaders });

	try {
		const body = await req.json();
		const wallet_address = String(body.wallet_address || "").trim();
		const requestedTopic = body.topic ? String(body.topic).trim().slice(0, 500) : undefined;
		const tone = body.tone ? String(body.tone).trim() : undefined;
		const length = body.length ? String(body.length).trim() : "medium";

		// --- Input validation ---
		if (!WALLET_RE.test(wallet_address)) {
			return json({ error: "Invalid wallet address format" }, 400);
		}
		if (tone && !VALID_TONES.includes(tone)) {
			return json({ error: `Invalid tone. Must be one of: ${VALID_TONES.join(", ")}` }, 400);
		}
		if (!VALID_LENGTHS.includes(length)) {
			return json({ error: `Invalid length. Must be one of: ${VALID_LENGTHS.join(", ")}` }, 400);
		}
		if (requestedTopic && requestedTopic.length > 500) {
			return json({ error: "Topic must be under 500 characters" }, 400);
		}

		// Rate limit: 5 posts per minute per wallet
		if (!rateLimit(`generate-post:${wallet_address.toLowerCase()}`, 5, 60_000)) {
			return json({ error: "Rate limit exceeded. Try again later." }, 429);
		}

		const supabase = createClient(
			Deno.env.get("SUPABASE_URL")!,
			Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
		);

		// Get the creator
		const { data: creator, error: creatorErr } = await supabase
			.from("creators")
			.select("*")
			.ilike("wallet_address", wallet_address)
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

		// Resolve topic
		const defaultTopics = [
			"BNB Chain ecosystem growth and developer adoption",
			"DeFi innovations on BNB Smart Chain",
			"BNB Greenfield decentralized storage",
			"Cross-chain interoperability with BNB Chain",
			"NFT and gaming ecosystem on BNB Chain",
			"BNB Chain security and audit best practices",
			"BNB Chain governance and community proposals",
		];
		const topic = requestedTopic || defaultTopics[Math.floor(Math.random() * defaultTopics.length)];

		// Build word-count guidance
		const lengthGuide = length === "short" ? "80-150" : length === "long" ? "300-500" : "150-300";

		// Build tone instruction
		const toneInstruction = tone && tone !== "default"
			? ` Adopt a ${tone} tone throughout.`
			: "";

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
							content: `You are an AI content creator clone with this persona: ${creatorData.persona_text}. Generate engaging, informative content about the BNB ecosystem. Write ${lengthGuide} words.${toneInstruction} Do not include any markdown formatting.`,
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

		// Compute hashes
		const postId = crypto.randomUUID();
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

		return json({ success: true, post_id: postId });
	} catch (e) {
		console.error("generate-post error:", e);
		return json({ error: e instanceof Error ? e.message : "Unknown error" }, 400);
	}
});
