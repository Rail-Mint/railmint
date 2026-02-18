type DenoNamespace = {
	env: { get: (key: string) => string | undefined };
	serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

declare const Deno: DenoNamespace;

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...corsHeaders, "Content-Type": "application/json" },
	});
}

function isAuthorized(req: Request) {
	const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
	if (!serviceRoleKey) return false;

	const authHeader = req.headers.get("authorization") || "";
	const authToken = authHeader.replace(/^Bearer\s+/i, "").trim();
	const apiKey = req.headers.get("apikey") || "";

	return authToken === serviceRoleKey || apiKey === serviceRoleKey;
}

Deno.serve(async (req: Request) => {
	if (req.method === "OPTIONS")
		return new Response(null, { headers: corsHeaders });
	if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
	if (!isAuthorized(req)) return json({ error: "Unauthorized" }, 401);

	try {
		const body = await req.json();
		const xUserName = String(body.x_user_name || "").trim();
		if (!xUserName) return json({ error: "Missing x_user_name" }, 400);

		const apiKey = Deno.env.get("TWEETIO_API_KEY");
		if (!apiKey) throw new Error("Missing TWEETIO_API_KEY");
		const apiBase =
			Deno.env.get("TWEETIO_BASE_URL") || "https://api.twitterapi.io";

		const response = await fetch(
			`${apiBase}/oapi/x_user_stream/add_user_to_monitor_tweet`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-API-Key": apiKey,
				},
				body: JSON.stringify({ x_user_name: xUserName }),
			},
		);

		const payload = await response.json().catch(() => ({}));
		if (!response.ok) {
			return json(
				{
					error: "twitterapi.io add monitor failed",
					details: payload,
				},
				response.status,
			);
		}

		return json({ success: true, payload });
	} catch (error) {
		return json(
			{
				error: error instanceof Error ? error.message : "Unknown error",
			},
			400,
		);
	}
});
