import {
	errorResponse,
	handlePreflight,
	jsonResponse,
	parseJsonBody,
} from "../_shared/http.ts";
import { createInMemoryRateLimiter } from "../_shared/rate-limit.ts";
import { verifyWalletSignature } from "../_shared/signature.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

type UpdateProfileBody = {
	wallet_address?: string;
	signature?: string;
	sign_timestamp?: number;
	clone_name?: string;
	persona_text?: string;
	prompt_template?: string;
	is_active?: boolean;
};

const checkRateLimit = createInMemoryRateLimiter();

Deno.serve(async (request: Request) => {
	const preflight = handlePreflight(request);
	if (preflight) return preflight;

	try {
		const body = await parseJsonBody<UpdateProfileBody>(request);

		const walletAddress = await verifyWalletSignature(body, "update-profile");

		// Rate limit: 10 updates per minute per wallet
		if (
			!checkRateLimit(
				`update-profile:${walletAddress.toLowerCase()}`,
				10,
				60_000,
			)
		) {
			return errorResponse("Rate limit exceeded. Try again later.", 429);
		}

		// Validate update fields
		const updates: Record<string, unknown> = {};
		const errors: string[] = [];

		if (body.clone_name !== undefined) {
			const value = String(body.clone_name).trim();
			if (value.length < 2) {
				errors.push("Clone name must be at least 2 characters");
			} else if (value.length > 60) {
				errors.push("Clone name must be at most 60 characters");
			} else {
				updates.clone_name = value;
			}
		}

		if (body.persona_text !== undefined) {
			const value = String(body.persona_text).trim();
			if (value.length < 20) {
				errors.push("Persona must be at least 20 characters");
			} else if (value.length > 1000) {
				errors.push("Persona must be at most 1000 characters");
			} else {
				updates.persona_text = value;
			}
		}

		if (body.prompt_template !== undefined) {
			const value = String(body.prompt_template).trim();
			if (value.length < 10) {
				errors.push("Prompt template must be at least 10 characters");
			} else if (value.length > 1000) {
				errors.push("Prompt template must be at most 1000 characters");
			} else {
				updates.prompt_template = value;
			}
		}

		if (body.is_active !== undefined) {
			if (typeof body.is_active !== "boolean") {
				errors.push("is_active must be a boolean");
			} else {
				updates.is_active = body.is_active;
			}
		}

		if (errors.length > 0) {
			return jsonResponse({ error: "Validation failed", details: errors }, 400);
		}

		if (Object.keys(updates).length === 0) {
			return errorResponse("No valid fields to update", 400);
		}

		const supabase = createServiceRoleClient();

		// Verify creator exists with this wallet
		const { data: creator, error: findErr } = await supabase
			.from("creators")
			.select("id")
			.ilike("wallet_address", walletAddress)
			.single();

		if (findErr || !creator) {
			return errorResponse("Creator not found for this wallet", 404);
		}

		const creatorId = (creator as { id?: string }).id;
		if (!creatorId) {
			return errorResponse("Creator not found for this wallet", 404);
		}

		const { error: updateErr } = await supabase
			.from("creators")
			.update(updates)
			.eq("id", creatorId);

		if (updateErr) throw updateErr;

		return jsonResponse({ success: true });
	} catch (e) {
		const errorId = crypto.randomUUID().slice(0, 8);
		console.error(
			`[update-profile:${errorId}]`,
			e instanceof Error ? e.message : e,
		);
		const msg =
			e instanceof Error && /signature|expired|wallet/i.test(e.message)
				? e.message
				: "Failed to update profile";
		return jsonResponse({ error: msg, error_id: errorId }, 500);
	}
});
