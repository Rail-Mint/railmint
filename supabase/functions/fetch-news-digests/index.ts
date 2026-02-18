import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type CreatorProfile = {
	creator_id: string;
	news_topics: string[];
	news_cadence: "hourly" | "daily" | "weekly";
	context_opt_in: boolean;
	news_enabled: boolean;
	updated_at: string;
};

type NewsArticle = {
	source: { name: string };
	title: string;
	description: string | null;
	url: string;
	publishedAt: string;
};

type NewsDigestBullet = {
	source: string;
	url: string;
	timestamp: string;
	topic: string;
	text: string;
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

async function fetchNewsFromAPI(
	topic: string,
	apiKey: string,
	retries = 3,
): Promise<NewsDigestBullet[]> {
	for (let attempt = 0; attempt < retries; attempt++) {
		try {
			const response = await fetch(
				`https://newsapi.org/v2/everything?q=${encodeURIComponent(topic)}&apiKey=${apiKey}&pageSize=10&sortBy=publishedAt&language=en`,
				{
					headers: {
						"User-Agent": "RailMint-Agent",
					},
				},
			);

			if (!response.ok) {
				if (response.status === 429) {
					// Rate limit hit, exponential backoff
					const backoff = 2 ** attempt * 1000;
					await new Promise((resolve) => setTimeout(resolve, backoff));
					continue;
				}
				throw new Error(`NewsAPI failed: ${response.status}`);
			}

			const data = await response.json();
			const articles: NewsArticle[] = data.articles || [];

			return articles.map((article) => ({
				source: article.source.name,
				url: article.url,
				timestamp: article.publishedAt,
				topic: topic,
				text:
					article.title +
					(article.description ? `: ${article.description}` : ""),
			}));
		} catch (error) {
			if (attempt === retries - 1) throw error;
			// Wait before retry
			await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
		}
	}
	return [];
}

function getCadenceWindow(cadence: "hourly" | "daily" | "weekly"): Date {
	const now = new Date();
	switch (cadence) {
		case "hourly":
			now.setHours(now.getHours() - 1);
			break;
		case "daily":
			now.setDate(now.getDate() - 1);
			break;
		case "weekly":
			now.setDate(now.getDate() - 7);
			break;
	}
	return now;
}

async function fetchNewsForCreator(params: {
	supabase: ReturnType<typeof createClient>;
	creator: CreatorProfile;
	newsApiKey: string;
	topicCache: Map<string, NewsDigestBullet[]>;
}): Promise<{
	creator_id: string;
	success: boolean;
	topics_updated: number;
	error?: string;
}> {
	try {
		const { creator, newsApiKey, topicCache } = params;

		// Enforce opt-in: BOTH context_opt_in and news_enabled must be true
		if (!creator.context_opt_in || !creator.news_enabled) {
			return {
				creator_id: creator.creator_id,
				success: true,
				topics_updated: 0,
			};
		}

		// Check if we need to fetch based on cadence
		const cadenceWindow = getCadenceWindow(creator.news_cadence);

		// Check last fetch time for this creator
		const { data: existingDigests } = await params.supabase
			.from("creator_news_digests")
			.select("topic, last_fetched_at")
			.eq("creator_id", creator.creator_id)
			.order("last_fetched_at", { ascending: false })
			.limit(1);

		if (
			existingDigests &&
			existingDigests.length > 0 &&
			existingDigests[0].last_fetched_at
		) {
			const lastFetch = new Date(existingDigests[0].last_fetched_at);
			if (lastFetch > cadenceWindow) {
				// Already fetched within cadence window
				return {
					creator_id: creator.creator_id,
					success: true,
					topics_updated: 0,
				};
			}
		}

		let topicsUpdated = 0;

		// Fetch news for each topic
		for (const topic of creator.news_topics) {
			// Check cache first
			let bullets: NewsDigestBullet[];
			if (topicCache.has(topic)) {
				bullets = topicCache.get(topic)!;
			} else {
				// Fetch from API and cache
				bullets = await fetchNewsFromAPI(topic, newsApiKey);
				topicCache.set(topic, bullets);
			}

			if (bullets.length === 0) continue;

			// Store in creator_news_digests
			const { error: upsertError } = await params.supabase
				.from("creator_news_digests")
				.upsert(
					{
						creator_id: creator.creator_id,
						topic: topic,
						cadence: creator.news_cadence,
						digest_bullets: bullets,
						last_fetched_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					},
					{ onConflict: "creator_id,topic" },
				);

			if (upsertError) throw upsertError;
			topicsUpdated++;
		}

		return {
			creator_id: creator.creator_id,
			success: true,
			topics_updated: topicsUpdated,
		};
	} catch (error) {
		return {
			creator_id: params.creator.creator_id,
			success: false,
			topics_updated: 0,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

Deno.serve(async (req: Request) => {
	if (req.method === "OPTIONS") {
		return new Response(null, { headers: corsHeaders });
	}

	try {
		const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
		const supabaseUrl = Deno.env.get("SUPABASE_URL");
		const newsApiKey = Deno.env.get("NEWS_API_KEY");

		if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
		if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
		if (!newsApiKey) throw new Error("Missing NEWS_API_KEY");

		// Service role auth required (pattern from update-summaries)
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
			Number(body?.max_creators || Deno.env.get("NEWS_MAX_CREATORS") || 50),
			1,
			200,
		);
		const concurrency = clampInt(
			Number(body?.concurrency || Deno.env.get("NEWS_CONCURRENCY") || 3),
			1,
			10,
		);

		const supabase = createClient(supabaseUrl, serviceRoleKey);

		// Query creators with BOTH opt-in flags enabled
		const { data: creators, error: fetchError } = await supabase
			.from("creator_profiles")
			.select(
				"creator_id, news_topics, news_cadence, context_opt_in, news_enabled, updated_at",
			)
			.eq("context_opt_in", true)
			.eq("news_enabled", true)
			.limit(maxCreators);

		if (fetchError) throw fetchError;

		const eligibleCreators = (creators || []) as CreatorProfile[];

		if (eligibleCreators.length === 0) {
			return new Response(
				JSON.stringify({
					success: true,
					scanned: 0,
					processed: 0,
					failed: 0,
					topics_updated: 0,
					errors: [],
				}),
				{ headers: { ...corsHeaders, "Content-Type": "application/json" } },
			);
		}

		// Topic cache to avoid duplicate API calls
		const topicCache = new Map<string, NewsDigestBullet[]>();

		// Process creators with concurrency control
		const results = await runWithConcurrency(
			eligibleCreators,
			concurrency,
			async (creator) => {
				return await fetchNewsForCreator({
					supabase,
					creator,
					newsApiKey,
					topicCache,
				});
			},
		);

		const processed = results.filter(
			(r) => r.success && r.topics_updated > 0,
		).length;
		const failed = results.filter((r) => !r.success).length;
		const topicsUpdated = results.reduce((sum, r) => sum + r.topics_updated, 0);
		const errors = results
			.filter((r) => !r.success && r.error)
			.map((r) => ({ creator_id: r.creator_id, error: r.error || "Unknown" }));

		return new Response(
			JSON.stringify({
				success: true,
				scanned: eligibleCreators.length,
				processed,
				failed,
				topics_updated: topicsUpdated,
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
