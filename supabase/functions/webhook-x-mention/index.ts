import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type, x-webhook-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ProcessMentionResult = {
	success?: boolean;
	duplicate?: boolean;
	mention_db_id?: string;
	intent?: "publish" | "ask" | "donate" | "unknown";
	result?: Record<string, unknown>;
	payload?: Record<string, unknown>;
	error?: string;
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
	if (req.method === "OPTIONS")
		return new Response(null, { headers: corsHeaders });

	try {
		const token = Deno.env.get("TWITTERAPI_WEBHOOK_TOKEN");
		if (token) {
			const headerToken = req.headers.get("x-webhook-token")?.trim();
			const authHeader = req.headers.get("authorization")?.trim();
			const authToken = authHeader?.replace(/^Bearer\s+/i, "")?.trim();
			if (token !== headerToken && token !== authToken) {
				return new Response(JSON.stringify({ error: "Unauthorized webhook" }), {
					status: 401,
					headers: {
						...corsHeaders,
						"Content-Type": "application/json",
					},
				});
			}
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
			return new Response(
				JSON.stringify({
					error: "Unable to parse mention payload",
					extracted: {
						mention_id: mentionId,
						text,
						author_handle: authorHandle,
						tweet_url: tweetUrl,
					},
				}),
				{
					status: 400,
					headers: {
						...corsHeaders,
						"Content-Type": "application/json",
					},
				},
			);
		}

		const supabaseUrl = Deno.env.get("SUPABASE_URL");
		const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
		const processMentionUrl =
			Deno.env.get("PROCESS_MENTION_FUNCTION_URL") ||
			(supabaseUrl ? `${supabaseUrl}/functions/v1/process-mention` : null);

		if (!supabaseUrl || !serviceRoleKey || !processMentionUrl) {
			throw new Error("Missing Supabase configuration for webhook handler");
		}

		const supabase = createClient(supabaseUrl, serviceRoleKey);
		const existing = await supabase
			.from("mentions")
			.select("id")
			.eq("mention_id", mentionId)
			.maybeSingle();

		if (existing.data) {
			return new Response(
				JSON.stringify({
					success: true,
					duplicate: true,
					mention_db_id: existing.data.id,
				}),
				{ headers: { ...corsHeaders, "Content-Type": "application/json" } },
			);
		}

		const processPayload: Record<string, unknown> = {
			mention_id: mentionId,
			text,
			author_handle: authorHandle,
			defer_processing: false,
			reply_with_ai: true,
			reply_via_twitterapi: true,
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

		return new Response(JSON.stringify(result), {
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	} catch (error) {
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
