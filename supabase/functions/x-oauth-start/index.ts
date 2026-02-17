const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const code_challenge = String(body.code_challenge || "").trim();
    const redirect_uri = String(body.redirect_uri || "").trim();

    if (!code_challenge || !redirect_uri) {
      return json({ error: "Missing code_challenge or redirect_uri" }, 400);
    }

    const clientId = Deno.env.get("TWITTER_CLIENT_ID");
    if (!clientId) {
      return json({ error: "Twitter Client ID not configured" }, 500);
    }

    const state = crypto.randomUUID();

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri,
      scope: "tweet.read users.read offline.access",
      state,
      code_challenge,
      code_challenge_method: "S256",
    });

    return json({
      authorization_url: `https://x.com/i/oauth2/authorize?${params.toString()}`,
      state,
    });
  } catch (e) {
    console.error("[x-oauth-start]", e);
    return json({ error: "Failed to build authorization URL" }, 500);
  }
});
