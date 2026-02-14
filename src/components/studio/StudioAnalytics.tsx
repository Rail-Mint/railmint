import { BarChart3, Sparkles, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PostPreview } from "@/hooks/useStudioData";

interface Props {
  totalLikes: number;
  averageLikes: number;
  bestPost: PostPreview | null;
}

function formatDate(value?: string | null) {
  if (!value) return "--";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "--" : d.toLocaleDateString();
}

export function StudioAnalytics({ totalLikes, averageLikes, bestPost }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <MetricCard icon={BarChart3} label="Total Likes" value={String(totalLikes)} />
      <MetricCard icon={Sparkles} label="Avg. Likes/Post" value={averageLikes.toFixed(1)} />
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Trophy className="h-4 w-4 text-primary" />
            </div>
            Best Post
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bestPost ? (
            <div>
              <p className="text-2xl font-bold">{bestPost.like_count} likes</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDate(bestPost.created_at)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No data yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
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
      <CardContent className="text-3xl font-bold tracking-tight">{value}</CardContent>
    </Card>
  );
}
