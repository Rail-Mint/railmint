import {
	ArrowRight,
	CalendarDays,
	Coins,
	Compass,
	Eye,
	ExternalLink,
	Gift,
	Sparkles,
	TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAccount } from "wagmi";
import { PublicJourneyStrip } from "@/components/layout/PublicJourneyStrip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { supabase } from "@/integrations/supabase/client";
import { formatFixed, toFiniteNumber } from "@/lib/format-number";
import { getExplorerUrl } from "@/lib/mock-contract";

interface RewardEpoch {
	id: number;
	status: "open" | "closed" | "paid" | string;
	reward_pool: number | string;
	end_at: string;
	payout_tx_hash: string | null;
}

interface RewardCreator {
	id: string;
	clone_name: string | null;
	wallet_address: string | null;
}

interface RewardRow {
	id: string;
	epoch_id: number;
	rank: number;
	like_count: number;
	reward_amount: number | string;
	creator: RewardCreator | null;
	epoch: RewardEpoch | null;
}

function statusTone(status: string) {
	if (status === "open")
		return "bg-emerald-500/15 text-emerald-600 border-emerald-500/35";
	if (status === "closed")
		return "bg-amber-500/15 text-amber-600 border-amber-500/35";
	if (status === "paid") return "bg-sky-500/15 text-sky-600 border-sky-500/35";
	return "bg-secondary text-muted-foreground border-border";
}

function shortAddress(address?: string | null) {
	if (!address) return "-";
	return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function toRewardNumber(value: number | string | null | undefined) {
	return toFiniteNumber(value ?? 0);
}

export default function Rewards() {
	const { address, isConnected } = useAccount();
	const [loading, setLoading] = useState(true);
	const [epochs, setEpochs] = useState<RewardEpoch[]>([]);
	const [rewards, setRewards] = useState<RewardRow[]>([]);
	const [selectedEpochId, setSelectedEpochId] = useState<number | null>(null);
	const [creatorId, setCreatorId] = useState<string | null>(null);
	const [creatorName, setCreatorName] = useState("Your Studio");
	const [recentPosts, setRecentPosts] = useState(0);

	useEffect(() => {
		let mounted = true;

		async function load() {
			setLoading(true);
			const [epochsResult, rewardsResult] = await Promise.all([
				supabase
					.from("epochs")
					.select("id, status, reward_pool, end_at, payout_tx_hash")
					.order("id", { ascending: false }),
				supabase
					.from("epoch_rewards")
					.select(
						"id, epoch_id, rank, like_count, reward_amount, creator:creators(id, clone_name, wallet_address), epoch:epochs(id, status, reward_pool, end_at, payout_tx_hash)",
					)
					.order("epoch_id", { ascending: false })
					.order("rank", { ascending: true }),
			]);

			if (!mounted) return;
			if (!epochsResult.error && epochsResult.data) {
				setEpochs((epochsResult.data as RewardEpoch[]) ?? []);
				const initial =
					epochsResult.data.find((epoch) => epoch.status === "open") ??
					epochsResult.data[0];
				setSelectedEpochId(initial?.id ?? null);
			}

			if (!rewardsResult.error && rewardsResult.data) {
				setRewards((rewardsResult.data as RewardRow[]) ?? []);
			}

			if (address) {
				const creatorResult = await supabase
					.from("creators")
					.select("id, clone_name")
					.ilike("wallet_address", address)
					.maybeSingle();

				if (creatorResult.data) {
					setCreatorId(creatorResult.data.id);
					setCreatorName(creatorResult.data.clone_name || "Your Studio");

					const weekAgo = new Date();
					weekAgo.setDate(weekAgo.getDate() - 7);
					const postsResult = await supabase
						.from("posts")
						.select("id", { count: "exact", head: true })
						.eq("creator_id", creatorResult.data.id)
						.gte("created_at", weekAgo.toISOString());

					if (mounted) {
						setRecentPosts(postsResult.count ?? 0);
					}
				} else {
					setCreatorId(null);
					setCreatorName("Your Studio");
					setRecentPosts(0);
				}
			} else {
				setCreatorId(null);
				setCreatorName("Your Studio");
				setRecentPosts(0);
			}

			if (mounted) setLoading(false);
		}

		void load();

		return () => {
			mounted = false;
		};
	}, [address]);

	const selectedEpoch = useMemo(
		() => epochs.find((epoch) => epoch.id === selectedEpochId) ?? null,
		[epochs, selectedEpochId],
	);

	const selectedRows = useMemo(
		() => rewards.filter((row) => row.epoch_id === selectedEpochId),
		[rewards, selectedEpochId],
	);

	const topRows = useMemo(() => selectedRows.slice(0, 5), [selectedRows]);
	const topWalletRows = useMemo(() => selectedRows.slice(0, 4), [selectedRows]);

	const userRow = useMemo(() => {
		if (!creatorId) return null;
		return selectedRows.find((row) => row.creator?.id === creatorId) ?? null;
	}, [selectedRows, creatorId]);

	const pool = toRewardNumber(selectedEpoch?.reward_pool);
	const uniqueCreators = useMemo(() => {
		return new Set(selectedRows.map((row) => row.creator?.id).filter(Boolean))
			.size;
	}, [selectedRows]);

	const rankTargetLikes = useMemo(() => {
		const rankFive = selectedRows.find((row) => row.rank === 5);
		if (!rankFive) return null;
		return rankFive.like_count + 1;
	}, [selectedRows]);

	const isGuest = !isConnected;
	const leaderReward = toRewardNumber(topRows[0]?.reward_amount);
	const topFiveAverageLikes = useMemo(() => {
		if (topRows.length === 0) return 0;
		return Math.round(
			topRows.reduce((sum, row) => sum + row.like_count, 0) / topRows.length,
		);
	}, [topRows]);
	const leaderName =
		topRows[0]?.creator?.clone_name ||
		shortAddress(topRows[0]?.creator?.wallet_address) ||
		"--";

	if (loading) {
		return <PageLoader message="Loading rewards experience..." />;
	}

	return (
		<div className="container py-6 sm:py-8 md:py-10">
			<section className="mb-6 rounded-3xl border border-border/70 bg-gradient-to-br from-background/95 via-background/90 to-amber-50/45 p-5 shadow-[0_24px_80px_-34px_rgba(245,158,11,0.52)] sm:p-6 md:p-8">
				<div className="mb-3 flex flex-wrap items-center justify-between gap-3">
					<p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
						<Gift className="h-3.5 w-3.5" /> Premium Rewards
					</p>
					<div className="flex items-center gap-2">
						{isGuest ? <Badge variant="outline">Guest view</Badge> : null}
						{selectedEpoch && (
						<Badge className={`${statusTone(selectedEpoch.status)} border`}>
							Epoch {selectedEpoch.id} · {selectedEpoch.status}
						</Badge>
						)}
					</div>
				</div>
				<div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
					<div>
						<h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
							Public rewards board for guests and creators
						</h1>
						<p className="mt-2 text-sm text-muted-foreground md:text-base">
							{isGuest
								? "Explore live epoch economics, top creator payouts, and rank thresholds before logging in."
								: "Track your rank, target payout, and weekly momentum with clear incentive signals."}
						</p>
					</div>
					<div className="w-full lg:w-[220px]">
						<Select
							value={selectedEpochId ? String(selectedEpochId) : undefined}
							onValueChange={(value) => setSelectedEpochId(Number(value))}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select epoch" />
							</SelectTrigger>
							<SelectContent>
								{epochs.map((epoch) => (
									<SelectItem key={epoch.id} value={String(epoch.id)}>
										Epoch {epoch.id} · {epoch.status}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			</section>

			<section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<Card className="border-border/70 bg-gradient-to-b from-background/90 to-background/70 shadow-[0_16px_40px_-30px_rgba(245,158,11,0.65)]">
					<CardHeader>
						<CardTitle className="inline-flex items-center gap-2 text-sm">
							<Coins className="h-4 w-4 text-primary" /> Epoch Pool
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-semibold">
							{formatFixed(pool, 2)} tBNB
						</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Active reward budget
						</p>
					</CardContent>
				</Card>

				<Card className="border-border/70 bg-gradient-to-b from-background/90 to-background/70 shadow-[0_16px_40px_-30px_rgba(245,158,11,0.65)]">
					<CardHeader>
						<CardTitle className="inline-flex items-center gap-2 text-sm">
							<Eye className="h-4 w-4 text-primary" /> Creator Field
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-semibold">{uniqueCreators}</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Competing creators this epoch
						</p>
					</CardContent>
				</Card>

				<Card className="border-border/70 bg-gradient-to-b from-background/90 to-background/70 shadow-[0_16px_40px_-30px_rgba(245,158,11,0.65)]">
					<CardHeader>
						<CardTitle className="inline-flex items-center gap-2 text-sm">
							<TrendingUp className="h-4 w-4 text-primary" /> Top 5 Target
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-semibold">
							{rankTargetLikes ? `${rankTargetLikes} likes` : "Building"}
						</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Approximate likes needed to break into top 5
						</p>
					</CardContent>
				</Card>

				<Card className="border-border/70 bg-gradient-to-b from-background/90 to-background/70 shadow-[0_16px_40px_-30px_rgba(245,158,11,0.65)]">
					<CardHeader>
						<CardTitle className="text-sm">
							{isGuest ? "Leader Reward" : "Your Snapshot"}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-semibold">
							{isGuest
								? `${formatFixed(leaderReward, 2)} tBNB`
								: userRow
									? `#${userRow.rank} · ${formatFixed(toRewardNumber(userRow.reward_amount), 2)} tBNB`
									: "Unranked"}
						</p>
						<p className="mt-1 text-xs text-muted-foreground">
							{isGuest
								? "Current projected payout for rank #1"
								: creatorId
									? creatorName
									: "Connect + onboard to personalize"}
						</p>
					</CardContent>
				</Card>
			</section>

			<section className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
				<Card className="relative overflow-hidden border-border/70 bg-gradient-to-br from-background/90 via-background/85 to-primary/5 shadow-[0_24px_60px_-40px_rgba(245,158,11,0.8)]">
					<div
						aria-hidden
						className="pointer-events-none absolute -top-14 right-4 h-32 w-32 rounded-full bg-primary/20 blur-3xl"
					/>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<Sparkles className="h-4 w-4 text-primary" />
							{isGuest ? "How rewards work" : "Momentum signals"}
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3 text-sm text-muted-foreground">
						{isGuest ? (
							<>
								<div className="grid gap-2 rounded-xl border border-primary/25 bg-primary/5 p-3 sm:grid-cols-3">
									<div className="rounded-lg border border-border/70 bg-background/80 p-2">
										<p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
											Leader
										</p>
										<p className="truncate text-sm font-semibold text-foreground">{leaderName}</p>
									</div>
									<div className="rounded-lg border border-border/70 bg-background/80 p-2">
										<p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
											Top 5 avg
										</p>
										<p className="text-sm font-semibold text-foreground">
											{topFiveAverageLikes > 0 ? `${topFiveAverageLikes} likes` : "--"}
										</p>
									</div>
									<div className="rounded-lg border border-border/70 bg-background/80 p-2">
										<p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
											Leader reward
										</p>
										<p className="text-sm font-semibold text-foreground">
											{formatFixed(leaderReward, 2)} tBNB
										</p>
									</div>
								</div>
								<div className="rounded-xl border border-border/70 bg-background/75 p-3">
									<p className="font-medium text-foreground">1. Publish</p>
									<p className="mt-1">Creators post to the public feed during each epoch.</p>
								</div>
								<div className="rounded-xl border border-border/70 bg-background/75 p-3">
									<p className="font-medium text-foreground">2. Earn momentum</p>
									<p className="mt-1">
										Likes and consistency push creators toward higher ranks.
									</p>
								</div>
								<div className="rounded-xl border border-border/70 bg-background/75 p-3">
									<p className="font-medium text-foreground">3. Collect payout</p>
									<p className="mt-1">
										Top ranks receive tBNB rewards after epoch settlement.
									</p>
								</div>
							</>
						) : (
							<>
								<p>
									You are {userRow ? `currently rank #${userRow.rank}` : "not ranked yet"}
									 this epoch.
								</p>
								<p>
									{rankTargetLikes
										? `Top 5 entry is around ${rankTargetLikes} likes. Keep posting to close the gap.`
										: "Top 5 threshold appears as soon as enough creators compete."}
								</p>
								<p>
									{recentPosts > 0
										? `${recentPosts} posts from your studio in the last 7 days.`
										: "No recent posts yet this week. Publish to build momentum."}
								</p>
							</>
						)}
					</CardContent>
				</Card>

				<Card className="border-border/70 bg-gradient-to-br from-background/92 to-background/75 shadow-[0_20px_45px_-36px_rgba(245,158,11,0.7)]">
					<CardHeader>
						<CardTitle className="text-base">
							{isGuest ? "Guest starter path" : "Actions"}
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3 text-sm text-muted-foreground">
						<p>
							{isGuest
								? "Browse the full public economy now, then connect later when you're ready to compete."
								: "Use these shortcuts to improve rank and convert momentum into payouts."}
						</p>
						<div className="rounded-xl border border-border/70 bg-background/70 p-3">
							<p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
								<Compass className="h-3.5 w-3.5 text-primary" /> Quick route
							</p>
							<div className="flex flex-wrap gap-2">
							<Button asChild variant="outline" size="sm">
								<Link to="/feed">Open Feed</Link>
							</Button>
							<Button asChild variant="outline" size="sm">
								<Link to="/leaderboard">Track Rank</Link>
							</Button>
							<Button asChild variant="outline" size="sm">
								<Link to="/onboarding">Start Onboarding</Link>
							</Button>
							</div>
						</div>
						{isGuest ? (
							<div className="rounded-xl border border-border/70 bg-secondary/35 p-3">
								<p className="mb-2 text-foreground">
									Connect wallet anytime to unlock personal reward projections.
								</p>
								<ConnectWalletButton compact label="Login With Wallet" />
							</div>
						) : null}
					</CardContent>
				</Card>
			</section>

			<section className="mb-6 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
				<Card className="border-border/70 bg-background/80">
					<CardHeader>
						<CardTitle className="text-base">Top wallets this epoch</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						{topWalletRows.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No ranking data yet for this epoch.
							</p>
						) : (
							topWalletRows.map((row) => (
								<div
									key={row.id}
									className="flex items-center justify-between rounded-xl border border-border/70 bg-background/70 px-3 py-2.5"
								>
									<div className="min-w-0">
										<p className="truncate text-sm font-medium">
											#{row.rank} {shortAddress(row.creator?.wallet_address)}
										</p>
										<p className="text-xs text-muted-foreground">
											{row.like_count} likes
										</p>
									</div>
									<p className="text-sm font-semibold text-primary">
										{formatFixed(toRewardNumber(row.reward_amount), 2)} tBNB
									</p>
								</div>
							))
						)}
						<Button asChild variant="outline" className="w-full">
							<Link to="/leaderboard">
								More wallets... <ArrowRight className="ml-2 h-4 w-4" />
							</Link>
						</Button>
					</CardContent>
				</Card>

				<Card className="border-border/70 bg-background/80">
					<CardHeader>
						<CardTitle className="text-base">Payout history</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						{epochs.slice(0, 5).map((epoch) => (
							<div
								key={epoch.id}
								className="rounded-xl border border-border/70 p-3"
							>
								<div className="mb-1 flex items-center justify-between gap-2">
									<p className="text-sm font-medium">Epoch {epoch.id}</p>
									<Badge className={`${statusTone(epoch.status)} border`}>
										{epoch.status}
									</Badge>
								</div>
								<p className="text-xs text-muted-foreground inline-flex items-center gap-1">
									<CalendarDays className="h-3.5 w-3.5" /> Ends{" "}
									{new Date(epoch.end_at).toLocaleDateString()}
								</p>
								<p className="mt-1 text-sm">
									Pool: {formatFixed(toRewardNumber(epoch.reward_pool), 2)} tBNB
								</p>
								{epoch.payout_tx_hash && (
									<a
										href={getExplorerUrl(epoch.payout_tx_hash)}
										target="_blank"
										rel="noreferrer"
										className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
									>
										View payout tx <ExternalLink className="h-3.5 w-3.5" />
									</a>
								)}
							</div>
						))}
					</CardContent>
				</Card>
			</section>

			<PublicJourneyStrip currentPage="rewards" />
		</div>
	);
}
