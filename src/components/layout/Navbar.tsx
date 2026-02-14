import { Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAccount } from "wagmi";
import { BrandMark } from "@/components/branding/BrandMark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { useContractStatus } from "@/hooks/useContractStatus";

const navLinks = [
	{ to: "/feed", label: "Feed" },
	{ to: "/leaderboard", label: "Leaderboard" },
	{ to: "/rewards", label: "Rewards" },
	{ to: "/onboarding", label: "Create Clone" },
];

export function Navbar() {
	const { theme, setTheme } = useTheme();
	const location = useLocation();
	const [mobileOpen, setMobileOpen] = useState(false);
	const { isConnected } = useAccount();
	const { mode, networkLabel } = useContractStatus();

	return (
		<header className="sticky top-0 z-50 border-b border-border/70 bg-background/72 backdrop-blur-md">
			<div className="container flex h-16 items-center justify-between">
				<Link
					to="/"
					className="transition-transform duration-200 hover:scale-[1.01]"
				>
					<BrandMark compact />
				</Link>

				{/* Desktop nav */}
				<nav className="hidden md:flex items-center gap-1">
					{navLinks.map((link) => (
						<Link
							key={link.to}
							to={link.to}
							className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-amber-100/60 dark:hover:bg-amber-500/10 ${
								location.pathname === link.to
									? "bg-gradient-to-r from-amber-100/70 to-amber-50/70 text-foreground dark:from-amber-500/20 dark:to-amber-400/10"
									: "text-muted-foreground"
							}`}
						>
							{link.label}
						</Link>
					))}
				</nav>

			<div className="flex items-center gap-2">
					<Badge
						variant="outline"
						className={`hidden text-[10px] font-semibold uppercase tracking-wider sm:inline-flex ${
							mode === "live"
								? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
								: "border-amber-500/40 bg-amber-500/10 text-amber-600"
						}`}
					>
						{networkLabel}
					</Badge>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
					>
						<Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
						<Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
					</Button>
					<div className="hidden md:block">
						{isConnected ? (
							<ConnectWalletButton compact />
						) : (
							<Button asChild size="sm" className="rounded-xl">
								<Link to="/studio">Login with Wallet</Link>
							</Button>
						)}
					</div>
					<Button
						variant="ghost"
						size="icon"
						className="md:hidden"
						onClick={() => setMobileOpen(!mobileOpen)}
					>
						{mobileOpen ? (
							<X className="h-5 w-5" />
						) : (
							<Menu className="h-5 w-5" />
						)}
					</Button>
				</div>
			</div>

			{/* Mobile nav */}
			{mobileOpen && (
				<div className="space-y-2 border-t border-border/70 bg-background/95 p-4 md:hidden">
					{navLinks.map((link) => (
						<Link
							key={link.to}
							to={link.to}
							onClick={() => setMobileOpen(false)}
							className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
								location.pathname === link.to
									? "bg-gradient-to-r from-amber-100/70 to-amber-50/70 text-foreground dark:from-amber-500/20 dark:to-amber-400/10"
									: "text-muted-foreground"
							}`}
						>
							{link.label}
						</Link>
					))}
					<div className="pt-2">
						{isConnected ? (
							<ConnectWalletButton compact className="w-full justify-center" />
						) : (
							<Button
								asChild
								className="w-full rounded-xl"
								onClick={() => setMobileOpen(false)}
							>
								<Link to="/studio">Login with Wallet</Link>
							</Button>
						)}
					</div>
				</div>
			)}
		</header>
	);
}
