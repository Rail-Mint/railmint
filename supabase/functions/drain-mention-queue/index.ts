import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type WorkerResult = {
	processed: number;
	skipped: number;
	failed: number;
	errors: Array<{ mention_id: string; error: string }>;
};

function clampInt(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, Math.floor(value)));
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

Deno.serve(async (req: Request) => {
	if (req.method === "OPTIONS")
		return new Response(null, { headers: corsHeaders });

	try {
		const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
		const supabaseUrl = Deno.env.get("SUPABASE_URL");
		if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
		if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");

		// Authenticate: require service_role key
		const authorization = req.headers.get("authorization")?.trim();
		const apikey = req.headers.get("apikey")?.trim();
		const authToken = authorization?.replace(/^Bearer\s+/i, "")?.trim();

		if (authToken !== serviceRoleKey && apikey !== serviceRoleKey) {
			return new Response(
				JSON.stringify({ error: "Unauthorized. Service role access required." }),
				{ status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
			);
		}

		const body = await req.json().catch(() => ({}));
		if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
		if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");

		const processMentionUrl =
			Deno.env.get("PROCESS_MENTION_FUNCTION_URL") ||
			`${supabaseUrl}/functions/v1/process-mention`;

		const maxItems = clampInt(
			Number(body?.max_items || Deno.env.get("MENTION_DRAIN_MAX_ITEMS") || 100),
			1,
			500,
		);
		const concurrency = clampInt(
			Number(
				body?.concurrency || Deno.env.get("MENTION_DRAIN_CONCURRENCY") || 12,
			),
			1,
			50,
		);

		const supabase = createClient(supabaseUrl, serviceRoleKey);
		const { data: queuedMentions, error: fetchErr } = await supabase
			.from("mentions")
			.select("id, mention_id")
			.eq("status", "received")
			.order("created_at", { ascending: true })
			.limit(maxItems);

		if (fetchErr) throw fetchErr;
		const queued = (queuedMentions || []) as Array<{
			id: string;
			mention_id: string;
		}>;

		if (queued.length === 0) {
			return new Response(
				JSON.stringify({
					success: true,
					queued: 0,
					processed: 0,
					skipped: 0,
					failed: 0,
					errors: [],
				}),
				{ headers: { ...corsHeaders, "Content-Type": "application/json" } },
			);
		}

		const perMention = await runWithConcurrency(
			queued,
			concurrency,
			async (mention) => {
				const response = await fetch(processMentionUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${serviceRoleKey}`,
						apikey: serviceRoleKey,
					},
					body: JSON.stringify({
						mention_id: mention.mention_id,
						process_pending: true,
					}),
				});

				const payload = (await response.json().catch(() => ({}))) as Record<
					string,
					unknown
				>;
				if (!response.ok) {
					return {
						processed: 0,
						skipped: 0,
						failed: 1,
						errors: [
							{
								mention_id: mention.mention_id,
								error:
									typeof payload.error === "string"
										? payload.error
										: `process-mention failed with status ${response.status}`,
							},
						],
					} satisfies WorkerResult;
				}

				const skipped = payload.skipped === true ? 1 : 0;
				return {
					processed: skipped ? 0 : 1,
					skipped,
					failed: 0,
					errors: [],
				} satisfies WorkerResult;
			},
		);

		const summary = perMention.reduce<WorkerResult>(
			(acc, item) => {
				acc.processed += item.processed;
				acc.skipped += item.skipped;
				acc.failed += item.failed;
				if (item.errors.length > 0) acc.errors.push(...item.errors);
				return acc;
			},
			{ processed: 0, skipped: 0, failed: 0, errors: [] },
		);

		return new Response(
			JSON.stringify({
				success: true,
				queued: queued.length,
				processed: summary.processed,
				skipped: summary.skipped,
				failed: summary.failed,
				errors: summary.errors,
			}),
			{ headers: { ...corsHeaders, "Content-Type": "application/json" } },
		);
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
