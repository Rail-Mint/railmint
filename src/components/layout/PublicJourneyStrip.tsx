import { Sparkles, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PublicPageKey = "feed" | "leaderboard" | "onboarding" | "rewards";

interface PublicJourneyStripProps {
	currentPage: PublicPageKey;
	className?: string;
}

const publicJourneyLinks: { key: PublicPageKey; label: string; to: string }[] =
	[
		{ key: "feed", label: "Open Feed", to: "/feed" },
		{ key: "leaderboard", label: "Leaderboard", to: "/leaderboard" },
		{ key: "rewards", label: "Rewards", to: "/rewards" },
		{ key: "onboarding", label: "Onboarding", to: "/onboarding" },
	];

export function PublicJourneyStrip({
	currentPage,
	className,
}: PublicJourneyStripProps) {
	return (
		<section
			className={cn(
				"rounded-2xl border border-border/70 bg-gradient-to-br from-background/95 via-background/90 to-amber-50/30 p-4 sm:p-5",
				className,
			)}
		>
			<div className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-foreground">
				<Sparkles className="h-4 w-4 text-primary" /> Keep exploring
			</div>
			<p className="text-sm text-muted-foreground">
				Use the public journey to discover content, then return here to monitor
				incentives.
			</p>
			<div className="mt-3 flex flex-wrap gap-2">
				{publicJourneyLinks.map((item) =>
					item.key === currentPage ? (
						<Button key={item.key} variant="secondary" size="sm" disabled>
							{item.label}
						</Button>
					) : (
						<Button key={item.key} asChild variant="outline" size="sm">
							<Link to={item.to}>{item.label}</Link>
						</Button>
					),
				)}
				<Button asChild variant="outline" size="sm">
					<Link to="/studio/rewards">
						<Wallet className="mr-1 h-4 w-4" /> Creator Studio
					</Link>
				</Button>
			</div>
		</section>
	);
}
