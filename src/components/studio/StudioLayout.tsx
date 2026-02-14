import { Menu, Sparkles } from "lucide-react";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { BrandMark } from "@/components/branding/BrandMark";
import { Button } from "@/components/ui/button";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { MobileStudioSidebar, StudioSidebar } from "./StudioSidebar";

const sectionTitles: Record<string, string> = {
  overview: "Overview",
  profile: "Profile",
  content: "Content",
  analytics: "Analytics",
  leaderboard: "Leaderboard",
  rewards: "Rewards",
  wallet: "Wallet",
  security: "Security",
  settings: "Settings",
};

interface StudioLayoutProps {
  children: React.ReactNode;
  profileName?: string | null;
}

export function StudioLayout({ children, profileName }: StudioLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const segment = location.pathname.split("/")[2] || "overview";
  const sectionTitle = sectionTitles[segment] ?? "Overview";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Subtle background effects */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,hsl(var(--primary)/0.08),transparent_36%),radial-gradient(circle_at_88%_0%,hsl(var(--accent)/0.06),transparent_32%)]" />

      <div className="relative flex min-h-screen">
        <StudioSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((v) => !v)}
        />
        <MobileStudioSidebar
          open={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        />

        <main className="flex-1">
          {/* Header */}
          <header className="sticky top-0 z-30 px-3 pt-3 sm:px-6">
            <div className="flex h-14 items-center justify-between rounded-2xl border border-border/30 bg-card/80 px-3 shadow-sm backdrop-blur-xl sm:px-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setMobileSidebarOpen(true)}
                >
                  <Menu className="h-4 w-4" />
                </Button>
                <div className="hidden sm:block">
                  <BrandMark compact />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {profileName ? `${profileName}'s Studio` : "Creator Studio"}
                  </p>
                  <h1 className="text-lg font-semibold">{sectionTitle}</h1>
                </div>
              </div>
              <ConnectWalletButton compact />
            </div>
          </header>

          {/* Content */}
          <div className="space-y-6 p-5 sm:p-7">{children}</div>
        </main>
      </div>
    </div>
  );
}
