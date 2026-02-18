import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type CreatorActivity = {
	id: string;
	x_handle: string | null;
	agentic_context_opt_in: boolean;
	mention_count: number;
	earliest_mention: string;
	latest_mention: string;
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

async function generateSummary(params: {
	openRouterApiKey: string;
	creatorHandle: string;
	mentions: Array<{ text: string; created_at: string; author_handle?: string }>;
	previousSummary?: string | null;
}): Promise<{ summary_text: string; token_count: number }> {
	const systemPrompt = `You are a conversation summarizer. Generate a concise rolling summary of X mentions for creator @${params.creatorHandle}.

Rules:
- Maximum 500 tokens
- Focus on key themes, questions, and engagement patterns
- If previous summary exists, update it with new mentions
- Output only the summary text, no markdown formatting`;

	const mentionsText = params.mentions
		.map((m) => `[${m.created_at}] ${m.author_handle || "Unknown"}: ${m.text}`)
		.join("\n");

	const userPrompt = params.previousSummary
		? `Previous summary:\n${params.previousSummary}\n\nNew mentions:\n${mentionsText}\n\nUpdate the summary with these new mentions.`
		: `Mentions:\n${mentionsText}\n\nGenerate a rolling summary.`;

	const requestBody = {
		model: "openai/gpt-4o-mini",
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userPrompt },
		],
		max_tokens: 500,
		temperature: 0.7,
	};

	const response = await fetch(
		"https://openrouter.ai/api/v1/chat/completions",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${params.openRouterApiKey}`,
				"HTTP-Referer": "https://railmint.app",
				"X-Title": "RailMint Creator Summaries",
			},
			body: JSON.stringify(requestBody),
		},
	);

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`OpenRouter API failed: ${response.status} ${errorText}`);
	}

	const data = await response.json();
	const summaryText =
		data.choices?.[0]?.message?.content?.trim() || "No summary generated";
	const tokenCount = data.usage?.completion_tokens || 0;

	return {
		summary_text: summaryText,
		token_count: Math.min(tokenCount, 500),
	};
}

async function fetchRecentMentions(params: {
	supabase: ReturnType<typeof createClient>;
	creatorId: string;
}): Promise<
	Array<{
		text: string;
		created_at: string;
		author_handle?: string;
	}>
> {
	const ninetyDaysAgo = new Date();
	ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

	const { data, error } = await params.supabase
		.from("mentions")
		.select("text, created_at, author_handle, payload")
		.eq("creator_id", params.creatorId)
		.gte("created_at", ninetyDaysAgo.toISOString())
		.order("created_at", { ascending: false })
		.limit(20);

	if (error) throw error;

	return (
		data?.map((m) => ({
			text: m.text || "",
			created_at: m.created_at,
			author_handle:
				m.author_handle || (m.payload as any)?.author_handle || null,
		})) || []
	);
}

async function updateCreatorSummary(params: {
	supabase: ReturnType<typeof createClient>;
	openRouterApiKey: string;
	creator: CreatorActivity;
}): Promise<{
	creator_id: string;
	success: boolean;
	error?: string;
}> {
	try {
		const mentions = await fetchRecentMentions({
			supabase: params.supabase,
			creatorId: params.creator.id,
		});

		if (mentions.length === 0) {
			return {
				creator_id: params.creator.id,
				success: true,
			};
		}

		const { data: existingSummary } = await params.supabase
			.from("creator_conversation_summaries")
			.select("summary_text")
			.eq("creator_id", params.creator.id)
			.maybeSingle();

		const { summary_text, token_count } = await generateSummary({
			openRouterApiKey: params.openRouterApiKey,
			creatorHandle: params.creator.x_handle || "unknown",
			mentions,
			previousSummary: existingSummary?.summary_text || null,
		});

		const { error: upsertError } = await params.supabase
			.from("creator_conversation_summaries")
			.upsert(
				{
					creator_id: params.creator.id,
					summary_text,
					token_count,
					conversation_count: params.creator.mention_count,
					earliest_timestamp: params.creator.earliest_mention,
					latest_timestamp: params.creator.latest_mention,
					updated_at: new Date().toISOString(),
				},
				{ onConflict: "creator_id" },
			);

		if (upsertError) throw upsertError;

		return {
			creator_id: params.creator.id,
			success: true,
		};
	} catch (error) {
		return {
			creator_id: params.creator.id,
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

Deno.serve(async (req: Request) => {
	if (req.method === "OPTIONS")
		return new Response(null, { headers: corsHeaders });

	try {
		const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
		const supabaseUrl = Deno.env.get("SUPABASE_URL");
		const openRouterApiKey = Deno.env.get("OPENROUTER_API_KEY");

		if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
		if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
		if (!openRouterApiKey) throw new Error("Missing OPENROUTER_API_KEY");

		const authorization = req.headers.get("authorization")?.trim();
		const apikey = req.headers.get("apikey")?.trim();
		const authToken = authorization?.replace(/^Bearer\s+/i, "")?.trim();

		if (authToken !== serviceRoleKey && apikey !== serviceRoleKey) {
			return new Response(
				JSON.stringify({
					error: "Unauthorized. Service role access required.",
				}),
				{
					status: 401,
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				},
			);
		}

		const body = await req.json().catch(() => ({}));
		const maxCreators = clampInt(
			Number(body?.max_creators || Deno.env.get("SUMMARY_MAX_CREATORS") || 50),
			1,
			200,
		);
		const concurrency = clampInt(
			Number(body?.concurrency || Deno.env.get("SUMMARY_CONCURRENCY") || 5),
			1,
			20,
		);

		const supabase = createClient(supabaseUrl, serviceRoleKey);

		const oneHourAgo = new Date();
		oneHourAgo.setHours(oneHourAgo.getHours() - 1);

		const { data: creatorsWithActivity, error: fetchError } = await supabase
			.from("creators")
			.select("id, x_handle, agentic_context_opt_in")
			.eq("agentic_context_opt_in", true)
			.limit(maxCreators);

		if (fetchError) throw fetchError;

		const creators = creatorsWithActivity || [];
		if (creators.length === 0) {
			return new Response(
				JSON.stringify({
					success: true,
					scanned: 0,
					processed: 0,
					failed: 0,
					errors: [],
				}),
				{ headers: { ...corsHeaders, "Content-Type": "application/json" } },
			);
		}

		const creatorsWithMentions: CreatorActivity[] = [];
		for (const creator of creators) {
			const { data: mentionStats, error: statsError } = await supabase
				.from("mentions")
				.select("created_at")
				.eq("creator_id", creator.id)
				.gte("created_at", oneHourAgo.toISOString())
				.order("created_at", { ascending: true });

			if (statsError) continue;
			if (!mentionStats || mentionStats.length === 0) continue;

			creatorsWithMentions.push({
				id: creator.id,
				x_handle: creator.x_handle,
				agentic_context_opt_in: creator.agentic_context_opt_in,
				mention_count: mentionStats.length,
				earliest_mention: mentionStats[0].created_at,
				latest_mention: mentionStats[mentionStats.length - 1].created_at,
			});
		}

		const results = await runWithConcurrency(
			creatorsWithMentions,
			concurrency,
			async (creator) => {
				return await updateCreatorSummary({
					supabase,
					openRouterApiKey,
					creator,
				});
			},
		);

		const processed = results.filter((r) => r.success).length;
		const failed = results.filter((r) => !r.success).length;
		const errors = results
			.filter((r) => !r.success && r.error)
			.map((r) => ({ creator_id: r.creator_id, error: r.error || "Unknown" }));

		return new Response(
			JSON.stringify({
				success: true,
				scanned: creators.length,
				with_activity: creatorsWithMentions.length,
				processed,
				failed,
				errors,
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
