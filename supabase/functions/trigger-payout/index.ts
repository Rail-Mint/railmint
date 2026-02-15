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

function isServiceRole(req: Request): boolean {
	const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
	if (!serviceRoleKey) return false;
	const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")?.trim();
	const apikey = req.headers.get("apikey")?.trim();
	return auth === serviceRoleKey || apikey === serviceRoleKey;
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

		// --- Authorization ---
		if (!isServiceRole(req)) {
			return json({ error: "Unauthorized: admin access required" }, 403);
		}

		const supabase = createClient(
			Deno.env.get("SUPABASE_URL")!,
			Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
		);

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
