import { Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useContractStatus } from "@/hooks/useContractStatus";

interface Props {
  address: string | undefined;
}

export function StudioSecurity({ address }: Props) {
  const { mode, networkLabel } = useContractStatus();

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-primary" />
          Security & Access
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border/40 bg-card/60 p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Active Session
          </p>
          <p className="text-sm font-mono break-all">{address ?? "Not connected"}</p>
        </div>
        <div className="rounded-xl border border-border/40 bg-card/60 p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Contract Mode
          </p>
          <div className="flex items-center gap-2">
            <Badge variant={mode === "live" ? "default" : "secondary"}>
              {mode === "live" ? "Live" : "Mock"}
            </Badge>
            <span className="text-sm text-muted-foreground">{networkLabel}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
