import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
	if (req.method === "OPTIONS")
		return new Response(null, { headers: corsHeaders });

	try {
		const { epoch_id, wallet_address } = await req.json();
		if (!epoch_id || !wallet_address)
			throw new Error("epoch_id and wallet_address required");

		const supabase = createClient(
			Deno.env.get("SUPABASE_URL")!,
			Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
		);

		// Generate mock payout tx hash
		const encoder = new TextEncoder();
		const hashBuffer = await crypto.subtle.digest(
			"SHA-256",
			encoder.encode(`mock-payout-${epoch_id}-${Date.now()}`),
		);
		const txHash =
			"0x" +
			Array.from(new Uint8Array(hashBuffer))
				.map((b) => b.toString(16).padStart(2, "0"))
				.join("");

		// Update epoch
		const { error } = await supabase
			.from("epochs")
			.update({ status: "paid", payout_tx_hash: txHash })
			.eq("id", epoch_id)
			.eq("status", "closed");

		if (error) throw error;

		return new Response(JSON.stringify({ success: true, tx_hash: txHash }), {
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	} catch (e) {
		console.error("trigger-payout error:", e);
		return new Response(
			JSON.stringify({
				error: e instanceof Error ? e.message : "Unknown error",
			}),
			{
				status: 400,
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			},
		);
	}
});
