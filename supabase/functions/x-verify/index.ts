import {
	errorResponse,
	handlePreflight,
	jsonResponse,
	parseJsonBody,
} from "../_shared/http.ts";
import { verifyWalletSignature } from "../_shared/signature.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

type XVerifyBody = {
	wallet_address?: string;
	signature?: string;
	sign_timestamp?: number;
	code?: string;
	code_verifier?: string;
	redirect_uri?: string;
};

type CreatorRow = {
	id: string;
	x_handle: string | null;
	x_verified: boolean | null;
};

async function logActivity(
	walletAddress: string,
	eventType: string,
	metadata: Record<string, unknown> = {},
) {
	const supabase = createServiceRoleClient();
	try {
		await supabase.from("wallet_activity_log").insert({
			wallet_address: walletAddress,
			event_type: eventType,
			metadata,
		});
	} catch (error) {
		console.error("[x-verify] Failed to log activity", error);
	}
}

Deno.serve(async (request: Request) => {
	const preflight = handlePreflight(request);
	if (preflight) return preflight;

	const supabase = createServiceRoleClient();

	try {
		const body = await parseJsonBody<XVerifyBody>(request);
		const walletAddress = await verifyWalletSignature(body, "x-verify");

		const code = String(body.code ?? "").trim();
		const codeVerifier = String(body.code_verifier ?? "").trim();
		const redirectUri = String(body.redirect_uri ?? "").trim();

		if (!code || !codeVerifier || !redirectUri) {
			return errorResponse("Missing OAuth parameters", 400);
		}

		await logActivity(walletAddress, "x_verify_attempt", {
			redirect_uri: redirectUri,
		});

		const clientId = Deno.env.get("TWITTER_CLIENT_ID") ?? "";
		const clientSecret = Deno.env.get("TWITTER_SECRET") ?? "";
		if (!clientId || !clientSecret) {
			return errorResponse("Twitter OAuth credentials are not configured", 500);
		}

		const tokenResponse = await fetch("https://api.x.com/2/oauth2/token", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
			},
			body: new URLSearchParams({
				code,
				grant_type: "authorization_code",
				redirect_uri: redirectUri,
				code_verifier: codeVerifier,
			}),
		});

		if (!tokenResponse.ok) {
			const responseText = await tokenResponse.text();
			await logActivity(walletAddress, "x_verify_token_failed", {
				error: responseText,
			});
			return errorResponse("Failed to exchange authorization code with X", 400);
		}

		const tokenPayload = (await tokenResponse.json()) as {
			access_token?: string;
		};
		const accessToken = tokenPayload.access_token;
		if (!accessToken) {
			return errorResponse("OAuth token response missing access token", 400);
		}

		const userResponse = await fetch(
			"https://api.x.com/2/users/me?user.fields=username",
			{
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		);

		if (!userResponse.ok) {
			const responseText = await userResponse.text();
			await logActivity(walletAddress, "x_verify_user_fetch_failed", {
				error: responseText,
			});
			return errorResponse("Failed to fetch X user profile", 400);
		}

		const userPayload = (await userResponse.json()) as {
			data?: { username?: string };
		};
		const username = userPayload.data?.username;
		if (!username) {
			return errorResponse("Could not retrieve X username", 400);
		}

		const handle = `@${username}`;
		const { data: creatorData, error: creatorError } = await supabase
			.from("creators")
			.select("id, x_handle, x_verified")
			.eq("wallet_address", walletAddress)
			.maybeSingle();

		if (creatorError) throw creatorError;
		if (!creatorData) {
			return errorResponse("Creator not found for this wallet", 404);
		}

		const creator = creatorData as CreatorRow;
		if (
			creator.x_verified &&
			creator.x_handle &&
			creator.x_handle.toLowerCase() !== handle.toLowerCase()
		) {
			await logActivity(walletAddress, "x_verify_handle_mismatch", {
				registered: creator.x_handle,
				actual: handle,
			});
			return errorResponse(
				`X account @${username} does not match the already-verified handle ${creator.x_handle}.`,
				400,
			);
		}

		const { error: updateError } = await supabase
			.from("creators")
			.update({
				x_handle: handle,
				x_verified: true,
				x_verified_at: new Date().toISOString(),
			})
			.eq("id", creator.id);

		if (updateError) throw updateError;

		await logActivity(walletAddress, "x_verify_success", {
			x_handle: handle,
			creator_id: creator.id,
		});

		return jsonResponse({
			success: true,
			x_handle: handle,
			x_username: username,
		});
	} catch (error) {
		const errorId = crypto.randomUUID().slice(0, 8);
		const message = error instanceof Error ? error.message : String(error);
		console.error(`[x-verify:${errorId}]`, message);
		const userMessage = /signature|expired|wallet|format/i.test(message)
			? message
			: "Verification failed";
		return jsonResponse({ error: userMessage, error_id: errorId }, 400);
	}
});
