import { Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RewardRow } from "@/hooks/useStudioData";

interface Props {
  topOpenRows: RewardRow[];
}

export function StudioLeaderboard({ topOpenRows }: Props) {
  const shortAddr = (w?: string | null) => (w ? `${w.slice(0, 6)}...${w.slice(-4)}` : "--");

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-primary" />
          Epoch Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {topOpenRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/40 bg-muted/20 p-8 text-center">
            <Trophy className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No leaderboard data yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {topOpenRows.map((row) => (
              <div
                key={row.id}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                  row.rank <= 3
                    ? "border-primary/30 bg-primary/5"
                    : "border-border/40 bg-card/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${
                      row.rank === 1
                        ? "bg-primary text-primary-foreground"
                        : row.rank === 2
                          ? "bg-muted-foreground/30 text-foreground"
                          : row.rank === 3
                            ? "bg-primary/60 text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {row.rank}
                  </div>
                  <p className="font-medium">
                    {row.creator?.clone_name ?? shortAddr(row.creator?.wallet_address)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {row.like_count}
                  </span>
                  <span className="text-xs text-muted-foreground">likes</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <Button asChild variant="outline" size="sm" className="rounded-xl">
          <Link to="/leaderboard">Full leaderboard</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
