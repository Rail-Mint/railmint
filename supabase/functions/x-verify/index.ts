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

async function verifyWalletSignature(body: Record<string, unknown>): Promise<string> {
  const wallet_address = String(body.wallet_address || "").trim();
  const signature = String(body.signature || "").trim();
  const sign_timestamp = Number(body.sign_timestamp || 0);

  if (!WALLET_RE.test(wallet_address)) throw new Error("Invalid wallet address format");
  if (!signature || !sign_timestamp) throw new Error("Missing signature");
  if (Math.abs(Date.now() - sign_timestamp) > 300_000) throw new Error("Signature expired");

  const message = `RailMintAI Action\nFunction: x-verify\nWallet: ${wallet_address}\nTimestamp: ${sign_timestamp}`;
  const valid = await verifyMessage({
    address: wallet_address as `0x${string}`,
    message,
    signature: signature as `0x${string}`,
  });
  if (!valid) throw new Error("Invalid wallet signature");

  return wallet_address;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const wallet_address = await verifyWalletSignature(body);

    const code = String(body.code || "").trim();
    const code_verifier = String(body.code_verifier || "").trim();
    const redirect_uri = String(body.redirect_uri || "").trim();

    if (!code || !code_verifier || !redirect_uri) {
      return json({ error: "Missing OAuth parameters" }, 400);
    }

    const clientId = Deno.env.get("TWITTER_CLIENT_ID")!;
    const clientSecret = Deno.env.get("TWITTER_SECRET")!;

    // Exchange authorization code for access token
    const tokenRes = await fetch("https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        redirect_uri,
        code_verifier,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("[x-verify] Token exchange failed:", err);
      return json({ error: "Failed to exchange authorization code with X" }, 400);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Fetch the authenticated user's profile
    const userRes = await fetch("https://api.x.com/2/users/me?user.fields=username", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      const err = await userRes.text();
      console.error("[x-verify] User fetch failed:", err);
      return json({ error: "Failed to fetch X user profile" }, 400);
    }

    const userData = await userRes.json();
    const xUsername = userData.data?.username;

    if (!xUsername) {
      return json({ error: "Could not retrieve X username" }, 400);
    }

    const handle = `@${xUsername}`;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find the creator by wallet
    const { data: creator, error: findErr } = await supabase
      .from("creators")
      .select("id, x_handle")
      .eq("wallet_address", wallet_address)
      .maybeSingle();

    if (findErr) throw findErr;
    if (!creator) {
      return json({ error: "Creator not found for this wallet" }, 404);
    }

    // Verify the X handle matches what the creator registered (case-insensitive)
    if (creator.x_handle && creator.x_handle.toLowerCase() !== handle.toLowerCase()) {
      return json({
        error: `X account @${xUsername} does not match registered handle ${creator.x_handle}. Update your handle first.`,
      }, 400);
    }

    // Update creator as verified
    const { error: updateErr } = await supabase
      .from("creators")
      .update({
        x_handle: handle,
        x_verified: true,
        x_verified_at: new Date().toISOString(),
      })
      .eq("id", creator.id);

    if (updateErr) throw updateErr;

    return json({
      success: true,
      x_handle: handle,
      x_username: xUsername,
    });
  } catch (e) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[x-verify:${errorId}]`, e instanceof Error ? e.message : e);
    const msg = e instanceof Error && /signature|expired|wallet|format/i.test(e.message)
      ? e.message
      : "Verification failed";
    return json({ error: msg, error_id: errorId }, 400);
  }
});
