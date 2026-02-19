import {
	errorResponse,
	handlePreflight,
	jsonResponse,
	parseJsonBody,
} from "../_shared/http.ts";
import { verifyWalletSignature } from "../_shared/signature.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

type UpsertCreatorBody = {
	wallet_address?: string;
	signature?: string;
	sign_timestamp?: number;
	clone_name?: string;
	persona_text?: string;
	prompt_template?: string;
};

Deno.serve(async (request: Request) => {
	const preflight = handlePreflight(request);
	if (preflight) return preflight;

	try {
		const body = await parseJsonBody<UpsertCreatorBody>(request);

		const walletAddress = await verifyWalletSignature(body, "upsert-creator");

		const cloneName = String(body.clone_name || "").trim();
		const personaText = String(body.persona_text || "").trim();
		const promptTemplate = String(body.prompt_template || "").trim();

		if (cloneName.length < 2 || cloneName.length > 100) {
			return errorResponse("Clone name must be 2-100 characters", 400);
		}
		if (personaText.length < 20 || personaText.length > 2000) {
			return errorResponse("Persona text must be 20-2000 characters", 400);
		}
		if (promptTemplate.length < 10 || promptTemplate.length > 2000) {
			return errorResponse("Prompt template must be 10-2000 characters", 400);
		}

		const supabase = createServiceRoleClient();

		// Check for duplicate clone name (different wallet)
		const { data: existingName } = await supabase
			.from("creators")
			.select("id, wallet_address")
			.ilike("clone_name", cloneName)
			.maybeSingle();
		const existingWallet =
			(existingName as { wallet_address?: string } | null)?.wallet_address ??
			"";

		if (
			existingName &&
			existingWallet.toLowerCase() !== walletAddress.toLowerCase()
		) {
			return errorResponse("This clone name is already taken", 409);
		}

		// Upsert creator
		const { data, error } = await supabase
			.from("creators")
			.upsert(
				{
					wallet_address: walletAddress,
					clone_name: cloneName,
					persona_text: personaText,
					prompt_template: promptTemplate,
				},
				{ onConflict: "wallet_address" },
			)
			.select("id")
			.single();

		if (error) throw error;
		const creatorId = (data as { id?: string }).id;
		if (!creatorId) throw new Error("Upsert returned no creator id");

		// Log wallet registration/update activity
		try {
			await supabase.from("wallet_activity_log").insert({
				wallet_address: walletAddress,
				event_type: existingName
					? "creator_profile_updated"
					: "creator_registered",
				metadata: { creator_id: creatorId, clone_name: cloneName },
			});
		} catch (logErr) {
			console.error("[upsert-creator] Activity log failed:", logErr);
		}

		return jsonResponse({ success: true, creator_id: creatorId });
	} catch (e) {
		const errorId = crypto.randomUUID().slice(0, 8);
		console.error(
			`[upsert-creator:${errorId}]`,
			e instanceof Error ? e.message : e,
		);
		const msg =
			e instanceof Error &&
			/signature|expired|wallet|handle|format/i.test(e.message)
				? e.message
				: "Operation failed";
		return jsonResponse({ error: msg, error_id: errorId }, 400);
	}
});
