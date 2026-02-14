import { Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

interface Props {
  densityCompact: boolean;
  onDensityChange: (v: boolean) => void;
}

export function StudioSettings({ densityCompact, onDensityChange }: Props) {
  return (
    <Card className="border-border/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings className="h-5 w-5 text-primary" />
          Studio Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center justify-between rounded-xl border border-border/40 bg-card/60 p-4 cursor-pointer">
          <div>
            <p className="text-sm font-medium">Compact Density</p>
            <p className="text-xs text-muted-foreground">Reduce spacing in studio views</p>
          </div>
          <Switch checked={densityCompact} onCheckedChange={onDensityChange} />
        </label>
      </CardContent>
    </Card>
  );
}
