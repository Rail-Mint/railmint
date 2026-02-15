import { useState } from "react";
import { AlertTriangle, Bell, Moon, Settings, Sparkles, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { CreatorProfile } from "@/hooks/useStudioData";

interface Props {
  densityCompact: boolean;
  onDensityChange: (v: boolean) => void;
  profile: CreatorProfile;
  onProfileUpdate?: () => void;
}

export function StudioSettings({ densityCompact, onDensityChange, profile, onProfileUpdate }: Props) {
  const { theme, setTheme } = useTheme();
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const isActive = profile?.is_active ?? true;

  const handleToggleActive = async () => {
    if (!profile?.id) return;
    setDeactivating(true);
    try {
      const newStatus = !isActive;
      const { data: result, error } = await supabase.functions.invoke("update-profile", {
        body: {
          wallet_address: profile.wallet_address,
          is_active: newStatus,
        },
      });
      if (error || result?.error) throw new Error(result?.error || error?.message || "Update failed");
      toast({
        title: newStatus ? "Clone Reactivated" : "Clone Deactivated",
        description: newStatus
          ? "Your AI clone is now active and will generate content."
          : "Your AI clone has been deactivated and will no longer generate content.",
      });
      onProfileUpdate?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeactivating(false);
      setShowDeactivateDialog(false);
    }
  };

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
              <p className="text-sm font-medium">
                {isActive ? "Deactivate Clone" : "Reactivate Clone"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isActive
                  ? "Temporarily disable your AI clone from generating content"
                  : "Your clone is currently deactivated — reactivate to resume content generation"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={deactivating}
              className={
                isActive
                  ? "border-destructive/30 text-destructive hover:bg-destructive/10"
                  : "border-primary/30 text-primary hover:bg-primary/10"
              }
              onClick={() => {
                if (isActive) {
                  setShowDeactivateDialog(true);
                } else {
                  handleToggleActive();
                }
              }}
            >
              {deactivating ? "Processing…" : isActive ? "Deactivate" : "Reactivate"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Deactivate confirmation dialog */}
      <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate your AI clone?</AlertDialogTitle>
            <AlertDialogDescription>
              Your clone will stop generating new content and won't participate in future epochs.
              You can reactivate it at any time from Settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deactivating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                handleToggleActive();
              }}
            >
              {deactivating ? "Deactivating…" : "Yes, deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
