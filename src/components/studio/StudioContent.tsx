import { CheckCircle2, ExternalLink, FileText, Filter, Hash, Loader2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [epochFilter, setEpochFilter] = useState<string>("all");

  const epochs = useMemo(() => {
    const set = new Set(recentPosts.map((p) => p.epoch_id));
    return [...set].sort((a, b) => b - a);
  }, [recentPosts]);

  const filteredPosts = useMemo(() => {
    if (epochFilter === "all") return recentPosts;
    return recentPosts.filter((p) => String(p.epoch_id) === epochFilter);
  }, [recentPosts, epochFilter]);

  const totalLikes = recentPosts.reduce((s, p) => s + p.like_count, 0);
  const committedCount = recentPosts.filter((p) => p.commit_tx_hash).length;

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
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatChip label="Total Posts" value={String(recentPosts.length)} icon={<FileText className="h-4 w-4" />} />
        <StatChip label="Total Likes" value={String(totalLikes)} icon={<Sparkles className="h-4 w-4" />} />
        <StatChip label="On-chain" value={`${committedCount}/${recentPosts.length}`} icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      {/* Content card */}
      <Card className="border-border/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Content
          </CardTitle>
          <div className="flex items-center gap-2">
            {epochs.length > 1 && (
              <Select value={epochFilter} onValueChange={setEpochFilter}>
                <SelectTrigger className="h-8 w-[130px] text-xs border-border/40">
                  <Filter className="mr-1 h-3 w-3" />
                  <SelectValue placeholder="All epochs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All epochs</SelectItem>
                  {epochs.map((e) => (
                    <SelectItem key={e} value={String(e)}>Epoch {e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredPosts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/40 bg-muted/20 p-8 text-center">
              <Sparkles className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {epochFilter !== "all" ? "No posts in this epoch." : "No content yet. Hit \"Generate Post\" to create your first AI post."}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredPosts.slice(0, 8).map((post) => (
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
                    <div className="flex items-center gap-2">
                      {post.commit_tx_hash && (
                        <span className="flex items-center gap-1 text-[10px] text-primary">
                          <CheckCircle2 className="h-3 w-3" /> On-chain
                        </span>
                      )}
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Epoch {post.epoch_id}
                      </span>
                    </div>
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
    </div>
  );
}

function StatChip({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="border-border/40">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
