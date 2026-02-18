import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyMessage } from "https://esm.sh/viem@2.21.0";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...corsHeaders, "Content-Type": "application/json" },
	});
}

async function verifyWalletSignature(
	body: Record<string, unknown>,
	functionName: string,
): Promise<string> {
	const wallet_address = String(body.wallet_address || "").trim();
	const signature = String(body.signature || "").trim();
	const sign_timestamp = Number(body.sign_timestamp || 0);

	if (!WALLET_RE.test(wallet_address)) {
		throw new Error("Invalid wallet address format");
	}
	if (!signature || !sign_timestamp) {
		throw new Error(
			"Missing signature. Please sign the action with your wallet.",
		);
	}
	if (Math.abs(Date.now() - sign_timestamp) > 300_000) {
		throw new Error("Signature expired. Please try again.");
	}

	const message = `RailMintAI Action\nFunction: ${functionName}\nWallet: ${wallet_address}\nTimestamp: ${sign_timestamp}`;

	const valid = await verifyMessage({
		address: wallet_address as `0x${string}`,
		message,
		signature: signature as `0x${string}`,
	});

	if (!valid) {
		throw new Error("Invalid wallet signature. Action rejected.");
	}

	return wallet_address;
}

Deno.serve(async (req: Request) => {
	if (req.method === "OPTIONS")
		return new Response(null, { headers: corsHeaders });

	try {
		const body = await req.json();

		const wallet_address = await verifyWalletSignature(body, "upsert-creator");

		const clone_name = String(body.clone_name || "").trim();
		const persona_text = String(body.persona_text || "").trim();
		const prompt_template = String(body.prompt_template || "").trim();

		if (clone_name.length < 2 || clone_name.length > 100) {
			return json({ error: "Clone name must be 2-100 characters" }, 400);
		}
		if (persona_text.length < 20 || persona_text.length > 2000) {
			return json({ error: "Persona text must be 20-2000 characters" }, 400);
		}
		if (prompt_template.length < 10 || prompt_template.length > 2000) {
			return json({ error: "Prompt template must be 10-2000 characters" }, 400);
		}

		const supabase = createClient(
			Deno.env.get("SUPABASE_URL")!,
			Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
		);

		// Check for duplicate clone name (different wallet)
		const { data: existingName } = await supabase
			.from("creators")
			.select("id, wallet_address")
			.ilike("clone_name", clone_name)
			.maybeSingle();

		if (
			existingName &&
			existingName.wallet_address.toLowerCase() !== wallet_address.toLowerCase()
		) {
			return json({ error: "This clone name is already taken" }, 409);
		}

		// Upsert creator
		const { data, error } = await supabase
			.from("creators")
			.upsert(
				{
					wallet_address,
					clone_name,
					persona_text,
					prompt_template,
				},
				{ onConflict: "wallet_address" },
			)
			.select("id")
			.single();

		if (error) throw error;

		// Log wallet registration/update activity
		try {
			await supabase.from("wallet_activity_log").insert({
				wallet_address,
				event_type: existingName
					? "creator_profile_updated"
					: "creator_registered",
				metadata: { creator_id: data.id, clone_name },
			});
		} catch (logErr) {
			console.error("[upsert-creator] Activity log failed:", logErr);
		}

		return json({ success: true, creator_id: data.id });
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
		return json({ error: msg, error_id: errorId }, 400);
	}
});
