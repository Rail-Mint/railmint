import { motion } from "framer-motion";
import {
  BarChart3,
  ChevronLeft,
  Circle,
  ExternalLink,
  FileText,
  Gift,
  LayoutGrid,
  Settings,
  Shield,
  Trophy,
  UserCog,
  WalletCards,
  X,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAccount, useChainId } from "wagmi";
import { BrandMark } from "@/components/branding/BrandMark";
import { Button } from "@/components/ui/button";
import { useContractStatus } from "@/hooks/useContractStatus";

type NavItem = {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { key: "overview", label: "Overview", description: "Dashboard summary", icon: LayoutGrid },
  { key: "profile", label: "Profile", description: "Clone identity", icon: UserCog },
  { key: "content", label: "Content", description: "AI publishing", icon: FileText },
  { key: "analytics", label: "Analytics", description: "Engagement metrics", icon: BarChart3 },
  { key: "leaderboard", label: "Leaderboard", description: "Epoch rankings", icon: Trophy },
  { key: "rewards", label: "Rewards", description: "Payout history", icon: Gift },
  { key: "wallet", label: "Wallet", description: "Connected address", icon: WalletCards },
  { key: "security", label: "Security", description: "Access controls", icon: Shield },
  { key: "settings", label: "Settings", description: "Preferences", icon: Settings },
];

function navHref(key: string) {
  return key === "overview" ? "/studio" : `/studio/${key}`;
}

interface StudioSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function StudioSidebar({ collapsed, onToggle }: StudioSidebarProps) {
  const location = useLocation();
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { mode, networkLabel, isDeployed } = useContractStatus();
  const segment = location.pathname.split("/")[2] || "overview";
  const activeKey = navItems.find((i) => i.key === segment)?.key ?? "overview";

  return (
    <aside
      className={`hidden shrink-0 overflow-hidden rounded-2xl m-3 ml-0 my-3 border border-border/20 bg-gradient-to-b from-card/90 via-card/95 to-primary/[0.03] backdrop-blur-2xl shadow-xl transition-[width,opacity] duration-500 ease-out md:flex md:flex-col ${
        collapsed ? "w-[72px]" : "w-[260px]"
      }`}
    >
      <div className="flex h-16 items-center justify-between border-b border-border/20 px-3">
        <div className="flex items-center gap-2">
          {collapsed ? <BrandMark compact markOnly /> : <BrandMark />}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          title={collapsed ? "Expand panel" : "Collapse panel"}
          className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-primary"
        >
          <motion.div
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <ChevronLeft className="h-4 w-4" />
          </motion.div>
        </Button>
      </div>

      <nav className="space-y-1.5 px-3 pb-4 pt-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeKey === item.key;
          return (
            <Link
              key={item.key}
              to={navHref(item.key)}
              className={`group relative flex items-center gap-3 overflow-hidden rounded-xl py-2.5 text-sm transition-all duration-200 ${
                isActive
                  ? "border border-primary/30 bg-primary/10 text-foreground shadow-sm"
                  : "border border-transparent text-muted-foreground hover:border-primary/20 hover:bg-primary/5 hover:text-foreground"
              } ${collapsed ? "justify-center px-2" : "px-3"}`}
              title={collapsed ? item.label : undefined}
            >
              {isActive && (
                <motion.span
                  layoutId="studio-sidebar-active"
                  className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/30"
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}
                />
              )}
              <Icon
                className={`relative z-10 h-5 w-5 shrink-0 transition-all duration-200 ${
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                }`}
              />
              {!collapsed && (
                <div className="relative z-10 min-w-0">
                  <p className={`truncate font-medium leading-tight ${isActive ? "text-foreground" : ""}`}>
                    {item.label}
                  </p>
                  <p className="truncate text-[11px] leading-tight text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Network status */}
      <div className="mt-auto border-t border-border/20 px-3 py-3">
        {collapsed ? (
          <div className="flex flex-col items-center gap-1.5" title={`${networkLabel} · ${isConnected ? `Chain ${chainId}` : "Disconnected"}`}>
            <Circle className={`h-2.5 w-2.5 fill-current ${isConnected ? "text-emerald-500" : "text-muted-foreground/50"}`} />
            <Circle className={`h-2.5 w-2.5 fill-current ${mode === "live" ? "text-emerald-500" : "text-amber-500"}`} />
          </div>
        ) : (
          <div className="space-y-1.5 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Circle className={`h-2 w-2 fill-current ${isConnected ? "text-emerald-500" : "text-muted-foreground/50"}`} />
              {isConnected ? `Chain ${chainId}` : "Wallet disconnected"}
            </div>
            <div className="flex items-center gap-1.5">
              <Circle className={`h-2 w-2 fill-current ${mode === "live" ? "text-emerald-500" : "text-amber-500"}`} />
              <span>{networkLabel}</span>
              {isDeployed && (
                <a
                  href="https://testnet.bscscan.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-0.5 text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  Verify <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function MobileStudioSidebar({ open, onClose }: MobileSidebarProps) {
  const location = useLocation();
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { mode, networkLabel, isDeployed } = useContractStatus();
  const segment = location.pathname.split("/")[2] || "overview";
  const activeKey = navItems.find((i) => i.key === segment)?.key ?? "overview";

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute left-0 top-0 h-full w-72 border-r border-border/50 bg-card p-3">
        <div className="mb-2 flex h-12 items-center justify-between border-b border-border/20 pb-2">
          <BrandMark />
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeKey === item.key;
            return (
              <Link
                key={item.key}
                to={navHref(item.key)}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
                  isActive
                    ? "border border-primary/30 bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Mobile network status */}
        <div className="mt-4 border-t border-border/20 pt-3 px-1 space-y-1.5 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Circle className={`h-2 w-2 fill-current ${isConnected ? "text-emerald-500" : "text-muted-foreground/50"}`} />
            {isConnected ? `Chain ${chainId}` : "Wallet disconnected"}
          </div>
          <div className="flex items-center gap-1.5">
            <Circle className={`h-2 w-2 fill-current ${mode === "live" ? "text-emerald-500" : "text-amber-500"}`} />
            <span>{networkLabel}</span>
            {isDeployed && (
              <a
                href="https://testnet.bscscan.com"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-0.5 text-emerald-600 hover:underline dark:text-emerald-400"
              >
                Verify <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
