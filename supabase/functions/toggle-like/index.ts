import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyMessage } from "https://esm.sh/viem@2.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  // Reject signatures older than 5 minutes
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

    const wallet_address = await verifyWalletSignature(body, "toggle-like");

    const post_id = String(body.post_id || "").trim();
    const action = String(body.action || "toggle").trim();

    if (!UUID_RE.test(post_id)) {
      return json({ error: "Invalid post ID format" }, 400);
    }
    if (!["like", "unlike", "toggle"].includes(action)) {
      return json({ error: "Invalid action. Use 'like', 'unlike', or 'toggle'" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Check if post exists
    const { data: post } = await supabase
      .from("posts")
      .select("id")
      .eq("id", post_id)
      .single();

    if (!post) {
      return json({ error: "Post not found" }, 404);
    }

    // Check existing like
    const { data: existingLike } = await supabase
      .from("likes")
      .select("id")
      .eq("post_id", post_id)
      .eq("wallet_address", wallet_address)
      .maybeSingle();

    let liked: boolean;

    if (action === "toggle") {
      if (existingLike) {
        await supabase.from("likes").delete().eq("id", existingLike.id);
        liked = false;
      } else {
        await supabase.from("likes").insert({ post_id, wallet_address });
        liked = true;
      }
    } else if (action === "like") {
      if (!existingLike) {
        await supabase.from("likes").insert({ post_id, wallet_address });
      }
      liked = true;
    } else {
      if (existingLike) {
        await supabase.from("likes").delete().eq("id", existingLike.id);
      }
      liked = false;
    }

    return json({ success: true, liked });
  } catch (e) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[toggle-like:${errorId}]`, e instanceof Error ? e.message : e);
    const msg = e instanceof Error && /signature|expired|wallet/i.test(e.message)
      ? e.message
      : "Operation failed";
    return json({ error: msg, error_id: errorId }, 400);
  }
});
