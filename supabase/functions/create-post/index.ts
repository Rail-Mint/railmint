import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { keccak256, toBytes, verifyMessage } from "https://esm.sh/viem@2.21.0";

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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();

    const wallet_address = await verifyWalletSignature(body, "create-post");

    const content_text = String(body.content_text || "").trim();
    const content_html = String(body.content_html || "").trim();

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
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[create-post:${errorId}]`, e instanceof Error ? e.message : e);
    const msg = e instanceof Error && /signature|expired|wallet/i.test(e.message)
      ? e.message
      : "Failed to create post";
    return json({ error: msg, error_id: errorId }, 400);
  }
});
