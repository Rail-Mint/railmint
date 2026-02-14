import {
  BarChart3,
  FileText,
  Gift,
  LayoutGrid,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CreatorProfile, EpochInfo, RewardRow } from "@/hooks/useStudioData";

interface Props {
  profile: CreatorProfile;
  profileCompletion: number;
  recentPostsLast7Days: number;
  averageLikes: number;
  openEpoch: EpochInfo;
  rewardHistory: RewardRow[];
}

function formatDate(value?: string | null) {
  if (!value) return "--";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "--" : d.toLocaleDateString();
}

export function StudioOverview({
  profile,
  profileCompletion,
  recentPostsLast7Days,
  averageLikes,
  openEpoch,
  rewardHistory,
}: Props) {
  return (
    <div className="space-y-6">
      {/* Hero card */}
      <Card className="border-primary/20 bg-gradient-to-br from-card via-card to-primary/[0.04]">
        <CardHeader className="pb-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Creator Command Center
          </div>
        </CardHeader>
        <CardContent>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {profile?.clone_name ?? "Your"} Studio
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your AI clone, track engagement, and earn rewards.
          </p>
          {profile?.x_verified && (
            <Badge variant="outline" className="mt-2 border-green-500/40 text-green-600">
              ✓ X Verified
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Profile" value={`${profileCompletion}%`} progress={profileCompletion} />
        <StatCard label="Posts (7d)" value={String(recentPostsLast7Days)} />
        <StatCard label="Avg. Likes" value={averageLikes.toFixed(1)} />
        <StatCard
          label="Epoch"
          value={openEpoch ? `#${openEpoch.id}` : "None"}
          subtitle={openEpoch ? `Ends ${formatDate(openEpoch.end_at)}` : "No active epoch"}
          pulse={Boolean(openEpoch)}
        />
      </div>

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-3">
        <QuickAction to="/feed" icon={FileText} label="Open Feed" />
        <QuickAction to="/studio/content" icon={BarChart3} label="Review Content" />
        <QuickAction to="/studio/rewards" icon={Gift} label="Reward History" />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subtitle,
  progress,
  pulse,
}: {
  label: string;
  value: string;
  subtitle?: string;
  progress?: number;
  pulse?: boolean;
}) {
  return (
    <Card className="border-border/40">
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          {pulse && <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />}
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
        </div>
        <p className="mt-1 text-2xl font-bold">{value}</p>
        {progress !== undefined && (
          <div className="mt-2 h-1.5 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Button
      asChild
      variant="outline"
      className="h-auto justify-start gap-3 rounded-xl border-border/40 bg-card/60 py-4 hover:border-primary/30 hover:bg-primary/5"
    >
      <Link to={to}>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <span>{label}</span>
      </Link>
    </Button>
  );
}
