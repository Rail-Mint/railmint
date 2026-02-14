import { WalletCards } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CreatorProfile, StudioStats } from "@/hooks/useStudioData";

interface Props {
  address: string | undefined;
  profile: CreatorProfile;
  stats: StudioStats;
}

export function StudioWallet({ address, profile, stats }: Props) {
  return (
    <Card className="border-border/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <WalletCards className="h-5 w-5 text-primary" />
          Wallet & Payout
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <InfoBlock label="Connected Wallet" value={address ?? "--"} mono />
        <InfoBlock
          label="Payout Wallet"
          value={profile?.wallet_address ?? "--"}
          mono
          highlight
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoBlock label="Total Posts" value={String(stats.postsCount)} />
          <InfoBlock label="Reward Epochs" value={String(stats.rewardRows)} />
        </div>
      </CardContent>
    </Card>
  );
}

function InfoBlock({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight ? "border-primary/30 bg-primary/5" : "border-border/40 bg-card/60"
      }`}
    >
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`text-sm font-medium ${mono ? "font-mono" : ""} break-all`}>{value}</p>
    </div>
  );
}
