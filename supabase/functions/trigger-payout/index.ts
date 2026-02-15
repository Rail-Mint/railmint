import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { keccak256, toBytes } from "https://esm.sh/viem@2.21.0";

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

async function requireAdmin(req: Request, supabase: any): Promise<string> {
	const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
	const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")?.trim();
	const apikey = req.headers.get("apikey")?.trim();

	// Allow service_role for system/cron operations
	if (serviceRoleKey && (auth === serviceRoleKey || apikey === serviceRoleKey)) {
		return "system";
	}

	// For user operations, validate JWT and check admin role
	if (!auth) throw new Error("Unauthorized");
	const { data: { user }, error } = await supabase.auth.getUser(auth);
	if (error || !user) throw new Error("Unauthorized");

	const { data: roles } = await supabase
		.from("user_roles")
		.select("role")
		.eq("user_id", user.id)
		.eq("role", "admin")
		.single();

	if (!roles) throw new Error("Admin access required");
	return user.id;
}

Deno.serve(async (req: Request) => {
	if (req.method === "OPTIONS")
		return new Response(null, { headers: corsHeaders });

	try {
		const body = await req.json();
		const epoch_id = body.epoch_id;
		const wallet_address = String(body.wallet_address || "").trim();

		// --- Input validation ---
		if (!epoch_id || !Number.isFinite(Number(epoch_id)) || Number(epoch_id) < 1) {
			return json({ error: "Valid epoch_id is required" }, 400);
		}
		if (!WALLET_RE.test(wallet_address)) {
			return json({ error: "Invalid wallet address format" }, 400);
		}

		const supabase = createClient(
			Deno.env.get("SUPABASE_URL")!,
			Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
		);

		// --- Authorization: service role or admin role ---
		let adminId: string;
		try {
			adminId = await requireAdmin(req, supabase);
		} catch (e) {
			return json({ error: e instanceof Error ? e.message : "Unauthorized" }, 403);
		}

		// Rate limit: 3 trigger-payout calls per minute per admin
		if (!rateLimit(`trigger-payout:${adminId}`, 3, 60_000)) {
			return json({ error: "Rate limit exceeded. Try again later." }, 429);
		}

		const txHash = keccak256(toBytes("mock-payout-" + epoch_id + "-" + Date.now()));

		const { error } = await supabase
			.from("epochs")
			.update({ status: "paid", payout_tx_hash: txHash })
			.eq("id", epoch_id)
			.eq("status", "closed");

		if (error) throw error;

		return json({ success: true, tx_hash: txHash });
	} catch (e) {
		console.error("trigger-payout error:", e);
		return json({ error: e instanceof Error ? e.message : "Unknown error" }, 400);
	}
});
