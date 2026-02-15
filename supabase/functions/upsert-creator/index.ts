import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;
const HANDLE_RE = /^@?[\w]{1,30}$/;

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
    const wallet_address = String(body.wallet_address || "").trim();
    const x_handle_raw = String(body.x_handle || "").trim();
    const clone_name = String(body.clone_name || "").trim();
    const persona_text = String(body.persona_text || "").trim();
    const prompt_template = String(body.prompt_template || "").trim();

    // --- Input validation ---
    if (!WALLET_RE.test(wallet_address)) {
      return json({ error: "Invalid wallet address format" }, 400);
    }
    if (!HANDLE_RE.test(x_handle_raw)) {
      return json({ error: "Invalid X handle format" }, 400);
    }
    if (clone_name.length < 2 || clone_name.length > 100) {
      return json({ error: "Clone name must be 2-100 characters" }, 400);
    }
    if (persona_text.length < 20 || persona_text.length > 2000) {
      return json({ error: "Persona text must be 20-2000 characters" }, 400);
    }
    if (prompt_template.length < 10 || prompt_template.length > 2000) {
      return json({ error: "Prompt template must be 10-2000 characters" }, 400);
    }

    const handle = x_handle_raw.startsWith("@") ? x_handle_raw : `@${x_handle_raw}`;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Check for duplicate handle (different wallet)
    const { data: existingHandle } = await supabase
      .from("creators")
      .select("id, wallet_address")
      .ilike("x_handle", handle)
      .maybeSingle();

    if (existingHandle && existingHandle.wallet_address.toLowerCase() !== wallet_address.toLowerCase()) {
      return json({ error: "This X handle is already registered by another wallet" }, 409);
    }

    // Check for duplicate clone name (different wallet)
    const { data: existingName } = await supabase
      .from("creators")
      .select("id, wallet_address")
      .ilike("clone_name", clone_name)
      .maybeSingle();

    if (existingName && existingName.wallet_address.toLowerCase() !== wallet_address.toLowerCase()) {
      return json({ error: "This clone name is already taken" }, 409);
    }

    // Upsert creator
    const { data, error } = await supabase
      .from("creators")
      .upsert(
        {
          wallet_address,
          x_handle: handle,
          clone_name,
          persona_text,
          prompt_template,
        },
        { onConflict: "wallet_address" },
      )
      .select("id")
      .single();

    if (error) throw error;

    return json({ success: true, creator_id: data.id });
  } catch (e) {
    console.error("upsert-creator error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 400);
  }
});
