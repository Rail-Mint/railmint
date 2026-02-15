import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
	isAddress,
	JsonRpcProvider,
	parseEther,
	Wallet,
} from "https://esm.sh/ethers@6.13.4";
import { keccak256, toBytes } from "https://esm.sh/viem@2.21.0";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type, x-signature, x-timestamp, x-nonce, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
	if (!secret) return;

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

async function fetchCreatorByHandle(
	supabase: any,
	xHandle?: string | null,
) {
	const normalizedHandle = normalizeHandle(xHandle);
	if (!normalizedHandle) return null;
	const { data } = await supabase
		.from("creators")
		.select("id, wallet_address, x_handle, clone_name")
		.eq("x_handle", normalizedHandle)
		.maybeSingle();
	return data;
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
		toBytes("GOODVIBES_PROMPT_V1\n" + postId + "\n" + params.creatorId + "\n" + promptText),
	);
	const contentHash = keccak256(
		toBytes("GOODVIBES_CONTENT_V1\n" + postId + "\n" + params.contentText),
	);
	const metaHash = keccak256(
		toBytes("GOODVIBES_META_V1\nmention-publish\n" + createdAt + "\n" + params.creatorWallet),
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

async function buildAskResponse(
	supabase: any,
	question: string,
) {
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
		const authorHandle = normalizeHandle(body.author_handle);
		const authorWallet = body.author_wallet
			? String(body.author_wallet).trim()
			: null;

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
		const openEpoch = await fetchOpenEpoch(supabase) as any;
		const actionPayload: Record<string, unknown> = {};

		if (parsed.intent === "publish") {
			if (!openEpoch) throw new Error("No open epoch found");

			const creatorFromAuthor = await fetchCreatorByHandle(
				supabase,
				processingAuthorHandle,
			);
			const creatorFromPayload = await fetchCreatorByHandle(
				supabase,
				body.payload?.creator_handle || body.creator_handle,
			);
			const creator = (creatorFromAuthor || creatorFromPayload) as any;

			if (!creator) {
				throw new Error("Creator not found for publish command");
			}

		const publishContent = parsed.publishContent || processingText;
		if (publishContent.length > 5000) {
			throw new Error("Content exceeds maximum length of 5000 characters");
		}
			const { postId, analysis } = await createPostFromMention({
				supabase,
				creatorId: creator.id,
				creatorWallet: creator.wallet_address,
				epochId: openEpoch.id,
				contentText: publishContent,
				sourceReference: mentionId,
			});

			actionPayload.post_id = postId;
			actionPayload.creator_id = creator.id;
			actionPayload.quality = analysis;
		} else if (parsed.intent === "donate") {
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

			const recipientCreator = await fetchCreatorByHandle(
				supabase,
				parsed.donationTargetHandle,
			) as any;
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
		} else if (parsed.intent === "ask") {
			const question = parsed.questionText || processingText;
			const response = await buildAskResponse(supabase, question);
			actionPayload.question = question;
			actionPayload.response = response;
		}

		await supabase
			.from("mentions")
			.update({
				status: parsed.intent === "unknown" ? "ignored" : "processed",
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
		console.error("process-mention error:", error instanceof Error ? error.message : "unknown");

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
