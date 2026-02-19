import {
	getOptionalEnv,
	getRequiredEnv,
	getSupabaseUrl,
} from "../_shared/env.ts";
import {
	errorResponse,
	handlePreflight,
	jsonResponse,
} from "../_shared/http.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

type ProcessMentionResult = {
	success?: boolean;
	duplicate?: boolean;
	mention_db_id?: string;
	intent?: "publish" | "ask" | "donate" | "unknown";
	result?: Record<string, unknown>;
	payload?: Record<string, unknown>;
	error?: string;
};

type WebhookSupabaseClient = {
	from: (table: string) => {
		select: (columns: string) => {
			eq: (
				column: string,
				value: string,
			) => {
				maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
			};
		};
	};
};

function normalizeHandle(value?: string | null): string | null {
	if (!value) return null;
	const cleaned = value.trim().toLowerCase();
	if (!cleaned) return null;
	return cleaned.startsWith("@") ? cleaned : `@${cleaned}`;
}

function extractHandle(tweet: Record<string, unknown>): string | null {
	const directHandle =
		tweet.userName || tweet.username || tweet.screenName || tweet.screen_name;
	if (typeof directHandle === "string" && directHandle.trim().length > 0) {
		return normalizeHandle(directHandle);
	}

	const author = tweet.author || tweet.user || tweet.account;
	if (author && typeof author === "object") {
		const authorObj = author as Record<string, unknown>;
		const authorHandle =
			authorObj.userName ||
			authorObj.username ||
			authorObj.screenName ||
			authorObj.screen_name ||
			authorObj.handle;
		if (typeof authorHandle === "string" && authorHandle.trim().length > 0) {
			return normalizeHandle(authorHandle);
		}
	}

	return null;
}

function extractId(tweet: Record<string, unknown>): string | null {
	const value = tweet.id || tweet.tweetId || tweet.tweet_id;
	if (typeof value === "string" && value.trim().length > 0) return value.trim();
	if (typeof value === "number") return String(value);
	return null;
}

function extractText(tweet: Record<string, unknown>): string {
	const value = tweet.text || tweet.full_text || tweet.content;
	if (typeof value === "string") return value.trim();
	return "";
}

function extractTweetUrl(params: {
	mentionId?: string | null;
	authorHandle?: string | null;
	tweet?: Record<string, unknown>;
}): string | null {
	const directUrl =
		(params.tweet?.url as string | undefined) ||
		(params.tweet?.tweetUrl as string | undefined) ||
		(params.tweet?.tweet_url as string | undefined);
	if (typeof directUrl === "string" && directUrl.trim().length > 0) {
		return directUrl.trim();
	}
	if (params.mentionId && params.authorHandle) {
		const handle = params.authorHandle.replace(/^@/, "");
		return `https://x.com/${handle}/status/${params.mentionId}`;
	}
	return null;
}

function pickTweetCandidate(payload: unknown): Record<string, unknown> | null {
	if (!payload) return null;
	if (Array.isArray(payload)) {
		const candidate = payload[0];
		return candidate && typeof candidate === "object"
			? (candidate as Record<string, unknown>)
			: null;
	}
	if (typeof payload !== "object") return null;

	const obj = payload as Record<string, unknown>;
	const candidates: unknown[] = [
		obj.tweet,
		obj.data && (obj.data as Record<string, unknown>).tweet,
		obj.event && (obj.event as Record<string, unknown>).tweet,
		obj.tweets,
		obj.data && (obj.data as Record<string, unknown>).tweets,
		obj.data,
		obj,
	];

	for (const candidate of candidates) {
		if (!candidate) continue;
		if (Array.isArray(candidate)) {
			const first = candidate[0];
			if (first && typeof first === "object") {
				return first as Record<string, unknown>;
			}
			continue;
		}
		if (typeof candidate === "object") {
			const record = candidate as Record<string, unknown>;
			if (record.id || record.tweetId || record.tweet_id || record.text) {
				return record;
			}
		}
	}

	return null;
}

async function invokeProcessMention(params: {
	processMentionUrl: string;
	serviceRoleKey: string;
	payload: Record<string, unknown>;
}): Promise<ProcessMentionResult> {
	const response = await fetch(params.processMentionUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${params.serviceRoleKey}`,
			apikey: params.serviceRoleKey,
		},
		body: JSON.stringify(params.payload),
	});

	const body = (await response
		.json()
		.catch(() => ({}))) as ProcessMentionResult;
	if (!response.ok) {
		return {
			success: false,
			error:
				body.error || `process-mention failed with status ${response.status}`,
		};
	}

	return body;
}

Deno.serve(async (req: Request) => {
	const preflight = handlePreflight(req);
	if (preflight) return preflight;

	try {
		const token = getOptionalEnv("TWITTERAPI_WEBHOOK_TOKEN");
		if (!token)
			return errorResponse("Webhook authentication not configured", 500);

		const headerToken = req.headers.get("x-webhook-token")?.trim() ?? "";
		const authHeader = req.headers.get("authorization")?.trim() ?? "";
		const authToken = authHeader.replace(/^Bearer\s+/i, "").trim();

		// Constant-time comparison to prevent timing attacks
		function constantTimeEqual(a: string, b: string): boolean {
			if (a.length !== b.length) return false;
			let result = 0;
			for (let i = 0; i < a.length; i++) {
				result |= a.charCodeAt(i) ^ b.charCodeAt(i);
			}
			return result === 0;
		}

		if (
			!constantTimeEqual(token, headerToken) &&
			!constantTimeEqual(token, authToken)
		) {
			return errorResponse("Unauthorized webhook", 401);
		}

		const rawBody = await req.text();
		const payload = rawBody ? JSON.parse(rawBody) : {};
		const tweet = pickTweetCandidate(payload);
		const mentionId = tweet ? extractId(tweet) : null;
		const text = tweet ? extractText(tweet) : "";
		const authorHandle = tweet ? extractHandle(tweet) : null;
		const tweetUrl = extractTweetUrl({
			mentionId,
			authorHandle,
			tweet: tweet || undefined,
		});

		if (!mentionId || !text) {
			return jsonResponse(
				{
					error: "Unable to parse mention payload",
					extracted: {
						mention_id: mentionId,
						text,
						author_handle: authorHandle,
						tweet_url: tweetUrl,
					},
				},
				400,
			);
		}

		const supabaseUrl = getSupabaseUrl();
		const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
		const processMentionUrl =
			getOptionalEnv("PROCESS_MENTION_FUNCTION_URL") ||
			(supabaseUrl ? `${supabaseUrl}/functions/v1/process-mention` : null);

		if (!processMentionUrl) {
			throw new Error("Missing Supabase configuration for webhook handler");
		}

		const supabase = createServiceRoleClient() as WebhookSupabaseClient;
		const existing = await supabase
			.from("mentions")
			.select("id")
			.eq("mention_id", mentionId)
			.maybeSingle();
		const existingId = (existing.data as { id?: string } | null)?.id;

		if (existingId) {
			return jsonResponse({
				success: true,
				duplicate: true,
				mention_db_id: existingId,
			});
		}

		const processPayload: Record<string, unknown> = {
			mention_id: mentionId,
			text,
			author_handle: authorHandle,
			defer_processing: false,
			reply_with_ai: true,
			reply_to_id: mentionId,
			payload: {
				source: "twitterapi_webhook",
				raw_payload: payload,
				tweet_url: tweetUrl,
			},
		};

		const result = await invokeProcessMention({
			processMentionUrl,
			serviceRoleKey,
			payload: processPayload,
		});

		return jsonResponse(result);
	} catch (error) {
		return errorResponse(
			error instanceof Error ? error.message : "Unknown error",
			400,
		);
	}
});
