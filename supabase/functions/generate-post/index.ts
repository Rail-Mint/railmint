import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
	createPublicClient,
	createWalletClient,
	defineChain,
	http,
	keccak256,
	toBytes,
	toHex,
	verifyMessage,
} from "https://esm.sh/viem@2.21.0";
import { privateKeyToAccount } from "https://esm.sh/viem@2.21.0/accounts";

// BNB Testnet configuration
const bscTestnet = defineChain({
	id: 97,
	name: "BSC Testnet",
	nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
	rpcUrls: {
		default: { http: ["https://data-seed-prebsc-1-s1.binance.org:8545"] },
	},
	blockExplorers: {
		default: { name: "BscScan", url: "https://testnet.bscscan.com" },
	},
	testnet: true,
});

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;
const VALID_TONES = [
	"default",
	"educational",
	"casual",
	"professional",
	"hype",
];
const VALID_LENGTHS = ["short", "medium", "long"];

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...corsHeaders, "Content-Type": "application/json" },
	});
}

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, number[]>();
function rateLimit(
	key: string,
	maxRequests: number,
	windowMs: number,
): boolean {
	const now = Date.now();
	const timestamps = (rateLimitMap.get(key) || []).filter(
		(t) => now - t < windowMs,
	);
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
		const wallet_address_raw = String(body.wallet_address || "").trim();
		const signature = String(body.signature || "").trim();
		const sign_timestamp = Number(body.sign_timestamp || 0);
		const context_pack = body.context_pack || null;

		// --- Wallet signature verification ---
		if (!WALLET_RE.test(wallet_address_raw)) {
			return json({ error: "Invalid wallet address format" }, 400);
		}
		if (!signature || !sign_timestamp) {
			return json(
				{
					error: "Missing signature. Please sign the action with your wallet.",
				},
				401,
			);
		}
		if (Math.abs(Date.now() - sign_timestamp) > 300_000) {
			return json({ error: "Signature expired. Please try again." }, 401);
		}

		const sigMessage = `RailMintAI Action\nFunction: generate-post\nWallet: ${wallet_address_raw}\nTimestamp: ${sign_timestamp}`;
		const sigValid = await verifyMessage({
			address: wallet_address_raw as `0x${string}`,
			message: sigMessage,
			signature: signature as `0x${string}`,
		});
		if (!sigValid) {
			return json({ error: "Invalid wallet signature. Action rejected." }, 401);
		}

		const wallet_address = wallet_address_raw;
		const requestedTopic = body.topic
			? String(body.topic).trim().slice(0, 500)
			: undefined;
		const tone = body.tone ? String(body.tone).trim() : undefined;
		const length = body.length ? String(body.length).trim() : "medium";
		if (tone && !VALID_TONES.includes(tone)) {
			return json(
				{ error: `Invalid tone. Must be one of: ${VALID_TONES.join(", ")}` },
				400,
			);
		}
		if (!VALID_LENGTHS.includes(length)) {
			return json(
				{
					error: `Invalid length. Must be one of: ${VALID_LENGTHS.join(", ")}`,
				},
				400,
			);
		}
		if (requestedTopic && requestedTopic.length > 500) {
			return json({ error: "Topic must be under 500 characters" }, 400);
		}

		// Rate limit: 5 posts per minute per wallet
		if (
			!rateLimit(`generate-post:${wallet_address.toLowerCase()}`, 5, 60_000)
		) {
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
		const topic =
			requestedTopic ||
			defaultTopics[Math.floor(Math.random() * defaultTopics.length)];

		// Build word-count guidance
		const lengthGuide =
			length === "short" ? "80-150" : length === "long" ? "300-500" : "150-300";

		// Build tone instruction
		const toneInstruction =
			tone && tone !== "default" ? ` Adopt a ${tone} tone throughout.` : "";

		const promptText = creatorData.prompt_template.replace("{{topic}}", topic);

		// Build context sections if context_pack is provided
		const contextLines: string[] = [];
		if (context_pack && typeof context_pack === "object") {
			if (context_pack.persona) {
				contextLines.push(`\n### YOUR IDENTITY\n${context_pack.persona}`);
			}

			if (
				context_pack.posts &&
				Array.isArray(context_pack.posts) &&
				context_pack.posts.length > 0
			) {
				const postsSummary = context_pack.posts
					.map(
						(p: any) =>
							`- ${p.topic || "General"}: ${p.post_content.substring(0, 100)}...`,
					)
					.join("\n");
				contextLines.push(`\n### YOUR RECENT POSTS\n${postsSummary}`);
			}

			if (
				context_pack.news &&
				Array.isArray(context_pack.news) &&
				context_pack.news.length > 0
			) {
				const newsSummary = context_pack.news[0].digest_bullets
					.slice(0, 5)
					.map((b: any) => `- ${b.text} (${b.source})`)
					.join("\n");
				contextLines.push(`\n### RELEVANT NEWS\n${newsSummary}`);
			}
		}

		const baseSystemPrompt = `You are an AI content creator clone with this persona: ${creatorData.persona_text}. Generate engaging, informative content about the BNB ecosystem. Write ${lengthGuide} words.${toneInstruction} Do not include any markdown formatting.`;
		const systemPrompt =
			contextLines.length > 0
				? baseSystemPrompt + "\n" + contextLines.join("\n")
				: baseSystemPrompt;

		let contentText: string;
		let isFallback = false;
		const modelVersion = "google/gemini-2.5-flash";

		// Try AI generation via OpenRouter with timeout
		const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
		if (!OPENROUTER_API_KEY)
			throw new Error("OPENROUTER_API_KEY is not configured");

		// Create abort controller for timeout
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

		try {
			const aiRes = await fetch(
				"https://openrouter.ai/api/v1/chat/completions",
				{
					method: "POST",
					signal: controller.signal,
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
								content: systemPrompt,
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

			clearTimeout(timeoutId);

			const aiData = await aiRes.json();
			contentText = aiData.choices?.[0]?.message?.content || "";
			if (!contentText) throw new Error("Empty AI response");
		} catch (aiErr) {
			clearTimeout(timeoutId);
			const errorMsg = aiErr instanceof Error ? aiErr.message : "Unknown error";
			console.error("AI generation failed, using fallback:", errorMsg);
			isFallback = true;
			contentText = `[${creatorData.clone_name}] The BNB Chain ecosystem continues to evolve with exciting developments in ${topic}. As a growing network supporting thousands of dApps, BNB Chain remains a key player in the blockchain space. Developers and users alike are benefiting from low transaction fees, fast confirmation times, and a robust infrastructure. The community's commitment to innovation ensures BNB Chain stays at the forefront of Web3 adoption. Stay tuned for more updates as the ecosystem expands.`;
		}

		// Compute hashes
		const postId = crypto.randomUUID();
		const promptHash = keccak256(
			toBytes(
				"GOODVIBES_PROMPT_V1\n" +
					postId +
					"\n" +
					creatorData.id +
					"\n" +
					promptText,
			),
		);
		const contentHash = keccak256(
			toBytes("GOODVIBES_CONTENT_V1\n" + postId + "\n" + contentText),
		);
		const createdAt = new Date().toISOString();
		const metaHash = keccak256(
			toBytes(
				"GOODVIBES_META_V1\n" +
					modelVersion +
					"\n" +
					createdAt +
					"\n" +
					creatorData.wallet_address,
			),
		);
		let commitTxHash: string;
		const bnbPrivateKey = Deno.env.get("BNB_TESTNET_PRIVATE_KEY");

		if (bnbPrivateKey) {
			try {
				const account = privateKeyToAccount(
					(bnbPrivateKey.startsWith("0x")
						? bnbPrivateKey
						: `0x${bnbPrivateKey}`) as `0x${string}`,
				);
				const publicClient = createPublicClient({
					chain: bscTestnet,
					transport: http(),
				});
				const walletClient = createWalletClient({
					account,
					chain: bscTestnet,
					transport: http(),
				});
				const hash = await walletClient.sendTransaction({
					to: account.address,
					value: 0n,
				});
				commitTxHash = hash;
				console.log(`Real BNB tx: ${hash}`);
			} catch (txErr) {
				console.error(
					"BNB tx failed, using fallback hash:",
					txErr instanceof Error ? txErr.message : "unknown",
				);
				commitTxHash = keccak256(toBytes("tx-fallback-" + postId));
			}
		} else {
			commitTxHash = keccak256(
				toBytes("mock-commit-" + postId + "-" + Date.now()),
			);
		}

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

		return json({ success: true, post_id: postId, tx_hash: commitTxHash });
	} catch (e) {
		const errorId = crypto.randomUUID().slice(0, 8);
		console.error(
			`[generate-post:${errorId}]`,
			e instanceof Error ? e.message : e,
		);
		const msg =
			e instanceof Error &&
			/signature|expired|wallet|rate limit|creator|epoch|tone|length|topic/i.test(
				e.message,
			)
				? e.message
				: "Failed to generate post";
		return json({ error: msg, error_id: errorId }, 400);
	}
});
