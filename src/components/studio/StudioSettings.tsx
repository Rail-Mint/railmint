import { AlertTriangle, Bell, Moon, Settings, Sparkles, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

interface Props {
  densityCompact: boolean;
  onDensityChange: (v: boolean) => void;
}

export function StudioSettings({ densityCompact, onDensityChange }: Props) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      {/* Appearance */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5 text-primary" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <SettingRow
            icon={theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            title="Dark Mode"
            description="Toggle between light and dark themes"
          >
            <Switch
              checked={theme === "dark"}
              onCheckedChange={(v) => setTheme(v ? "dark" : "light")}
            />
          </SettingRow>
          <SettingRow
            icon={<Settings className="h-4 w-4" />}
            title="Compact Density"
            description="Reduce spacing in studio views"
          >
            <Switch checked={densityCompact} onCheckedChange={onDensityChange} />
          </SettingRow>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5 text-primary" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <SettingRow
            icon={<Sparkles className="h-4 w-4" />}
            title="Post Generation Alerts"
            description="Get notified when your AI clone generates new content"
          >
            <Switch defaultChecked />
          </SettingRow>
          <SettingRow
            icon={<Bell className="h-4 w-4" />}
            title="Epoch Rewards"
            description="Notify when epoch closes and rewards are distributed"
          >
            <Switch defaultChecked />
          </SettingRow>
        </CardContent>
      </Card>

      {/* Content generation */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Content Generation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <SettingRow
            icon={<Sparkles className="h-4 w-4" />}
            title="Auto-generate Posts"
            description="Let your AI clone automatically generate posts each epoch"
          >
            <Switch defaultChecked />
          </SettingRow>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 p-4">
            <div>
              <p className="text-sm font-medium">Deactivate Clone</p>
              <p className="text-xs text-muted-foreground">
                Temporarily disable your AI clone from generating content
              </p>
            </div>
            <Button variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/10">
              Deactivate
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingRow({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-border/40 bg-card/60 p-4 cursor-pointer">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </label>
  );
}
