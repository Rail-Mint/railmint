import {
	errorResponse,
	handlePreflight,
	jsonResponse,
	parseJsonBody,
} from "../_shared/http.ts";

type OAuthStartBody = {
	code_challenge?: string;
	redirect_uri?: string;
};

Deno.serve(async (request: Request) => {
	const preflight = handlePreflight(request);
	if (preflight) return preflight;

	try {
		const body = await parseJsonBody<OAuthStartBody>(request);
		const codeChallenge = String(body.code_challenge || "").trim();
		const redirectUri = String(body.redirect_uri || "").trim();

		if (!codeChallenge || !redirectUri) {
			return errorResponse("Missing code_challenge or redirect_uri", 400);
		}

		const clientId = Deno.env.get("TWITTER_CLIENT_ID");
		if (!clientId) {
			return errorResponse("Twitter Client ID not configured", 500);
		}

		const state = crypto.randomUUID();

		const params = new URLSearchParams({
			response_type: "code",
			client_id: clientId,
			redirect_uri: redirectUri,
			scope: "tweet.read users.read offline.access",
			state,
			code_challenge: codeChallenge,
			code_challenge_method: "S256",
		});

		return jsonResponse({
			authorization_url: `https://x.com/i/oauth2/authorize?${params.toString()}`,
			state,
		});
	} catch (e) {
		console.error("[x-oauth-start]", e);
		return errorResponse("Failed to build authorization URL", 500);
	}
});
