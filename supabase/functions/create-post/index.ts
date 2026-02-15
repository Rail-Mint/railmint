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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const wallet_address = String(body.wallet_address || "").trim();
    const content_text = String(body.content_text || "").trim();
    const content_html = String(body.content_html || "").trim();

    // --- Input validation ---
    if (!WALLET_RE.test(wallet_address)) {
      return json({ error: "Invalid wallet address format" }, 400);
    }
    if (!content_text || content_text.length < 1 || content_text.length > 10000) {
      return json({ error: "Content text must be 1-10000 characters" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify creator ownership
    const { data: creator, error: creatorErr } = await supabase
      .from("creators")
      .select("id, wallet_address")
      .ilike("wallet_address", wallet_address)
      .single();

    if (creatorErr || !creator) {
      return json({ error: "Creator not found for this wallet" }, 403);
    }

    // Get current active/open epoch
    const { data: epoch } = await supabase
      .from("epochs")
      .select("id")
      .in("status", ["open", "active"])
      .order("id", { ascending: false })
      .limit(1)
      .single();

    const epochId = epoch?.id || 1;
    const postId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const promptText = "Manual post from Studio";

    const promptHash = keccak256(
      toBytes("GOODVIBES_PROMPT_V1\n" + postId + "\n" + creator.id + "\n" + promptText),
    );
    const contentHash = keccak256(
      toBytes("GOODVIBES_CONTENT_V1\n" + postId + "\n" + content_text),
    );
    const metaHash = keccak256(
      toBytes("GOODVIBES_META_V1\nmanual\n" + createdAt + "\n" + wallet_address),
    );

    const { error: insertErr } = await supabase.from("posts").insert({
      id: postId,
      creator_id: creator.id,
      epoch_id: epochId,
      prompt_text: promptText,
      content_text,
      prompt_hash: promptHash,
      content_hash: contentHash,
      meta_hash: metaHash,
      is_fallback: false,
      created_at: createdAt,
    });

    if (insertErr) throw insertErr;

    return json({ success: true, post_id: postId });
  } catch (e) {
    console.error("create-post error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 400);
  }
});
