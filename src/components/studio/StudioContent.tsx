import { FileText, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { keccak256, toHex } from "viem";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { usePublishContent } from "@/hooks/useContentManager";
import { supabase } from "@/integrations/supabase/client";
import type { CreatorProfile, PostPreview } from "@/hooks/useStudioData";

interface Props {
  profile: CreatorProfile;
  address: string | undefined;
  recentPosts: PostPreview[];
  onPostsUpdate: (posts: PostPreview[]) => void;
}

export function StudioContent({ profile, address, recentPosts, onPostsUpdate }: Props) {
  const { toast } = useToast();
  const { publishContent, isPending: isTxPending, isConfirming: isTxConfirming } =
    usePublishContent();
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    if (!address || !profile) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-post", {
        body: { wallet_address: address },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const { data: posts } = await supabase
        .from("posts")
        .select("id, content_text, created_at, epoch_id, commit_tx_hash")
        .eq("creator_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (posts?.length) {
        onPostsUpdate(posts.map((p) => ({ ...p, like_count: 0 })));
      }

      toast({ title: "Post generated!", description: "Your AI clone created new content." });
    } catch (err: any) {
      toast({
        title: "Generation failed",
        description: err.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card className="border-border/40">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-primary" />
          Content
        </CardTitle>
        <Button
          onClick={handleGenerate}
          disabled={generating || isTxPending || isTxConfirming || !profile}
          size="sm"
          className="gap-2"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {generating ? "Generating…" : "Generate Post"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {recentPosts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/40 bg-muted/20 p-8 text-center">
            <Sparkles className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No content yet. Hit "Generate Post" to create your first AI post.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {recentPosts.slice(0, 8).map((post) => (
              <Link
                key={post.id}
                to={`/post/${post.id}`}
                className="group rounded-2xl border border-border/40 bg-card/60 p-4 transition-all hover:border-primary/30 hover:shadow-md"
              >
                <p className="line-clamp-3 text-sm">{post.content_text}</p>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {post.like_count}
                    </span>
                    <span className="text-xs text-muted-foreground">likes</span>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Epoch {post.epoch_id}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
        <Button asChild variant="outline" size="sm" className="rounded-xl">
          <Link to="/feed">Open Feed</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
