import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
	isAddress,
	JsonRpcProvider,
	parseEther,
	Wallet,
} from "https://esm.sh/ethers@6.13.4";
import { keccak256, toBytes } from "https://esm.sh/viem@2.21.0";
import { z } from "https://esm.sh/zod@4.3.6";
import type {
	InputGuardrail,
	OutputGuardrail,
} from "npm:@openai/agents@0.4.11";
import {
	Agent,
	extractAllTextOutput,
	OpenAIChatCompletionsModel,
	run,
	setTracingDisabled,
	tool,
} from "npm:@openai/agents@0.4.11";
import type { ModelProvider } from "npm:@openai/agents-core@0.4.11";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type, x-signature, x-timestamp, x-nonce, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UNVERIFIED_USER_PROMPT =
	"To publish and earn rewards, create your persona at railmint.app and verify your account. Quick setup, big potential!";

type MentionIntent = "publish" | "ask" | "donate" | "unknown";

type ParsedMention = {
	intent: MentionIntent;
	publishContent?: string;
	questionText?: string;
	donationAmount?: number;
	donationTargetHandle?: string;
};

type ContentAnalysis = {
	qualityScore: number;
	moderationScore: number;
	engagementScore: number;
	compositeScore: number;
	riskLevel: "low" | "medium" | "high";
	qualityFlags: string[];
	contentTags: string[];
};

type ReplyTarget = {
	replyToId: string;
	authorHandle?: string | null;
	mentionText: string;
	intent: MentionIntent;
	mentionUrl?: string | null;
	contextSummary?: string | null;
};

type OpenRouterMessage = {
	role: "system" | "user" | "assistant" | "tool";
	content?: string | null;
	name?: string;
	tool_call_id?: string;
	tool_calls?: unknown;
};

type OpenRouterChatRequest = {
	model: string;
	messages: OpenRouterMessage[];
	tools?: unknown;
	tool_choice?: unknown;
	response_format?: unknown;
	temperature?: number;
	max_tokens?: number;
	stop?: string[];
};

type OpenRouterChatResponse = {
	choices: Array<{
		index?: number;
		message: {
			role: string;
			content?: string | null;
			tool_calls?: unknown;
		};
		finish_reason?: string | null;
	}>;
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		total_tokens?: number;
	};
};

function normalizeHandle(value?: string | null): string | null {
	if (!value) return null;
	const cleaned = value.trim().toLowerCase();
	if (!cleaned) return null;
	return cleaned.startsWith("@") ? cleaned : `@${cleaned}`;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function round4(value: number): number {
	return Math.round(value * 10000) / 10000;
}

function analyzeContent(content: string): ContentAnalysis {
	const normalized = content.toLowerCase();
	const words = normalized.split(/\s+/).filter(Boolean).length;
	const sentenceCount = content
		.split(/[.!?]+/)
		.filter((line) => line.trim().length > 0).length;
	const qualityFlags: string[] = [];
	const tags = new Set<string>();

	if (/\bdefi\b|dex|yield|lending|liquidity/.test(normalized)) tags.add("defi");
	if (/\bopbnb\b|layer\s?2|rollup/.test(normalized)) tags.add("opbnb");
	if (/\bgreenfield\b|storage/.test(normalized)) tags.add("greenfield");
	if (/\bnft\b|gamefi|gaming/.test(normalized)) tags.add("nft-gaming");
	if (/\bsecurity\b|audit|exploit|vulnerability|phishing/.test(normalized))
		tags.add("security");
	if (/\bgovernance\b|proposal|validator/.test(normalized))
		tags.add("governance");

	let moderationScore = 1;
	if (
		/guaranteed\s+profit|double\s+your|risk-?free\s+returns/.test(normalized)
	) {
		moderationScore -= 0.35;
		qualityFlags.push("hype_financial_claims");
	}
	if (
		/send\s+.*\s+to\s+this\s+address|seed\s+phrase|private\s+key/.test(
			normalized,
		)
	) {
		moderationScore -= 0.45;
		qualityFlags.push("sensitive_wallet_phrasing");
	}
	if (/scam|rug\s?pull|phish/.test(normalized)) {
		moderationScore -= 0.15;
		qualityFlags.push("risk_keywords");
	}

	let qualityScore = 0.4;
	qualityScore += clamp(words / 300, 0, 0.25);
	qualityScore += sentenceCount >= 3 ? 0.12 : 0;
	qualityScore += /\d/.test(content) ? 0.08 : 0;
	qualityScore += tags.size > 0 ? 0.12 : 0;
	qualityScore += /why|because|impact|trade-?off|risk|benefit/.test(normalized)
		? 0.08
		: 0;

	moderationScore = clamp(moderationScore, 0.1, 1);
	qualityScore = clamp(qualityScore, 0.1, 1);
	const engagementScore = 0;
	const compositeScore = qualityScore * moderationScore;

	const riskLevel: "low" | "medium" | "high" =
		moderationScore < 0.5 ? "high" : moderationScore < 0.75 ? "medium" : "low";

	return {
		qualityScore: round4(qualityScore),
		moderationScore: round4(moderationScore),
		engagementScore,
		compositeScore: round4(compositeScore),
		riskLevel,
		qualityFlags,
		contentTags: Array.from(tags),
	};
}

function limitReplyText(text: string): string {
	const normalized = text.trim();
	if (normalized.length <= 275) return normalized;
	return `${normalized.slice(0, 272)}...`;
}

function parseMention(rawText: string): ParsedMention {
	const text = rawText.trim();
	const donateMatch = text.match(
		/donate\s+([0-9]+(?:\.[0-9]{1,8})?)\s*bnb\s+to\s+(@?[a-z0-9_]+)/i,
	);
	if (donateMatch) {
		return {
			intent: "donate",
			donationAmount: Number(donateMatch[1]),
			donationTargetHandle: normalizeHandle(donateMatch[2]) || undefined,
		};
	}

	const publishMatch = text.match(/publish\s*[:-]?\s+([\s\S]+)/i);
	if (publishMatch && publishMatch[1]) {
		return {
			intent: "publish",
			publishContent: publishMatch[1].trim(),
		};
	}

	const askMatch = text.match(/ask\s*[:-]?\s+([\s\S]+)/i);
	if (askMatch && askMatch[1]) {
		return {
			intent: "ask",
			questionText: askMatch[1].trim(),
		};
	}

	if (text.includes("?")) {
		return {
			intent: "ask",
			questionText: text,
		};
	}

	return { intent: "unknown" };
}

async function sha256Hex(input: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(input);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	return (
		"0x" +
		Array.from(new Uint8Array(hashBuffer))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("")
	);
}

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function constantTimeEqualHex(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return result === 0;
}

function isInternalServiceCall(req: Request): boolean {
	const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
	if (!serviceRoleKey) return false;

	const authorization = req.headers.get("authorization")?.trim();
	const apikey = req.headers.get("apikey")?.trim();
	const authToken = authorization?.replace(/^Bearer\s+/i, "")?.trim();

	return authToken === serviceRoleKey || apikey === serviceRoleKey;
}

async function verifyWebhookSignature(params: {
	req: Request;
	rawBody: string;
	supabase: any;
}) {
	const secret = Deno.env.get("X_WEBHOOK_SECRET");
	if (!secret) {
		throw new Error(
			"X_WEBHOOK_SECRET is not configured — webhook verification cannot proceed",
		);
	}

	const signature = params.req.headers.get("x-signature")?.trim();
	const timestamp = params.req.headers.get("x-timestamp")?.trim();
	const nonce = params.req.headers.get("x-nonce")?.trim();

	if (!signature || !timestamp || !nonce) {
		throw new Error("Missing webhook signature headers");
	}

	const tsMs = Number(timestamp);
	if (!Number.isFinite(tsMs)) {
		throw new Error("Invalid timestamp header");
	}

	const maxDriftMs = 5 * 60 * 1000;
	if (Math.abs(Date.now() - tsMs) > maxDriftMs) {
		throw new Error("Webhook timestamp expired");
	}

	const { data: existingNonce } = await params.supabase
		.from("webhook_nonces")
		.select("nonce")
		.eq("nonce", nonce)
		.maybeSingle();

	if (existingNonce) {
		throw new Error("Webhook replay detected");
	}

	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);

	const base = `${timestamp}.${nonce}.${params.rawBody}`;
	const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(base));
	const expectedSignature = toHex(new Uint8Array(digest));
	if (!constantTimeEqualHex(expectedSignature, signature.toLowerCase())) {
		throw new Error("Webhook signature mismatch");
	}

	const expiresAt = new Date(tsMs + maxDriftMs).toISOString();
	await params.supabase
		.from("webhook_nonces")
		.insert({ nonce, expires_at: expiresAt });
	await params.supabase
		.from("webhook_nonces")
		.delete()
		.lt("expires_at", new Date().toISOString());
}

async function fetchCreatorByHandle(supabase: any, xHandle?: string | null) {
	const normalizedHandle = normalizeHandle(xHandle);
	if (!normalizedHandle) return null;
	const { data } = await supabase
		.from("creators")
		.select("id, wallet_address, x_handle, clone_name")
		.eq("x_handle", normalizedHandle)
		.maybeSingle();
	return data;
}

async function lookupVerifiedCreator(
	supabase: any,
	authorHandle?: string | null,
) {
	const normalizedHandle = normalizeHandle(authorHandle);
	if (!normalizedHandle) {
		return { found: false, verified: false, creator: null };
	}

	const { data: creator } = await supabase
		.from("creators")
		.select(
			"id, x_handle, x_verified, persona_text, prompt_template, clone_name",
		)
		.eq("x_handle", normalizedHandle)
		.maybeSingle();

	return {
		found: !!creator,
		verified: creator?.x_verified === true,
		creator: creator || null,
	};
}

async function fetchOpenEpoch(supabase: any) {
	const { data } = await supabase
		.from("epochs")
		.select("id, reward_pool")
		.eq("status", "open")
		.order("id", { ascending: false })
		.limit(1)
		.maybeSingle();
	return data;
}

async function createPostFromMention(params: {
	supabase: any;
	creatorId: string;
	creatorWallet: string;
	epochId: number;
	contentText: string;
	sourceReference: string;
}) {
	const createdAt = new Date().toISOString();
	const postId = crypto.randomUUID();
	const promptText = `X mention publish command ${params.sourceReference}`;
	const promptHash = keccak256(
		toBytes(
			"GOODVIBES_PROMPT_V1\n" +
				postId +
				"\n" +
				params.creatorId +
				"\n" +
				promptText,
		),
	);
	const contentHash = keccak256(
		toBytes("GOODVIBES_CONTENT_V1\n" + postId + "\n" + params.contentText),
	);
	const metaHash = keccak256(
		toBytes(
			"GOODVIBES_META_V1\nmention-publish\n" +
				createdAt +
				"\n" +
				params.creatorWallet,
		),
	);
	const commitTxHash = keccak256(
		toBytes("mock-mention-commit-" + postId + "-" + Date.now()),
	);
	const analysis = analyzeContent(params.contentText);

	// Only insert columns that exist in the posts table schema
	const { error } = await params.supabase.from("posts").insert({
		id: postId,
		creator_id: params.creatorId,
		epoch_id: params.epochId,
		prompt_text: promptText,
		content_text: params.contentText,
		prompt_hash: promptHash,
		content_hash: contentHash,
		meta_hash: metaHash,
		commit_tx_hash: commitTxHash,
		is_fallback: false,
		created_at: createdAt,
	});

	if (error) throw error;
	return { postId, analysis };
}

async function executeDonationTransfer(
	recipientWallet: string,
	amount: number,
) {
	const signerPk = Deno.env.get("DONATION_SIGNER_PRIVATE_KEY");
	const rpcUrl = Deno.env.get("DONATION_RPC_URL");

	if (!isAddress(recipientWallet)) {
		throw new Error("Invalid recipient wallet address");
	}

	if (!signerPk || !rpcUrl) {
		const mockTx = await sha256Hex(
			`mock-donation-${recipientWallet}-${amount}-${Date.now()}`,
		);
		return { status: "simulated" as const, txHash: mockTx };
	}

	const provider = new JsonRpcProvider(rpcUrl);
	const wallet = new Wallet(signerPk, provider);
	const tx = await wallet.sendTransaction({
		to: recipientWallet,
		value: parseEther(amount.toString()),
	});

	return { status: "submitted" as const, txHash: tx.hash };
}

async function buildAskResponse(supabase: any, question: string) {
	const mentionedHandle = question.match(/@[a-z0-9_]+/i)?.[0];
	const creator = await fetchCreatorByHandle(supabase, mentionedHandle);

	if (!creator) {
		const { data: posts } = await supabase
			.from("posts")
			.select("content_text, created_at")
			.order("created_at", { ascending: false })
			.limit(2);
		if (!posts || posts.length === 0) {
			return "I could not find recent BNB creator posts yet.";
		}
		const digest = (posts as any[])
			.map(
				(p: any, index: number) =>
					`${index + 1}) ${String(p.content_text).slice(0, 140).trim()}...`,
			)
			.join(" ");
		return `Recent BNB content highlights: ${digest}`;
	}

	const { data: creatorPosts } = await supabase
		.from("posts")
		.select("content_text, created_at")
		.eq("creator_id", creator.id)
		.order("created_at", { ascending: false })
		.limit(2);

	if (!creatorPosts || creatorPosts.length === 0) {
		return `${creator.clone_name} has no published discovery posts yet.`;
	}

	const digest = (creatorPosts as any[])
		.map(
			(p: any, index: number) =>
				`${index + 1}) ${String(p.content_text).slice(0, 160).trim()}...`,
		)
		.join(" ");

	return `Latest from ${creator.clone_name}: ${digest}`;
}

async function buildAiReply(params: {
	target: ReplyTarget;
	ctaText?: string | null;
}) {
	const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
	if (!openRouterKey) {
		throw new Error("OPENROUTER_API_KEY is not configured");
	}

	const authorHandle = normalizeHandle(params.target.authorHandle) || "";
	const cta = params.ctaText ? params.ctaText.trim() : "";
	const safeCta = cta && !cta.startsWith(" ") ? ` ${cta}` : cta;

	const systemPrompt =
		"You are RailMint AI. Write a short, friendly reply in 1-2 sentences. " +
		"No hashtags, no emojis, no markdown. Keep the reply concise and helpful.";

	const contextLines = [
		`Mention text: ${params.target.mentionText}`,
		`Intent: ${params.target.intent}`,
		params.target.contextSummary
			? `Context: ${params.target.contextSummary}`
			: null,
		params.target.mentionUrl ? `Tweet URL: ${params.target.mentionUrl}` : null,
	].filter(Boolean);

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 20000);

	try {
		const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
			method: "POST",
			signal: controller.signal,
			headers: {
				Authorization: `Bearer ${openRouterKey}`,
				"Content-Type": "application/json",
				"HTTP-Referer": Deno.env.get("SUPABASE_URL") || "",
				"X-Title": "RailMintAI",
			},
			body: JSON.stringify({
				model: "google/gemini-2.5-flash",
				messages: [
					{ role: "system", content: systemPrompt },
					{ role: "user", content: contextLines.join("\n") },
				],
			}),
		});

		if (!aiRes.ok) {
			const errText = await aiRes.text();
			throw new Error(
				`OpenRouter error ${aiRes.status}: ${errText.slice(0, 200)}`,
			);
		}

		const aiData = await aiRes.json();
		const coreText =
			aiData.choices?.[0]?.message?.content?.toString().trim() || "";
		if (!coreText) throw new Error("Empty OpenRouter reply");

		const reply = `${authorHandle} ${coreText}`.trim() + safeCta;
		return limitReplyText(reply);
	} finally {
		clearTimeout(timeoutId);
	}
}

async function buildPersonalizedReply(params: {
	creator: {
		clone_name: string;
		persona_text: string | null;
		prompt_template: string | null;
	};
	mentionText: string;
	intentContext?: string | null;
}) {
	const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
	if (!openRouterKey) {
		throw new Error("OPENROUTER_API_KEY is not configured");
	}

	const systemPrompt =
		params.creator.prompt_template ||
		`You are ${params.creator.clone_name}. ${params.creator.persona_text || ""}`;

	const contextLines = [
		`Mention text: ${params.mentionText}`,
		params.intentContext ? `Context: ${params.intentContext}` : null,
	].filter(Boolean);

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 20000);

	try {
		const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
			method: "POST",
			signal: controller.signal,
			headers: {
				Authorization: `Bearer ${openRouterKey}`,
				"Content-Type": "application/json",
				"HTTP-Referer": Deno.env.get("SUPABASE_URL") || "",
				"X-Title": "RailMintAI",
			},
			body: JSON.stringify({
				model: "google/gemini-2.5-flash",
				messages: [
					{ role: "system", content: systemPrompt },
					{ role: "user", content: contextLines.join("\n") },
				],
			}),
		});

		if (!aiRes.ok) {
			const errText = await aiRes.text();
			throw new Error(
				`OpenRouter error ${aiRes.status}: ${errText.slice(0, 200)}`,
			);
		}

		const aiData = await aiRes.json();
		const coreText =
			aiData.choices?.[0]?.message?.content?.toString().trim() || "";
		if (!coreText) throw new Error("Empty OpenRouter reply");

		return limitReplyText(coreText);
	} finally {
		clearTimeout(timeoutId);
	}
}

async function replyViaUploadPost(params: { text: string; replyToId: string }) {
	const apiKey = Deno.env.get("UPLOAD_POST_API_KEY");
	const user = Deno.env.get("UPLOAD_POST_USER");

	if (!apiKey) throw new Error("Missing UPLOAD_POST_API_KEY");
	if (!user) throw new Error("Missing UPLOAD_POST_USER");

	const body = new URLSearchParams();
	body.set("user", user);
	body.set("platform[]", "x");
	body.set("title", limitReplyText(params.text));
	body.set("reply_to_id", params.replyToId);
	body.set("async_upload", "false");

	console.info("Upload-Post reply request", {
		user,
		reply_to_id: params.replyToId,
		text_length: params.text.length,
	});

	const response = await fetch("https://api.upload-post.com/api/upload_text", {
		method: "POST",
		headers: {
			Authorization: `Apikey ${apiKey}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: body.toString(),
	});

	const payload = await response.json().catch(() => ({}));
	if (!response.ok) {
		throw new Error(
			`Upload-Post reply failed: ${response.status} ${JSON.stringify(payload).slice(0, 200)}`,
		);
	}

	console.info("Upload-Post reply success", {
		status: response.status,
		response_keys:
			payload && typeof payload === "object"
				? Object.keys(payload as Record<string, unknown>)
				: [],
	});

	return payload as Record<string, unknown>;
}

setTracingDisabled(true);

function isAffirmative(text: string): boolean {
	const normalized = text.trim().toLowerCase();
	return /^(yes|yep|yeah|y|ok|sure|confirm|do it|go ahead|approved?|lgtm|publish it)\b/.test(
		normalized,
	);
}

/** Scope keywords — keeps the agent on railmint/BNB topics */
const SCOPE_RE =
	/\b(railmint|bnb|bsc|opbnb|greenfield|binance|defi|nft|web3|blockchain|creator|clone|post|publish|epoch|reward|donate|content|validator|dapp)\b/i;

/**
 * Build the OpenRouter-backed model provider lazily so env vars are read at
 * call time rather than module-init time.
 */
function getOpenRouterProvider(): ModelProvider {
	const apiKey = Deno.env.get("OPENROUTER_API_KEY");
	if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

	const client = {
		chat: {
			completions: {
				create: async (
					request: OpenRouterChatRequest,
				): Promise<OpenRouterChatResponse> => {
					const response = await fetch(
						"https://openrouter.ai/api/v1/chat/completions",
						{
							method: "POST",
							headers: {
								Authorization: `Bearer ${apiKey}`,
								"Content-Type": "application/json",
								"HTTP-Referer": Deno.env.get("SUPABASE_URL") || "",
								"X-Title": "RailMintAI",
							},
							body: JSON.stringify(request),
						},
					);

					if (!response.ok) {
						const errText = await response.text();
						throw new Error(
							`OpenRouter chat completion failed: ${response.status} ${errText.slice(0, 200)}`,
						);
					}

					return (await response.json()) as OpenRouterChatResponse;
				},
			},
		},
	};

	const typedClient = client as unknown as {
		chat: {
			completions: {
				create: (
					request: OpenRouterChatRequest,
				) => Promise<OpenRouterChatResponse>;
			};
		};
	};

	const provider: ModelProvider = {
		getModel: (modelName: string) =>
			new OpenAIChatCompletionsModel(typedClient, modelName),
	};

	return provider;
}

// --- Agent context type (passed via RunConfig.context) ---

type AgentContext = {
	supabase: ReturnType<typeof createClient>;
	mentionId: string;
	mentionDbId: string;
	authorHandle: string | null;
	authorWallet: string | null;
	replyToId: string | null;
	openEpoch: { id: number; reward_pool: number } | null;
};

// --- Agent tools ---

const generatePostTool = tool({
	name: "generate_post",
	description:
		"Generate a draft post about the BNB ecosystem for a creator. " +
		"Returns the draft text. Does NOT publish — the user must confirm first.",
	parameters: z.object({
		creator_handle: z
			.string()
			.describe("X handle of the creator (e.g. @alice)"),
		topic: z.string().describe("Topic or content direction for the post"),
	}),
	async execute(input, { context }) {
		const ctx = context as unknown as AgentContext;
		const handle = normalizeHandle(input.creator_handle);
		if (!handle) return "Error: invalid creator handle.";

		const { data: creator } = await ctx.supabase
			.from("creators")
			.select("id, clone_name, persona_text")
			.eq("x_handle", handle)
			.maybeSingle();

		if (!creator) return `Creator ${handle} not found on RailMint.`;

		const creatorData = creator as {
			id: string;
			clone_name: string;
			persona_text: string;
		};

		// Use OpenRouter to generate the draft
		const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
		if (!openRouterKey) return "Error: AI service not configured.";

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 20000);

		try {
			const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
				method: "POST",
				signal: controller.signal,
				headers: {
					Authorization: `Bearer ${openRouterKey}`,
					"Content-Type": "application/json",
					"HTTP-Referer": Deno.env.get("SUPABASE_URL") || "",
					"X-Title": "RailMintAI",
				},
				body: JSON.stringify({
					model: "google/gemini-2.5-flash",
					messages: [
						{
							role: "system",
							content:
								`You are an AI content creator clone with this persona: ${creatorData.persona_text}. ` +
								"Generate engaging, informative content about the BNB ecosystem. " +
								"Write 150-300 words. No markdown formatting.",
						},
						{ role: "user", content: input.topic },
					],
				}),
			});

			if (!res.ok) {
				const errText = await res.text();
				return `Error generating draft: ${errText.slice(0, 100)}`;
			}

			const data = await res.json();
			const draft =
				data.choices?.[0]?.message?.content?.toString().trim() || "";
			if (!draft) return "Error: empty AI response.";

			return JSON.stringify({
				draft_text: draft,
				creator_id: creatorData.id,
				creator_handle: handle,
				clone_name: creatorData.clone_name,
			});
		} finally {
			clearTimeout(timeoutId);
		}
	},
});

const publishPostTool = tool({
	name: "publish_post",
	description:
		"Publish a previously drafted post for a creator. " +
		"Only call this AFTER the user has confirmed (said yes) to a draft.",
	parameters: z.object({
		creator_id: z.string().describe("Creator UUID from generate_post result"),
		content_text: z.string().describe("The exact draft text to publish"),
	}),
	async execute(input, { context }) {
		const ctx = context as unknown as AgentContext;
		if (!ctx.openEpoch) return "Error: no open epoch found. Cannot publish.";

		const { data: creator } = await ctx.supabase
			.from("creators")
			.select("id, wallet_address")
			.eq("id", input.creator_id)
			.maybeSingle();

		if (!creator) return "Error: creator not found.";

		const creatorData = creator as { id: string; wallet_address: string };

		if (input.content_text.length > 5000) {
			return "Error: content exceeds 5000 character limit.";
		}

		const { postId, analysis } = await createPostFromMention({
			supabase: ctx.supabase,
			creatorId: creatorData.id,
			creatorWallet: creatorData.wallet_address,
			epochId: ctx.openEpoch.id,
			contentText: input.content_text,
			sourceReference: ctx.mentionId,
		});

		const postUrlBase =
			Deno.env.get("POST_URL_BASE") || "https://railmint.com/post";
		const postUrl = `${postUrlBase}/${postId}`;

		return JSON.stringify({
			post_id: postId,
			post_url: postUrl,
			quality: analysis,
		});
	},
});

const listPersonaTool = tool({
	name: "list_persona",
	description:
		"Look up a creator's persona / profile on RailMint by their X handle.",
	parameters: z.object({
		creator_handle: z
			.string()
			.describe("X handle of the creator (e.g. @alice)"),
	}),
	async execute(input, { context }) {
		const ctx = context as unknown as AgentContext;
		const handle = normalizeHandle(input.creator_handle);
		if (!handle) return "Error: invalid creator handle.";

		const { data: creator } = await ctx.supabase
			.from("creators")
			.select("id, clone_name, x_handle, persona_text")
			.eq("x_handle", handle)
			.maybeSingle();

		if (!creator) return `Creator ${handle} not found on RailMint.`;

		const creatorData = creator as {
			id: string;
			clone_name: string;
			x_handle: string;
			persona_text: string;
		};

		return JSON.stringify({
			clone_name: creatorData.clone_name,
			x_handle: creatorData.x_handle,
			persona_text: creatorData.persona_text,
		});
	},
});

// --- Guardrails ---

/**
 * Input guardrail: reject messages clearly outside railmint / BNB scope.
 * We use a lightweight heuristic rather than an extra LLM call so we don't
 * double the latency. Short messages (< 15 chars) or messages with scope
 * keywords pass through. Only clearly off-topic long messages are blocked.
 */
const scopeInputGuardrail: InputGuardrail = {
	name: "Scope Input Guardrail",
	async execute({ input }) {
		const text =
			typeof input === "string"
				? input
				: Array.isArray(input)
					? input
							.map((item) => {
								if (typeof item === "string") return item;
								if (
									item &&
									typeof item === "object" &&
									"content" in item &&
									typeof (item as Record<string, unknown>).content === "string"
								) {
									return (item as Record<string, unknown>).content as string;
								}
								return "";
							})
							.join(" ")
					: "";
		const isShort = text.length < 15;
		const hasScope = SCOPE_RE.test(text);
		// Allow short messages and messages with scope keywords
		const isOffTopic = !isShort && !hasScope;
		return {
			tripwireTriggered: isOffTopic,
			outputInfo: { isOffTopic, textLength: text.length },
		};
	},
};

/**
 * Output guardrail: ensure the agent's response stays within scope and
 * doesn't leak anything sensitive.
 */
const scopeOutputGuardrail: OutputGuardrail = {
	name: "Scope Output Guardrail",
	async execute({ agentOutput }) {
		const text = typeof agentOutput === "string" ? agentOutput : "";
		const leaksSensitive =
			/private.?key|seed.?phrase|secret|password|api.?key/i.test(text);
		return {
			tripwireTriggered: leaksSensitive,
			outputInfo: { leaksSensitive },
		};
	},
};

// --- Build the agent (lazily, once per cold start) ---

let _railmintAgent: Agent | null = null;

function getRailMintAgent(): Agent {
	if (_railmintAgent) return _railmintAgent;

	_railmintAgent = new Agent({
		name: "RailMint Agent",
		instructions:
			"You are RailMint AI, a helpful assistant for the RailMint platform " +
			"on the BNB Chain ecosystem.\n\n" +
			"RULES:\n" +
			"- You ONLY discuss RailMint, BNB Chain, DeFi, Web3, creators, posts, and related topics.\n" +
			"- For off-topic requests, politely decline and redirect to railmint.com.\n" +
			"- When asked to publish or create a post, ALWAYS use generate_post first to create a draft, " +
			"then ask the user to confirm before calling publish_post.\n" +
			"- When asked about a creator, use list_persona to look up their profile.\n" +
			"- Keep replies concise (1-3 sentences). No hashtags, no emojis, no markdown.\n" +
			"- If the request is ambiguous, ask a clarifying question.\n" +
			"- NEVER reveal API keys, secrets, or internal implementation details.",
		model: getOpenRouterProvider().getModel("google/gemini-2.5-flash"),
		tools: [generatePostTool, publishPostTool, listPersonaTool],
		inputGuardrails: [scopeInputGuardrail],
		outputGuardrails: [scopeOutputGuardrail],
	});
	return _railmintAgent;
}

// --- Confirmation loop helpers ---

type PendingAction = {
	pending_action: "confirm_publish";
	draft_text: string;
	creator_id: string;
	creator_handle: string;
	clone_name: string;
	conversation_id: string;
	author_handle: string;
};

/**
 * Look up a pending confirmation in the same thread (conversation_id).
 * We search for a processed mention from the same author that has a
 * pending_action stored in payload.
 */
async function findPendingConfirmation(params: {
	supabase: ReturnType<typeof createClient>;
	conversationId: string;
	authorHandle: string | null;
}): Promise<PendingAction | null> {
	if (!params.conversationId || !params.authorHandle) return null;

	const { data } = await params.supabase
		.from("mentions")
		.select("payload")
		.eq("payload->>conversation_id", params.conversationId)
		.eq("payload->>pending_action", "confirm_publish")
		.eq("author_handle", params.authorHandle)
		.order("created_at", { ascending: false })
		.limit(1)
		.maybeSingle();

	if (!data) return null;
	const payload = (data as { payload: Record<string, unknown> }).payload;
	if (
		payload &&
		typeof payload === "object" &&
		payload.pending_action === "confirm_publish" &&
		typeof payload.draft_text === "string" &&
		typeof payload.creator_id === "string"
	) {
		return payload as unknown as PendingAction;
	}
	return null;
}

/**
 * Run the RailMint agent for a mention. Handles the confirmation loop:
 *  1. If there's a pending draft and user says "yes" → publish
 *  2. Otherwise run the agent normally
 *
 * Returns { replyText, actionPayload } ready to be sent.
 */
async function runAgentForMention(params: {
	supabase: ReturnType<typeof createClient>;
	mentionId: string;
	mentionDbId: string;
	processingText: string;
	authorHandle: string | null;
	authorWallet: string | null;
	replyToId: string | null;
	conversationId: string;
	openEpoch: { id: number; reward_pool: number } | null;
}): Promise<{
	replyText: string;
	actionPayload: Record<string, unknown>;
}> {
	const cta = Deno.env.get("X_REPLY_CTA") || "";
	const safeCta = cta && !cta.startsWith(" ") ? ` ${cta}` : cta;
	const authorTag = params.authorHandle ? `${params.authorHandle} ` : "";
	const actionPayload: Record<string, unknown> = {};

	// --- Check for pending confirmation ---
	const pending = await findPendingConfirmation({
		supabase: params.supabase,
		conversationId: params.conversationId,
		authorHandle: params.authorHandle,
	});

	if (pending && isAffirmative(params.processingText)) {
		// User confirmed a pending draft → publish
		const ctx: AgentContext = {
			supabase: params.supabase,
			mentionId: params.mentionId,
			mentionDbId: params.mentionDbId,
			authorHandle: params.authorHandle,
			authorWallet: params.authorWallet,
			replyToId: params.replyToId,
			openEpoch: params.openEpoch,
		};

		if (!ctx.openEpoch) {
			const reply = `${authorTag}Sorry, no open epoch right now. Can't publish yet.${safeCta}`;
			return { replyText: limitReplyText(reply), actionPayload };
		}

		const { data: creator } = await params.supabase
			.from("creators")
			.select("id, wallet_address")
			.eq("id", pending.creator_id)
			.maybeSingle();

		if (!creator) {
			const reply = `${authorTag}Creator not found. The draft cannot be published.${safeCta}`;
			return { replyText: limitReplyText(reply), actionPayload };
		}

		const creatorData = creator as { id: string; wallet_address: string };

		const { postId, analysis } = await createPostFromMention({
			supabase: params.supabase,
			creatorId: creatorData.id,
			creatorWallet: creatorData.wallet_address,
			epochId: ctx.openEpoch.id,
			contentText: pending.draft_text,
			sourceReference: params.mentionId,
		});

		const postUrlBase =
			Deno.env.get("POST_URL_BASE") || "https://railmint.com/post";
		const postUrl = `${postUrlBase}/${postId}`;

		actionPayload.post_id = postId;
		actionPayload.post_url = postUrl;
		actionPayload.creator_id = creatorData.id;
		actionPayload.quality = analysis;
		actionPayload.published_from_draft = true;

		const reply = `${authorTag}Published! View your post: ${postUrl}${safeCta}`;
		return { replyText: limitReplyText(reply), actionPayload };
	}

	// --- Run the agent ---
	const agentCtx: AgentContext = {
		supabase: params.supabase,
		mentionId: params.mentionId,
		mentionDbId: params.mentionDbId,
		authorHandle: params.authorHandle,
		authorWallet: params.authorWallet,
		replyToId: params.replyToId,
		openEpoch: params.openEpoch,
	};

	let agentReply: string;
	try {
		const result = await run(getRailMintAgent(), params.processingText, {
			context: agentCtx as unknown as Record<string, unknown>,
			maxTurns: 4,
		});

		agentReply = extractAllTextOutput(result.newItems);
		if (!agentReply && result.finalOutput) {
			agentReply =
				typeof result.finalOutput === "string"
					? result.finalOutput
					: JSON.stringify(result.finalOutput);
		}
		if (!agentReply) agentReply = "I wasn't able to process that request.";

		// Check if the agent generated a draft (tool output contains draft_text)
		for (const item of result.newItems) {
			if (item.type !== "tool_call_output_item") continue;
			const outputStr = typeof item.output === "string" ? item.output : "";
			if (!outputStr.includes("draft_text")) continue;

			try {
				const parsed = JSON.parse(outputStr);
				if (parsed.draft_text && parsed.creator_id) {
					// Store pending action in payload for confirmation loop
					actionPayload.pending_action = "confirm_publish";
					actionPayload.draft_text = parsed.draft_text;
					actionPayload.creator_id = parsed.creator_id;
					actionPayload.creator_handle = parsed.creator_handle || "";
					actionPayload.clone_name = parsed.clone_name || "";
					actionPayload.conversation_id = params.conversationId;
					actionPayload.author_handle = params.authorHandle || "";

					// Override agent reply with a confirmation prompt
					const preview = String(parsed.draft_text).slice(0, 120).trim();
					agentReply =
						`Draft for ${parsed.clone_name || parsed.creator_handle}: ` +
						`"${preview}..." Reply YES to publish.`;
					break;
				}
			} catch {
				// Not JSON, skip
			}
		}

		// Check if agent called publish_post (it shouldn't without confirmation, but handle it)
		for (const item of result.newItems) {
			if (item.type !== "tool_call_output_item") continue;
			const outputStr = typeof item.output === "string" ? item.output : "";
			if (!outputStr.includes("post_id")) continue;

			try {
				const parsed = JSON.parse(outputStr);
				if (parsed.post_id && parsed.post_url) {
					actionPayload.post_id = parsed.post_id;
					actionPayload.post_url = parsed.post_url;
					actionPayload.quality = parsed.quality;
				}
			} catch {
				// Not JSON, skip
			}
		}
	} catch (guardrailErr) {
		// InputGuardrailTripwireTriggered or OutputGuardrailTripwireTriggered
		const errName =
			guardrailErr instanceof Error ? guardrailErr.constructor.name : "";
		if (errName.includes("Tripwire") || errName.includes("Guardrail")) {
			agentReply =
				"I can only help with RailMint and BNB Chain topics. " +
				"Visit railmint.com to learn more!";
			actionPayload.guardrail_triggered = true;
		} else {
			throw guardrailErr;
		}
	}

	const reply = `${authorTag}${agentReply}`.trim() + safeCta;
	return { replyText: limitReplyText(reply), actionPayload };
}

Deno.serve(async (req: Request) => {
	if (req.method === "OPTIONS")
		return new Response(null, { headers: corsHeaders });

	let mentionIdForFailure: string | null = null;

	try {
		const rawBody = await req.text();
		const body = JSON.parse(rawBody);
		const mentionId = String(body.mention_id || "").trim();
		mentionIdForFailure = mentionId || null;
		const rawText = String(body.text || "").trim();
		const deferProcessing = body.defer_processing === true;
		const processPending = body.process_pending === true;
		const replyWithAi = body.reply_with_ai === true;
		const replyToId = body.reply_to_id ? String(body.reply_to_id).trim() : null;
		const authorHandle = normalizeHandle(body.author_handle);
		const authorWallet = body.author_wallet
			? String(body.author_wallet).trim()
			: null;

		console.info("process-mention request", {
			mention_id: mentionId || null,
			text_length: rawText.length,
			defer_processing: deferProcessing,
			process_pending: processPending,
			reply_with_ai: replyWithAi,
			reply_to_id: replyToId,
			author_handle: authorHandle,
			has_author_wallet: Boolean(authorWallet),
			is_internal_call: isInternalServiceCall(req),
		});

		if (!mentionId) throw new Error("mention_id is required");
		if (!rawText && !processPending) throw new Error("text is required");

		const supabase = createClient(
			Deno.env.get("SUPABASE_URL")!,
			Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
		);

		if (!isInternalServiceCall(req)) {
			await verifyWebhookSignature({ req, rawBody, supabase });
		}

		const { data: existingMention } = await supabase
			.from("mentions")
			.select(
				"id, status, payload, raw_text, author_handle, author_wallet, parsed_intent, attempts",
			)
			.eq("mention_id", mentionId)
			.maybeSingle();

		let mentionDbId: string;
		let processingText = rawText;
		let processingAuthorHandle = authorHandle;
		let processingAuthorWallet = authorWallet;
		let basePayload = (body.payload ?? {}) as Record<string, unknown>;

		if (existingMention && processPending) {
			const existing = existingMention as any;
			if (existing.status !== "received") {
				return new Response(
					JSON.stringify({
						success: true,
						skipped: true,
						reason: `mention already in status ${existing.status}`,
						mention_db_id: existing.id,
					}),
					{ headers: { ...corsHeaders, "Content-Type": "application/json" } },
				);
			}

			const claimTime = new Date().toISOString();
			const { data: claimedMention } = await supabase
				.from("mentions")
				.update({
					status: "processing",
					attempts: Number(existing.attempts || 0) + 1,
					last_attempt_at: claimTime,
					error_text: null,
				})
				.eq("id", existing.id)
				.eq("status", "received")
				.select("id")
				.maybeSingle();

			if (!claimedMention) {
				return new Response(
					JSON.stringify({
						success: true,
						skipped: true,
						reason: "mention already claimed",
						mention_db_id: existing.id,
					}),
					{ headers: { ...corsHeaders, "Content-Type": "application/json" } },
				);
			}

			mentionDbId = existing.id;
			processingText = String(existing.raw_text || rawText || "").trim();
			if (!processingText) {
				throw new Error("queued mention has empty text");
			}
			processingAuthorHandle =
				normalizeHandle(existing.author_handle) || authorHandle;
			processingAuthorWallet = existing.author_wallet
				? String(existing.author_wallet)
				: authorWallet;
			basePayload = {
				...((existing.payload as Record<string, unknown>) || {}),
				...basePayload,
			};
		} else if (existingMention) {
			const existing = existingMention as any;
			return new Response(
				JSON.stringify({
					success: true,
					duplicate: true,
					mention_db_id: existing.id,
					status: existing.status,
					payload: existing.payload,
				}),
				{ headers: { ...corsHeaders, "Content-Type": "application/json" } },
			);
		} else {
			const parsedForInsert = parseMention(processingText);
			const insertStatus = deferProcessing ? "received" : "processing";
			const { data: mentionInsert, error: mentionInsertErr } = await supabase
				.from("mentions")
				.insert({
					mention_id: mentionId,
					platform: "x",
					author_handle: processingAuthorHandle,
					author_wallet: processingAuthorWallet,
					raw_text: processingText,
					parsed_intent: parsedForInsert.intent,
					status: insertStatus,
					payload: basePayload,
					attempts: deferProcessing ? 0 : 1,
					last_attempt_at: deferProcessing ? null : new Date().toISOString(),
				})
				.select("id")
				.single();

			if (mentionInsertErr || !mentionInsert) {
				throw mentionInsertErr || new Error("Failed to create mention row");
			}

			mentionDbId = (mentionInsert as any).id;

			if (deferProcessing) {
				return new Response(
					JSON.stringify({
						success: true,
						queued: true,
						mention_db_id: mentionDbId,
						intent: parsedForInsert.intent,
					}),
					{ headers: { ...corsHeaders, "Content-Type": "application/json" } },
				);
			}
		}

		const parsed = parseMention(processingText);

		// Early verification gate: Check if author is a verified creator
		const verificationResult = await lookupVerifiedCreator(
			supabase,
			processingAuthorHandle,
		);

		// If not verified, return UNVERIFIED_USER_PROMPT immediately
		if (!verificationResult.found || !verificationResult.verified) {
			// Create mention record in "processed" state with unverified response
			const { data: mentionInsert } = await supabase
				.from("mentions")
				.insert({
					mention_id: mentionId,
					status: "processed",
					raw_text: processingText,
					author_handle: processingAuthorHandle,
					author_wallet: processingAuthorWallet,
					parsed_intent: "unverified_prompt",
					payload: {
						...basePayload,
						intent: "unverified_prompt",
					},
					processed_at: new Date().toISOString(),
				})
				.select("id")
				.single();

			if (mentionInsert?.id) {
				mentionDbId = mentionInsert.id;
			}

			// Reply with verification prompt if applicable
			if (replyWithAi && replyViaTwitterApiFlag && replyToId) {
				try {
					const replyResult = await replyViaTweetApi({
						text: UNVERIFIED_USER_PROMPT,
						replyToId,
					});

					await supabase
						.from("mentions")
						.update({
							payload: {
								...basePayload,
								intent: "unverified_prompt",
								x_reply_text: UNVERIFIED_USER_PROMPT,
								x_reply_sent_at: new Date().toISOString(),
								x_reply_result: replyResult,
							},
						})
						.eq("id", mentionDbId);
				} catch (replyError) {
					const message =
						replyError instanceof Error
							? replyError.message
							: "Failed to reply to unverified user";
					await supabase
						.from("mentions")
						.update({
							payload: {
								...basePayload,
								intent: "unverified_prompt",
								x_reply_error: message,
							},
						})
						.eq("id", mentionDbId);
				}
			}

			return new Response(
				JSON.stringify({
					success: true,
					mention_db_id: mentionDbId,
					intent: "unverified_prompt",
					reason: "creator not verified",
				}),
				{ headers: { ...corsHeaders, "Content-Type": "application/json" } },
			);
		}

		// Verified path: Continue with intent handling
		const creator = verificationResult.creator;
		const openEpoch = (await fetchOpenEpoch(supabase)) as any;
		let actionPayload: Record<string, unknown> = {};
		let agentReplyText: string | null = null;

		if (parsed.intent === "donate") {
			if (!parsed.donationAmount || !parsed.donationTargetHandle) {
				throw new Error("Could not parse donation amount or recipient");
			}

			if (!processingAuthorWallet || !isAddress(processingAuthorWallet)) {
				throw new Error("Valid author_wallet is required for donation");
			}

			const maxDonation = Number(Deno.env.get("MAX_DONATION_BNB") || "5");
			if (parsed.donationAmount <= 0 || parsed.donationAmount > maxDonation) {
				throw new Error(
					`Donation amount must be between 0 and ${maxDonation} BNB`,
				);
			}

			const recipientCreator = (await fetchCreatorByHandle(
				supabase,
				parsed.donationTargetHandle,
			)) as any;
			if (!recipientCreator) {
				throw new Error("Recipient creator not found");
			}

			const donorWallet = processingAuthorWallet;
			const { data: donationRow, error: donationInsertErr } = await supabase
				.from("donations")
				.insert({
					mention_id: mentionDbId,
					donor_wallet: donorWallet,
					recipient_creator_id: recipientCreator.id,
					recipient_wallet: recipientCreator.wallet_address,
					amount: parsed.donationAmount,
					asset_symbol: "BNB",
					chain_id: 56,
					status: "pending",
				})
				.select("id")
				.single();

			if (donationInsertErr || !donationRow)
				throw donationInsertErr || new Error("Failed to create donation row");

			const donationData = donationRow as any;

			await supabase.from("donation_audit_log").insert({
				donation_id: donationData.id,
				event_type: "initiated",
				metadata: {
					mention_id: mentionId,
					author_handle: processingAuthorHandle,
					target_handle: parsed.donationTargetHandle,
					amount: parsed.donationAmount,
				},
			});

			let transfer: { status: "simulated" | "submitted"; txHash: string };
			try {
				transfer = await executeDonationTransfer(
					recipientCreator.wallet_address,
					parsed.donationAmount,
				);
			} catch (donationErr) {
				const failureMessage =
					donationErr instanceof Error
						? donationErr.message
						: "Donation transfer failed";
				await supabase
					.from("donations")
					.update({
						status: "failed",
						failure_reason: failureMessage,
					})
					.eq("id", donationData.id);
				await supabase.from("donation_audit_log").insert({
					donation_id: donationData.id,
					event_type: "failed",
					error_text: failureMessage,
					metadata: {
						recipient_wallet: recipientCreator.wallet_address,
						amount: parsed.donationAmount,
					},
				});
				throw donationErr;
			}

			const { error: donationUpdateErr } = await supabase
				.from("donations")
				.update({
					status: transfer.status,
					tx_hash: transfer.txHash,
					failure_reason: null,
				})
				.eq("id", donationData.id);

			if (donationUpdateErr) throw donationUpdateErr;

			await supabase.from("donation_audit_log").insert({
				donation_id: donationData.id,
				event_type: transfer.status === "simulated" ? "simulated" : "submitted",
				tx_hash: transfer.txHash,
				metadata: {
					recipient_wallet: recipientCreator.wallet_address,
					amount: parsed.donationAmount,
				},
			});

			if (openEpoch) {
				const nextPool =
					Number(openEpoch.reward_pool || 0) + parsed.donationAmount;
				await supabase
					.from("epochs")
					.update({ reward_pool: nextPool })
					.eq("id", openEpoch.id);
			}

			actionPayload.donation_id = donationData.id;
			actionPayload.tx_hash = transfer.txHash;
			actionPayload.recipient_creator_id = recipientCreator.id;
			actionPayload.recipient_wallet = recipientCreator.wallet_address;
			actionPayload.amount = parsed.donationAmount;
			actionPayload.status = transfer.status;
		} else {
			const conversationId = replyToId || mentionId;
			const agentResult = await runAgentForMention({
				supabase,
				mentionId,
				mentionDbId,
				processingText,
				authorHandle: processingAuthorHandle,
				authorWallet: processingAuthorWallet,
				replyToId,
				conversationId,
				openEpoch: openEpoch
					? {
							id: openEpoch.id,
							reward_pool: Number(openEpoch.reward_pool || 0),
						}
					: null,
			});
			agentReplyText = agentResult.replyText;
			actionPayload = { ...actionPayload, ...agentResult.actionPayload };
		}

		const agentHandle = normalizeHandle(Deno.env.get("X_AGENT_USERNAME"));
		const shouldReply =
			replyWithAi &&
			Boolean(replyToId) &&
			(!agentHandle || agentHandle !== processingAuthorHandle);

		console.info("process-mention reply decision", {
			mention_id: mentionIdForFailure,
			should_reply: shouldReply,
			reply_to_id: replyToId,
			agent_handle: agentHandle,
			author_handle: processingAuthorHandle,
		});

		if (shouldReply && replyToId) {
			try {
				let replyText: string;

				if (agentReplyText) {
					// Agent system reply takes precedence
					replyText = agentReplyText;
				} else {
					// Fallback to persona-based reply for verified creators
					const contextSummary =
						typeof actionPayload.response === "string"
							? actionPayload.response
							: null;

					replyText = await buildPersonalizedReply({
						creator: creator as {
							clone_name: string;
							persona_text: string | null;
							prompt_template: string | null;
						},
						mentionText: processingText,
						intentContext: contextSummary || undefined,
					});
				}

				console.info("process-mention reply generated", {
					mention_id: mentionIdForFailure,
					reply_length: replyText.length,
					agent_handled: Boolean(agentReplyText),
				});

				const replyResult = await replyViaUploadPost({
					text: replyText,
					replyToId,
				});

				actionPayload.x_reply_text = replyText;
				actionPayload.x_reply_sent_at = new Date().toISOString();
				actionPayload.x_reply_result = replyResult;
			} catch (replyError) {
				const message =
					replyError instanceof Error
						? replyError.message
						: "Failed to reply to mention";
				console.error("process-mention reply failed", {
					mention_id: mentionIdForFailure,
					error: message,
				});
				actionPayload.x_reply_error = message;
			}
		}

		await supabase
			.from("mentions")
			.update({
				status: "processed",
				payload: {
					...basePayload,
					intent: parsed.intent,
					...actionPayload,
				},
				processed_at: new Date().toISOString(),
			})
			.eq("id", mentionDbId);

		return new Response(
			JSON.stringify({
				success: true,
				mention_db_id: mentionDbId,
				intent: parsed.intent,
				result: actionPayload,
			}),
			{ headers: { ...corsHeaders, "Content-Type": "application/json" } },
		);
	} catch (error) {
		console.error(
			"process-mention error:",
			error instanceof Error ? error.message : "unknown",
		);

		try {
			if (mentionIdForFailure) {
				const supabase = createClient(
					Deno.env.get("SUPABASE_URL")!,
					Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
				);
				await supabase
					.from("mentions")
					.update({
						status: "failed",
						error_text:
							error instanceof Error ? error.message : "Unknown error",
						processed_at: new Date().toISOString(),
					})
					.eq("mention_id", mentionIdForFailure);
			}
		} catch (innerError) {
			console.error("Failed to mark mention as failed:", innerError);
		}

		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 400,
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			},
		);
	}
});
