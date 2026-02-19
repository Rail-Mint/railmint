import {
	getOptionalEnv,
	getOptionalIntEnv,
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

type SyncSupabaseClient = {
	from: (table: string) => {
		select: (columns: string) => {
			eq: (
				column: string,
				value: string,
			) => {
				maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
			};
		};
		update: (values: Record<string, unknown>) => {
			eq: (column: string, value: string) => Promise<{ error?: unknown }>;
		};
	};
};

type MentionRow = {
	id: string;
	payload: Record<string, unknown> | null;
	parsed_intent: string | null;
};

function extractHandle(tweet: Record<string, unknown>): string | null {
	const directHandle =
		tweet.userName || tweet.username || tweet.screenName || tweet.screen_name;
	if (typeof directHandle === "string" && directHandle.trim().length > 0) {
		const handle = directHandle.trim().toLowerCase();
		return handle.startsWith("@") ? handle : `@${handle}`;
	}

	const author = tweet.author;
	if (author && typeof author === "object") {
		const authorObj = author as Record<string, unknown>;
		const authorHandle =
			authorObj.userName ||
			authorObj.username ||
			authorObj.screenName ||
			authorObj.screen_name;
		if (typeof authorHandle === "string" && authorHandle.trim().length > 0) {
			const handle = authorHandle.trim().toLowerCase();
			return handle.startsWith("@") ? handle : `@${handle}`;
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

function limitReplyText(text: string): string {
	const normalized = text.trim();
	if (normalized.length <= 270) return normalized;
	return `${normalized.slice(0, 267)}...`;
}

async function fetchMentions(params: {
	apiBaseUrl: string;
	apiKey: string;
	userName: string;
	sinceTime?: number;
	untilTime?: number;
	cursor?: number;
}): Promise<Record<string, unknown>[]> {
	const url = new URL(`${params.apiBaseUrl}/twitter/user/mentions`);
	url.searchParams.set("userName", params.userName);
	if (typeof params.sinceTime === "number")
		url.searchParams.set("sinceTime", String(params.sinceTime));
	if (typeof params.untilTime === "number")
		url.searchParams.set("untilTime", String(params.untilTime));
	if (typeof params.cursor === "number")
		url.searchParams.set("cursor", String(params.cursor));

	const response = await fetch(url.toString(), {
		method: "GET",
		headers: {
			"X-API-Key": params.apiKey,
		},
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`Tweetio mentions fetch failed: ${response.status} ${errorText}`,
		);
	}

	const payload = await response.json();
	console.log("[sync-x-mentions] fetchMentions URL:", url.toString());
	console.log(
		"[sync-x-mentions] fetchMentions response status:",
		response.status,
	);
	console.log(
		"[sync-x-mentions] fetchMentions payload keys:",
		payload ? Object.keys(payload) : "null",
	);
	console.log(
		"[sync-x-mentions] fetchMentions payload.tweets?:",
		Array.isArray(payload?.tweets),
		"length:",
		payload?.tweets?.length,
	);
	console.log(
		"[sync-x-mentions] fetchMentions raw payload:",
		JSON.stringify(payload).slice(0, 500),
	);
	if (Array.isArray(payload)) return payload as Record<string, unknown>[];
	if (Array.isArray(payload?.tweets))
		return payload.tweets as Record<string, unknown>[];
	if (Array.isArray(payload?.data?.tweets))
		return payload.data.tweets as Record<string, unknown>[];
	console.log(
		"[sync-x-mentions] fetchMentions: no tweets found in payload, returning []",
	);
	return [];
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

async function postReplyToX(params: {
	uploadPostApiKey: string;
	uploadPostUser: string;
	uploadPostBaseUrl: string;
	replyToId: string;
	text: string;
}) {
	const body = new URLSearchParams();
	body.set("user", params.uploadPostUser);
	body.set("platform[]", "x");
	body.set("title", limitReplyText(params.text));
	body.set("reply_to_id", params.replyToId);
	body.set("async_upload", "false");

	const uploadTextUrl = new URL("upload_text", `${params.uploadPostBaseUrl}/`);

	const response = await fetch(uploadTextUrl, {
		method: "POST",
		headers: {
			Authorization: `Apikey ${params.uploadPostApiKey}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: body.toString(),
	});

	const payload = await response.json().catch(() => ({}));
	if (!response.ok) {
		throw new Error(`Upload-Post reply failed: ${response.status}`);
	}

	return payload;
}

async function runWithConcurrency<T, R>(
	items: T[],
	concurrency: number,
	worker: (item: T) => Promise<R>,
): Promise<R[]> {
	const limit = Math.max(1, concurrency);
	const results = new Array<R>(items.length);
	let cursor = 0;

	async function runWorker() {
		while (true) {
			const index = cursor;
			cursor += 1;
			if (index >= items.length) return;
			results[index] = await worker(items[index]);
		}
	}

	const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
		runWorker(),
	);
	await Promise.all(workers);
	return results;
}

async function triggerDrainWorker(params: {
	drainUrl: string;
	serviceRoleKey: string;
	maxItems?: number;
	concurrency?: number;
}) {
	const payload: Record<string, unknown> = {};
	if (typeof params.maxItems === "number") payload.max_items = params.maxItems;
	if (typeof params.concurrency === "number") {
		payload.concurrency = params.concurrency;
	}

	const response = await fetch(params.drainUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${params.serviceRoleKey}`,
			apikey: params.serviceRoleKey,
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`drain-mention-queue failed: ${response.status} ${text}`);
	}

	return response.json().catch(() => ({}));
}

Deno.serve(async (req: Request) => {
	const preflight = handlePreflight(req);
	if (preflight) return preflight;

	// Authenticate: require service_role key or a dedicated SYNC_API_KEY
	const authorization = req.headers.get("authorization")?.trim();
	const apikey = req.headers.get("apikey")?.trim();
	const serviceRoleKey = getOptionalEnv("SUPABASE_SERVICE_ROLE_KEY");
	const syncApiKey = getOptionalEnv("SYNC_API_KEY");
	const authToken = authorization?.replace(/^Bearer\s+/i, "")?.trim();

	const isServiceRole =
		serviceRoleKey &&
		(authToken === serviceRoleKey || apikey === serviceRoleKey);
	const isSyncKey =
		syncApiKey && (authToken === syncApiKey || apikey === syncApiKey);

	if (!isServiceRole && !isSyncKey) {
		return errorResponse("Unauthorized. Provide a valid API key.", 401);
	}

	try {
		const body = await req.json().catch(() => ({}));

		const tweetioApiKey = getRequiredEnv("TWEETIO_API_KEY");
		const tweetioBaseUrl = getRequiredEnv("TWEETIO_BASE_URL");
		const xAgentUserName = getRequiredEnv("X_AGENT_USERNAME");
		const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
		const supabaseUrl = getSupabaseUrl();
		const processMentionUrl =
			getOptionalEnv("PROCESS_MENTION_FUNCTION_URL") ||
			(supabaseUrl ? `${supabaseUrl}/functions/v1/process-mention` : null);
		const drainMentionQueueUrl =
			getOptionalEnv("DRAIN_MENTION_QUEUE_FUNCTION_URL") ||
			(supabaseUrl ? `${supabaseUrl}/functions/v1/drain-mention-queue` : null);
		if (!processMentionUrl)
			throw new Error("Missing process-mention URL configuration");

		const uploadPostApiKey = getOptionalEnv("UPLOAD_POST_API_KEY");
		const uploadPostUser = getOptionalEnv("UPLOAD_POST_USER");
		const uploadPostBaseUrl = getOptionalEnv("UPLOAD_POST_BASE_URL");
		const queueOnly =
			typeof body?.queueOnly === "boolean" ? body.queueOnly : false;
		const ingestConcurrency = Number(
			body?.ingestConcurrency ||
				getOptionalIntEnv("MENTION_INGEST_CONCURRENCY", 10) ||
				10,
		);
		const triggerDrain = body?.triggerDrain === true;
		const drainConcurrency = Number(
			body?.drainConcurrency ||
				getOptionalIntEnv("MENTION_DRAIN_CONCURRENCY", 10) ||
				10,
		);
		const drainMaxItems = Number(
			body?.drainMaxItems ||
				getOptionalIntEnv("MENTION_DRAIN_MAX_ITEMS", 100) ||
				100,
		);

		const supabase = createServiceRoleClient() as SyncSupabaseClient;

		const sinceTime =
			typeof body?.sinceTime === "number" ? body.sinceTime : undefined;
		const untilTime =
			typeof body?.untilTime === "number" ? body.untilTime : undefined;
		const cursor = typeof body?.cursor === "number" ? body.cursor : undefined;

		const mentions = await fetchMentions({
			apiBaseUrl: tweetioBaseUrl,
			apiKey: tweetioApiKey,
			userName: xAgentUserName,
			sinceTime,
			untilTime,
			cursor,
		});

		const errors: Array<{ mention_id: string; error: string }> = [];

		const outcomes = await runWithConcurrency(
			mentions,
			ingestConcurrency,
			async (tweet) => {
				const mentionId = extractId(tweet);
				const text = extractText(tweet);
				const authorHandle = extractHandle(tweet);

				if (!mentionId || !text) {
					return { processed: 0, duplicates: 0, failed: 0, replied: 0 };
				}

				const processPayload: Record<string, unknown> = {
					mention_id: mentionId,
					text,
					author_handle: authorHandle,
					defer_processing: queueOnly,
					reply_with_ai: !queueOnly,
					reply_to_id: mentionId,
					payload: {
						source: "tweetio",
						raw_tweet: tweet,
					},
				};

				const result = await invokeProcessMention({
					processMentionUrl,
					serviceRoleKey,
					payload: processPayload,
				});

				if (!result.success) {
					errors.push({
						mention_id: mentionId,
						error: result.error || "Unknown process error",
					});
					return { processed: 0, duplicates: 0, failed: 1, replied: 0 };
				}

				if (queueOnly) {
					return {
						processed: 1,
						duplicates: result.duplicate ? 1 : 0,
						failed: 0,
						replied: 0,
					};
				}

				const mentionDbId = result.mention_db_id;
				if (!mentionDbId) {
					return {
						processed: 1,
						duplicates: result.duplicate ? 1 : 0,
						failed: 0,
						replied: 0,
					};
				}

				const { data: mentionRow } = await supabase
					.from("mentions")
					.select("id, payload, parsed_intent")
					.eq("id", mentionDbId)
					.maybeSingle();

				if (!mentionRow) {
					return {
						processed: 1,
						duplicates: result.duplicate ? 1 : 0,
						failed: 0,
						replied: 0,
					};
				}

				const mentionData = mentionRow as MentionRow;
				const payload = mentionData.payload || {};
				const alreadyReplied = typeof payload.x_reply_sent_at === "string";
				const shouldReply = mentionData.parsed_intent === "ask";
				const replyText =
					typeof payload.response === "string"
						? payload.response
						: typeof result.result?.response === "string"
							? String(result.result.response)
							: null;

				if (
					!shouldReply ||
					alreadyReplied ||
					!replyText ||
					!uploadPostApiKey ||
					!uploadPostUser ||
					!uploadPostBaseUrl
				) {
					return {
						processed: 1,
						duplicates: result.duplicate ? 1 : 0,
						failed: 0,
						replied: 0,
					};
				}

				try {
					const replyResult = await postReplyToX({
						uploadPostApiKey,
						uploadPostUser,
						uploadPostBaseUrl,
						replyToId: mentionId,
						text: replyText,
					});

					await supabase
						.from("mentions")
						.update({
							payload: {
								...payload,
								x_reply_sent_at: new Date().toISOString(),
								x_reply_result: replyResult,
							},
						})
						.eq("id", mentionDbId);

					return {
						processed: 1,
						duplicates: result.duplicate ? 1 : 0,
						failed: 0,
						replied: 1,
					};
				} catch (replyError) {
					errors.push({
						mention_id: mentionId,
						error:
							replyError instanceof Error ? replyError.message : "reply failed",
					});
					return {
						processed: 1,
						duplicates: result.duplicate ? 1 : 0,
						failed: 1,
						replied: 0,
					};
				}
			},
		);

		const processed = outcomes.reduce((sum, o) => sum + o.processed, 0);
		const duplicates = outcomes.reduce((sum, o) => sum + o.duplicates, 0);
		const failed = outcomes.reduce((sum, o) => sum + o.failed, 0);
		const replied = outcomes.reduce((sum, o) => sum + o.replied, 0);

		let drainResult: Record<string, unknown> | null = null;
		if (queueOnly && triggerDrain && drainMentionQueueUrl) {
			try {
				drainResult = await triggerDrainWorker({
					drainUrl: drainMentionQueueUrl,
					serviceRoleKey,
					maxItems: drainMaxItems,
					concurrency: drainConcurrency,
				});
			} catch (drainError) {
				errors.push({
					mention_id: "drain-worker",
					error:
						drainError instanceof Error
							? drainError.message
							: "drain worker failed",
				});
			}
		}

		return jsonResponse({
			success: true,
			scanned: mentions.length,
			queue_only: queueOnly,
			ingest_concurrency: ingestConcurrency,
			processed,
			duplicates,
			failed,
			replied,
			drain_result: drainResult,
			errors,
		});
	} catch (error) {
		return errorResponse(
			error instanceof Error ? error.message : "Unknown error",
			400,
		);
	}
});
