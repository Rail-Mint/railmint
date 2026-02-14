import { CheckCircle2, ExternalLink, Globe, Lock, Shield, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useContractStatus } from "@/hooks/useContractStatus";
import type { CreatorProfile } from "@/hooks/useStudioData";

interface Props {
  address: string | undefined;
  profile: CreatorProfile;
}

export function StudioSecurity({ address, profile }: Props) {
  const { mode, networkLabel } = useContractStatus();

  const securityChecks = [
    { label: "Wallet Connected", ok: Boolean(address), detail: address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Not connected" },
    { label: "Profile Created", ok: Boolean(profile), detail: profile ? profile.clone_name : "No profile" },
    { label: "X Verified", ok: Boolean(profile?.x_verified), detail: profile?.x_verified ? `Verified at ${new Date(profile.x_verified_at ?? "").toLocaleDateString()}` : "Not verified" },
    { label: "On-chain Registered", ok: mode === "live", detail: mode === "live" ? "Contracts deployed" : "Mock mode active" },
  ];

  const score = securityChecks.filter((c) => c.ok).length;

  return (
    <div className="space-y-6">
      {/* Security Score */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" />
            Security Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-muted/30"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="text-primary"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray={`${(score / securityChecks.length) * 100}, 100`}
                />
              </svg>
              <span className="absolute text-lg font-bold">{score}/{securityChecks.length}</span>
            </div>
            <div className="flex-1 space-y-2">
              {securityChecks.map((check) => (
                <div key={check.label} className="flex items-center gap-2">
                  <CheckCircle2 className={`h-4 w-4 ${check.ok ? "text-primary" : "text-muted-foreground/40"}`} />
                  <span className={`text-sm ${check.ok ? "text-foreground" : "text-muted-foreground"}`}>{check.label}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session Info */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            <Wallet className="h-4 w-4" />
            Active Session
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="Wallet Address" value={address ?? "Not connected"} mono />
          <InfoRow label="Network" value={networkLabel} />
          <InfoRow label="Contract Mode">
            <Badge variant={mode === "live" ? "default" : "secondary"}>
              {mode === "live" ? "Live" : "Mock"}
            </Badge>
          </InfoRow>
        </CardContent>
      </Card>

      {/* Verification Details */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            <Lock className="h-4 w-4" />
            Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {securityChecks.map((check) => (
            <div key={check.label} className="flex items-center justify-between rounded-xl border border-border/40 bg-card/60 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`h-4 w-4 ${check.ok ? "text-primary" : "text-muted-foreground/40"}`} />
                <span className="text-sm font-medium">{check.label}</span>
              </div>
              <span className="text-xs text-muted-foreground">{check.detail}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Data Protection */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            <Globe className="h-4 w-4" />
            Data Protection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            All data is stored with row-level security policies. Your profile and content are only accessible through your connected wallet.
          </p>
          <p className="text-sm text-muted-foreground">
            Post content is hashed on-chain for tamper-proof verification. Rewards are distributed via smart contracts on the BNB network.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
  children,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/40 bg-card/60 p-3">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children ?? <span className={`text-sm font-medium ${mono ? "font-mono" : ""} break-all`}>{value}</span>}
    </div>
  );
}
