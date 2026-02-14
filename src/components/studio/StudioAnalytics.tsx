import { BarChart3, Hash, Heart, Sparkles, TrendingUp, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PostPreview, RewardRow, StudioStats } from "@/hooks/useStudioData";

interface Props {
  totalLikes: number;
  averageLikes: number;
  bestPost: PostPreview | null;
  stats: StudioStats;
  recentPosts: PostPreview[];
  rewardHistory: RewardRow[];
}

function formatDate(value?: string | null) {
  if (!value) return "--";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "--" : d.toLocaleDateString();
}

export function StudioAnalytics({ totalLikes, averageLikes, bestPost, stats, recentPosts, rewardHistory }: Props) {
  const totalRewards = rewardHistory.reduce((sum, r) => sum + Number(r.reward_amount), 0);
  const bestRank = rewardHistory.length ? Math.min(...rewardHistory.map((r) => r.rank)) : null;
  const epochsParticipated = new Set(rewardHistory.map((r) => r.epoch_id)).size;
  const postsWithLikes = recentPosts.filter((p) => p.like_count > 0).length;
  const engagementRate = recentPosts.length ? Math.round((postsWithLikes / recentPosts.length) * 100) : 0;

  // Likes per epoch breakdown
  const epochLikeMap = new Map<number, number>();
  for (const p of recentPosts) {
    epochLikeMap.set(p.epoch_id, (epochLikeMap.get(p.epoch_id) ?? 0) + p.like_count);
  }
  const topEpochs = [...epochLikeMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Primary metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Heart} label="Total Likes" value={String(totalLikes)} />
        <MetricCard icon={Sparkles} label="Avg. Likes/Post" value={averageLikes.toFixed(1)} />
        <MetricCard icon={Hash} label="Total Posts" value={String(stats.postsCount)} />
        <MetricCard icon={TrendingUp} label="Engagement Rate" value={`${engagementRate}%`} subtitle={`${postsWithLikes}/${recentPosts.length} posts liked`} />
      </div>

      {/* Secondary metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard icon={Trophy} label="Best Rank" value={bestRank ? `#${bestRank}` : "--"} />
        <MetricCard icon={BarChart3} label="Total Rewards" value={totalRewards > 0 ? totalRewards.toFixed(4) : "0"} subtitle="BNB earned" />
        <MetricCard icon={Hash} label="Epochs" value={String(epochsParticipated)} subtitle="participated in" />
      </div>

      {/* Best post card */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            <Trophy className="h-4 w-4 text-primary" />
            Best Performing Post
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bestPost ? (
            <div className="space-y-2">
              <p className="text-sm line-clamp-3">{bestPost.content_text}</p>
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold text-primary">{bestPost.like_count}</span>
                <span className="text-sm text-muted-foreground">likes</span>
                <span className="text-xs text-muted-foreground">• {formatDate(bestPost.created_at)}</span>
                <span className="text-xs text-muted-foreground">• Epoch {bestPost.epoch_id}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No data yet</p>
          )}
        </CardContent>
      </Card>

      {/* Likes per epoch table */}
      {topEpochs.length > 0 && (
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Likes by Epoch (Top 5)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topEpochs.map(([epochId, likes]) => {
                const maxLikes = topEpochs[0][1] || 1;
                return (
                  <div key={epochId} className="flex items-center gap-3">
                    <span className="w-16 text-xs font-medium text-muted-foreground">Epoch {epochId}</span>
                    <div className="flex-1 h-5 rounded-full bg-muted/30 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/60 transition-all"
                        style={{ width: `${(likes / maxLikes) * 100}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-sm font-bold">{likes}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <Card className="border-border/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tracking-tight">{value}</p>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
