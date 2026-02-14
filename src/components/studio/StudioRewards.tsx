import { Gift } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RewardRow } from "@/hooks/useStudioData";

interface Props {
  rewardHistory: RewardRow[];
}

export function StudioRewards({ rewardHistory }: Props) {
  const formatReward = (v: number | string) => Number(v || 0).toFixed(3);

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Gift className="h-5 w-5 text-primary" />
          Reward History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rewardHistory.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/40 bg-muted/20 p-8 text-center">
            <Gift className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No rewards yet.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {rewardHistory.slice(0, 10).map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-border/40 bg-card/60 p-4 transition-all hover:border-primary/30"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full font-bold ${
                        row.rank <= 3
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {row.rank}
                    </div>
                    <span className="font-medium">Epoch {row.epoch_id}</span>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    {formatReward(row.reward_amount)} tBNB
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{row.like_count} likes</p>
              </div>
            ))}
          </div>
        )}
        <Button asChild variant="outline" size="sm" className="rounded-xl">
          <Link to="/rewards">Full rewards board</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
