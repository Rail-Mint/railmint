import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { epoch_id, wallet_address } = await req.json();
    if (!epoch_id || !wallet_address) throw new Error("epoch_id and wallet_address required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Update epoch status
    const { error: updateErr } = await supabase
      .from("epochs")
      .update({ status: "closed" })
      .eq("id", epoch_id)
      .eq("status", "open");

    if (updateErr) throw updateErr;

    // Compute rankings: likes per creator for this epoch
    const { data: posts } = await supabase
      .from("posts")
      .select("id, creator_id")
      .eq("epoch_id", epoch_id);

    if (!posts || posts.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Epoch closed, no posts to rank" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const postIds = posts.map(p => p.id);
    const { data: likes } = await supabase.from("likes").select("post_id").in("post_id", postIds);
    const likesArr = likes || [];

    // Aggregate
    const creatorLikes: Record<string, number> = {};
    for (const p of posts) {
      if (!creatorLikes[p.creator_id]) creatorLikes[p.creator_id] = 0;
      creatorLikes[p.creator_id] += likesArr.filter(l => l.post_id === p.id).length;
    }

    const ranked = Object.entries(creatorLikes)
      .sort(([, a], [, b]) => b - a)
      .map(([creator_id, like_count], i) => ({
        epoch_id,
        creator_id,
        rank: i + 1,
        like_count,
        reward_amount: 0,
      }));

    // Get epoch pool
    const { data: epoch } = await supabase.from("epochs").select("reward_pool").eq("id", epoch_id).single();
    const pool = Number(epoch?.reward_pool || 0);

    // Distribute rewards: 50% rank 1, 30% rank 2, 20% rank 3
    const shares = [0.5, 0.3, 0.2];
    for (let i = 0; i < ranked.length && i < shares.length; i++) {
      ranked[i].reward_amount = pool * shares[i];
    }

    // Insert reward records
    if (ranked.length > 0) {
      await supabase.from("epoch_rewards").insert(ranked);
    }

    return new Response(JSON.stringify({ success: true, rankings: ranked }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("close-epoch error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
