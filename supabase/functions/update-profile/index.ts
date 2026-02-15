import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyMessage } from "https://esm.sh/viem@2.21.0";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;
const X_HANDLE_RE = /^@?[\w]*$/;

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...corsHeaders, "Content-Type": "application/json" },
	});
}

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, number[]>();
function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
	const now = Date.now();
	const timestamps = (rateLimitMap.get(key) || []).filter(t => now - t < windowMs);
	if (timestamps.length >= maxRequests) return false;
	timestamps.push(now);
	rateLimitMap.set(key, timestamps);
	return true;
}

async function verifyWalletSignature(body: Record<string, unknown>, functionName: string): Promise<string> {
	const wallet_address = String(body.wallet_address || "").trim();
	const signature = String(body.signature || "").trim();
	const sign_timestamp = Number(body.sign_timestamp || 0);

	if (!WALLET_RE.test(wallet_address)) {
		throw new Error("Invalid wallet address format");
	}
	if (!signature || !sign_timestamp) {
		throw new Error("Missing signature. Please sign the action with your wallet.");
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

		const wallet_address = await verifyWalletSignature(body, "update-profile");

		// Rate limit: 10 updates per minute per wallet
		if (!rateLimit(`update-profile:${wallet_address.toLowerCase()}`, 10, 60_000)) {
			return json({ error: "Rate limit exceeded. Try again later." }, 429);
		}

		// Validate update fields
		const updates: Record<string, unknown> = {};
		const errors: string[] = [];

		if (body.clone_name !== undefined) {
			const v = String(body.clone_name).trim();
			if (v.length < 2) errors.push("Clone name must be at least 2 characters");
			if (v.length > 60) errors.push("Clone name must be at most 60 characters");
			if (!errors.length) updates.clone_name = v;
		}

		if (body.x_handle !== undefined) {
			const v = String(body.x_handle).trim();
			if (v && !X_HANDLE_RE.test(v)) errors.push("Invalid X handle format");
			if (v.length > 30) errors.push("X handle must be at most 30 characters");
			if (!errors.length) updates.x_handle = v || null;
		}

		if (body.persona_text !== undefined) {
			const v = String(body.persona_text).trim();
			if (v.length < 20) errors.push("Persona must be at least 20 characters");
			if (v.length > 1000) errors.push("Persona must be at most 1000 characters");
			if (!errors.length) updates.persona_text = v;
		}

		if (body.prompt_template !== undefined) {
			const v = String(body.prompt_template).trim();
			if (v.length < 10) errors.push("Prompt template must be at least 10 characters");
			if (v.length > 1000) errors.push("Prompt template must be at most 1000 characters");
			if (!errors.length) updates.prompt_template = v;
		}

		if (body.is_active !== undefined) {
			if (typeof body.is_active !== "boolean") errors.push("is_active must be a boolean");
			else updates.is_active = body.is_active;
		}

		if (errors.length > 0) {
			return json({ error: "Validation failed", details: errors }, 400);
		}

		if (Object.keys(updates).length === 0) {
			return json({ error: "No valid fields to update" }, 400);
		}

		const supabase = createClient(
			Deno.env.get("SUPABASE_URL")!,
			Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
		);

		// Verify creator exists with this wallet
		const { data: creator, error: findErr } = await supabase
			.from("creators")
			.select("id")
			.ilike("wallet_address", wallet_address)
			.single();

		if (findErr || !creator) {
			return json({ error: "Creator not found for this wallet" }, 404);
		}

		const { error: updateErr } = await supabase
			.from("creators")
			.update(updates)
			.eq("id", (creator as any).id);

		if (updateErr) throw updateErr;

		return json({ success: true });
	} catch (e) {
		console.error("update-profile error:", e);
		return json({ error: e instanceof Error ? e.message : "An error occurred while updating profile" }, 500);
	}
});
