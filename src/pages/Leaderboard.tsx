import { formatDistanceToNow } from "date-fns";
import { motion, useInView } from "framer-motion";
import {
	ArrowDown,
	ArrowUp,
	BarChart3,
	Clock3,
	Flame,
	Loader2,
	Medal,
	Search,
	Sparkles,
	TrendingUp,
	Trophy,
	Users,
	Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatEther } from "viem";
import { useAccount, useDisconnect } from "wagmi";

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
import { useGetTotalCreators } from "@/hooks/useCreatorRegistry";
import {
	useGetEpochInfo,
	useGetPendingRewards,
} from "@/hooks/useRewardDistributor";
import { supabase } from "@/integrations/supabase/client";
import { formatFixed } from "@/lib/format-number";

interface RankedCreator {
	creator_id: string;
	clone_name: string;
	wallet_address: string;
	like_count: number;
	trend?: "up" | "down" | "flat";
	previous_rank?: number;
}

interface Epoch {
	id: number;
	status: "open" | "closed" | "paid" | string;
	reward_pool: number | string;
	end_at: string;
}

interface PostRow {
	id: string;
	creator_id: string;
	creator: {
		clone_name: string;
		wallet_address: string;
	} | null;
}

interface LikeRow {
	post_id: string;
}

const revealUp = {
	hidden: { opacity: 0, y: 20 },
	visible: (i: number) => ({
		opacity: 1,
		y: 0,
		transition: {
			delay: i * 0.05,
			duration: 0.4,
			ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
		},
	}),
};

const podiumReveal = {
	hidden: { opacity: 0, scale: 0.9, y: 30 },
	visible: (i: number) => ({
		opacity: 1,
		scale: 1,
		y: 0,
		transition: {
			delay: i * 0.12,
			duration: 0.5,
			ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
		},
	}),
};

function shortAddress(address: string) {
	if (!address) return "-";
	return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function GradientOrb({ className }: { className?: string }) {
	return (
		<div
			className={`pointer-events-none absolute rounded-full blur-3xl ${className}`}
		/>
	);
}

function BentoCard({
	children,
	className = "",
	gradient = false,
}: {
	children: React.ReactNode;
	className?: string;
	gradient?: boolean;
}) {
	return (
		<Card
			className={`relative overflow-hidden border-border/40 bg-gradient-to-br from-background/90 via-background/70 to-amber-50/20 backdrop-blur-xl dark:to-amber-950/10 ${className}`}
		>
			{gradient && (
				<GradientOrb className="h-24 w-24 -right-4 -top-4 bg-amber-500/10" />
			)}
			{children}
		</Card>
	);
}

export default function Leaderboard() {
	const { address } = useAccount();
	const { disconnect, disconnectAsync } = useDisconnect();
	const handleDisconnect = async () => {
		try {
			await disconnectAsync();
		} catch {
			disconnect();
		}
	};
	const [epochs, setEpochs] = useState<Epoch[]>([]);
	const [selectedEpoch, setSelectedEpoch] = useState<string>("");
	const [rankings, setRankings] = useState<RankedCreator[]>([]);
	const [currentEpoch, setCurrentEpoch] = useState<Epoch | null>(null);
	const [loading, setLoading] = useState(true);
	const [showAllRankings, setShowAllRankings] = useState(false);
	const [activeFilter, setActiveFilter] = useState<"all" | "top10">("all");
	const [searchQuery, setSearchQuery] = useState("");
	const rankingsRef = useRef<HTMLDivElement>(null);
	const headerRef = useRef<HTMLDivElement>(null);
	const isHeaderSticky = useInView(headerRef, { margin: "-100px" });

	const { epoch: contractEpoch, isLoading: isEpochLoading } = useGetEpochInfo(
		selectedEpoch ? BigInt(selectedEpoch) : undefined,
	);
	const { pendingRewards, isLoading: isPendingRewardsLoading } =
		useGetPendingRewards(address);
	const {
		totalCreators: contractTotalCreators,
		isLoading: isTotalCreatorsLoading,
	} = useGetTotalCreators();

	useEffect(() => {
		loadEpochs();
	}, []);

	useEffect(() => {
		if (selectedEpoch) {
			setShowAllRankings(false);
			setActiveFilter("all");
			loadRankings(Number(selectedEpoch));
		}
	}, [selectedEpoch]);

	async function loadEpochs() {
		const { data } = await supabase
			.from("epochs")
			.select("*")
			.order("id", { ascending: false });
		const ep = (data ?? []) as Epoch[];
		setEpochs(ep);
		if (ep.length > 0) {
			setSelectedEpoch(String(ep[0].id));
			setCurrentEpoch(ep[0]);
		}
		setLoading(false);
	}

	async function loadRankings(epochId: number) {
		const epoch = epochs.find((e) => e.id === epochId);
		setCurrentEpoch(epoch);

		const { data: posts } = await supabase
			.from("posts")
			.select("id, creator_id, creator:creators(clone_name, wallet_address)")
			.eq("epoch_id", epochId);

		const postsArr = (posts ?? []) as PostRow[];
		if (postsArr.length === 0) {
			setRankings([]);
			return;
		}

		const postIds = postsArr.map((p) => p.id);
		const { data: likes } = await supabase
			.from("likes")
			.select("post_id")
			.in("post_id", postIds);
		const likesArr = (likes ?? []) as LikeRow[];

		const postLikeCount = likesArr.reduce<Record<string, number>>(
			(acc, item) => {
				acc[item.post_id] = (acc[item.post_id] ?? 0) + 1;
				return acc;
			},
			{},
		);

		const creatorLikes: Record<
			string,
			{ clone_name: string; wallet_address: string; count: number }
		> = {};
		for (const p of postsArr) {
			const cr = p.creator;
			if (!cr) continue;
			const key = p.creator_id;
			if (!creatorLikes[key]) {
				creatorLikes[key] = {
					clone_name: cr.clone_name,
					wallet_address: cr.wallet_address,
					count: 0,
				};
			}
			creatorLikes[key].count += postLikeCount[p.id] ?? 0;
		}

		const ranked = Object.entries(creatorLikes)
			.map(([creator_id, v]) => ({
				creator_id,
				clone_name: v.clone_name,
				wallet_address: v.wallet_address,
				like_count: v.count,
				trend: "flat" as const,
			}))
			.sort((a, b) => b.like_count - a.like_count);

		setRankings(ranked);
	}

	const rankIcon = (i: number, size: "sm" | "lg" = "sm") => {
		const sm = size === "sm";
		if (i === 0)
			return (
				<Trophy
					className={`${sm ? "h-5 w-5" : "h-8 w-8"} text-amber-500 drop-shadow-[0_2px_8px_rgba(245,158,11,0.5)]`}
				/>
			);
		if (i === 1)
			return (
				<Medal className={`${sm ? "h-5 w-5" : "h-7 w-7"} text-zinc-400`} />
			);
		if (i === 2)
			return (
				<Medal className={`${sm ? "h-5 w-5" : "h-7 w-7"} text-orange-400`} />
			);
		return (
			<span
				className={`${
					sm ? "text-sm" : "text-xl"
				} font-bold text-muted-foreground`}
			>
				{i + 1}
			</span>
		);
	};

	const filteredRankings = useMemo(
		() =>
			searchQuery
				? rankings.filter(
						(r) =>
							r.clone_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
							r.wallet_address
								.toLowerCase()
								.includes(searchQuery.toLowerCase()),
					)
				: rankings,
		[rankings, searchQuery],
	);

	const topThreeRankings = useMemo(
		() => filteredRankings.slice(0, 3),
		[filteredRankings],
	);
	const remainingRankings = useMemo(
		() => filteredRankings.slice(3),
		[filteredRankings],
	);
	const visibleRemainingRankings =
		activeFilter === "all"
			? showAllRankings
				? remainingRankings
				: remainingRankings.slice(0, 10)
			: filteredRankings.slice(3, 13);
	const payoutCutoff = filteredRankings[4]?.like_count ?? 0;
	const maxLikes = filteredRankings[0]?.like_count ?? 1;

	const scrollToMyRank = () => {
		const myRankEl = document.getElementById("my-rank-row");
		if (myRankEl) {
			myRankEl.scrollIntoView({ behavior: "smooth", block: "center" });
		}
	};

	if (loading) return <PageLoader message="Loading rankings..." />;

	return (
		<div className="container py-6 sm:py-8 md:py-10">
			<section className="relative mb-6 overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-background/95 via-amber-50/30 to-background p-5 shadow-[0_18px_70px_-34px_rgba(245,158,11,0.45)] sm:mb-8 sm:p-6 md:p-8 dark:border-amber-500/10 dark:via-amber-950/20">
				<GradientOrb className="h-56 w-56 -right-20 -top-20 bg-amber-500/20" />
				<GradientOrb className="h-36 w-36 left-20 top-10 bg-orange-500/15" />

				<div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
					<div>
						<div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] text-amber-600 dark:text-amber-400">
							<Sparkles className="h-3.5 w-3.5" />
							Epoch {currentEpoch?.id || 1}
							{contractEpoch && contractEpoch.distributed && (
								<Badge className="ml-1 bg-green-500/15 text-green-600 border-green-500/30 dark:text-green-400 text-[9px] px-1.5 py-0">
									Paid
								</Badge>
							)}
						</div>
						<h1 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
							<span className="bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600 bg-clip-text text-transparent dark:from-amber-400 dark:via-orange-300 dark:to-amber-400">
								Creator
							</span>{" "}
							Leaderboard
						</h1>
						<p className="mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
							Top 5 creators win rewards this epoch. Climb the ranks by creating
							engaging content and earning likes from the community.
						</p>
						{address && (
							<div className="mt-3 flex flex-wrap items-center gap-2">
								{pendingRewards &&
									pendingRewards > 0n &&
									!isPendingRewardsLoading && (
										<div className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
											<Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" />
											<span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
												Pending Rewards: {formatEther(pendingRewards)} tBNB
											</span>
										</div>
									)}
								<button
									type="button"
									onClick={handleDisconnect}
									className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-background/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
								>
									Disconnect
								</button>
							</div>
						)}
					</div>

					{epochs.length > 0 && (
						<Select value={selectedEpoch} onValueChange={setSelectedEpoch}>
							<SelectTrigger className="h-11 w-full border-amber-500/25 bg-background/80 backdrop-blur-sm sm:w-[200px]">
								<Zap className="mr-2 h-4 w-4 text-amber-500" />
								<SelectValue placeholder="Choose epoch" />
							</SelectTrigger>
							<SelectContent>
								{epochs.map((epoch) => (
									<SelectItem key={epoch.id} value={String(epoch.id)}>
										<span className="flex items-center gap-2">
											<span>Epoch {epoch.id}</span>
											<Badge
												variant="outline"
												className={`text-[10px] ${
													epoch.status === "open"
														? "border-green-500/50 text-green-600 dark:text-green-400"
														: "border-muted-foreground/30"
												}`}
											>
												{epoch.status}
											</Badge>
										</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</div>
			</section>

			{currentEpoch && (
				<motion.div
					initial={{ opacity: 0, y: 14 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.45 }}
					className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4"
				>
					<BentoCard gradient>
						<CardHeader className="pb-2">
							<CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
								<Users className="h-4 w-4" />
								Total Creators
							</CardTitle>
						</CardHeader>
						<CardContent className="pt-0">
							{isTotalCreatorsLoading ? (
								<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
							) : contractTotalCreators && contractTotalCreators > 0n ? (
								<>
									<p className="text-2xl font-bold tracking-tight">
										{contractTotalCreators.toString()}
									</p>
									<p className="text-xs text-muted-foreground">
										Registered on-chain
									</p>
								</>
							) : (
								<>
									<p className="text-2xl font-bold tracking-tight">
										{rankings.length}
									</p>
									<p className="text-xs text-muted-foreground">
										Active this epoch
									</p>
								</>
							)}
						</CardContent>
					</BentoCard>

					<BentoCard gradient>
						<CardHeader className="pb-2">
							<CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
								<TrendingUp className="h-4 w-4" />
								Top Score
							</CardTitle>
						</CardHeader>
						<CardContent className="pt-0">
							<p className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
								{maxLikes.toLocaleString()}
							</p>
							<p className="text-xs text-muted-foreground">likes earned</p>
						</CardContent>
					</BentoCard>

					<BentoCard>
						<CardHeader className="pb-2">
							<CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
								<Sparkles className="h-4 w-4" />
								Reward Pool
							</CardTitle>
						</CardHeader>
						<CardContent className="pt-0">
							{isEpochLoading ? (
								<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
							) : contractEpoch && contractEpoch.totalRewards > 0n ? (
								<>
									<p className="text-2xl font-bold tracking-tight">
										{formatEther(contractEpoch.totalRewards)}
									</p>
									<p className="text-xs text-muted-foreground">
										tBNB (on-chain)
									</p>
								</>
							) : (
								<>
									<p className="text-2xl font-bold tracking-tight">
										{formatFixed(currentEpoch?.reward_pool || 0, 2)}
									</p>
									<p className="text-xs text-muted-foreground">tBNB</p>
								</>
							)}
						</CardContent>
					</BentoCard>

					<BentoCard>
						<CardHeader className="pb-2">
							<CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
								<Clock3 className="h-4 w-4" />
								Epoch Status
							</CardTitle>
						</CardHeader>
						<CardContent className="pt-0">
							{currentEpoch.status === "open" ? (
								<div className="space-y-1">
									<Badge className="bg-green-500/15 text-green-600 border-green-500/30 dark:text-green-400 capitalize">
										<Flame className="mr-1 h-3 w-3" />
										{currentEpoch.status}
									</Badge>
									<p className="text-xs text-muted-foreground">
										Ends{" "}
										{formatDistanceToNow(new Date(currentEpoch.end_at), {
											addSuffix: true,
										})}
									</p>
								</div>
							) : (
								<div className="space-y-1">
									<Badge variant="secondary" className="capitalize">
										{currentEpoch.status}
									</Badge>
									{contractEpoch && contractEpoch.distributed && (
										<p className="text-xs text-muted-foreground">
											Distributed on-chain
										</p>
									)}
								</div>
							)}
						</CardContent>
					</BentoCard>
				</motion.div>
			)}

			<Card className="mb-6 border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-transparent">
				<CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15">
							<Trophy className="h-5 w-5 text-amber-500" />
						</div>
						<div>
							<p className="text-sm font-semibold tracking-tight text-foreground">
								Top 5 Payout Zone
							</p>
							<p className="text-xs text-muted-foreground">
								Current cutoff:{" "}
								<span className="font-bold text-amber-600 dark:text-amber-400">
									{payoutCutoff}
								</span>{" "}
								likes
							</p>
						</div>
					</div>
					<Badge
						variant="outline"
						className="w-fit border-amber-500/35 bg-amber-500/10 px-4 py-1.5 text-amber-700 dark:text-amber-300"
					>
						Beat rank #5 to earn
					</Badge>
				</CardContent>
			</Card>

			{rankings.length === 0 ? (
				<div className="rounded-2xl border border-dashed border-border/70 bg-background/60 py-16 text-center">
					<div className="mb-4 flex justify-center">
						<div className="rounded-full bg-muted/50 p-4">
							<Users className="h-8 w-8 text-muted-foreground" />
						</div>
					</div>
					<p className="mb-4 text-muted-foreground">
						No rankings yet for this epoch. Create posts and collect likes to
						start climbing.
					</p>
					<Button
						asChild
						variant="outline"
						className="border-amber-500/35 bg-amber-500/5"
					>
						<Link to="/feed">Explore feed</Link>
					</Button>
				</div>
			) : (
				<div className="space-y-6" ref={rankingsRef}>
					{topThreeRankings.length > 0 && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							className="space-y-4"
						>
							<p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
								<Trophy className="h-3.5 w-3.5" /> Top Performers
							</p>
							<div className="grid gap-4 md:grid-cols-3 md:items-end">
								{topThreeRankings[1] && (
									<motion.div
										custom={0}
										initial="hidden"
										animate="visible"
										variants={podiumReveal}
									>
										<Card className="border-zinc-400/30 bg-gradient-to-b from-zinc-100 to-zinc-50 dark:from-zinc-800/60 dark:to-zinc-900/60">
											<CardContent className="p-4 text-center">
												<div className="mb-3 flex justify-center">
													<div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-zinc-300 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800">
														{rankIcon(1, "lg")}
													</div>
												</div>
												<p className="mb-1 truncate text-sm font-semibold">
													{topThreeRankings[1].clone_name}
												</p>
												<p className="mb-3 text-xs text-muted-foreground">
													{shortAddress(topThreeRankings[1].wallet_address)}
												</p>
												<p className="text-2xl font-bold text-zinc-600 dark:text-zinc-300">
													{topThreeRankings[1].like_count.toLocaleString()}
												</p>
												<p className="text-xs text-muted-foreground">likes</p>
											</CardContent>
										</Card>
									</motion.div>
								)}

								{topThreeRankings[0] && (
									<motion.div
										custom={1}
										initial="hidden"
										animate="visible"
										variants={podiumReveal}
									>
										<Card className="relative border-amber-500/40 bg-gradient-to-b from-amber-50 to-amber-100/50 dark:from-amber-950/60 dark:to-amber-900/30">
											<div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 to-transparent" />
											<CardContent className="relative p-5 text-center">
												<div className="mb-3 flex justify-center">
													<div className="relative">
														<div className="absolute -inset-2 animate-pulse rounded-full bg-amber-400/30 blur-xl" />
														<div className="relative flex h-16 w-16 items-center justify-center rounded-full border-3 border-amber-400 bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900 dark:to-amber-800">
															{rankIcon(0, "lg")}
														</div>
													</div>
												</div>
												<Badge className="mb-2 bg-amber-500/20 text-amber-700 dark:text-amber-300 gap-1">
													<Trophy className="h-3 w-3" /> Winner
												</Badge>
												<p className="mb-1 truncate text-base font-semibold">
													{topThreeRankings[0].clone_name}
												</p>
												<p className="mb-3 text-xs text-muted-foreground">
													{shortAddress(topThreeRankings[0].wallet_address)}
												</p>
												<p className="text-4xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400">
													{topThreeRankings[0].like_count.toLocaleString()}
												</p>
												<p className="text-sm text-muted-foreground">likes</p>
											</CardContent>
										</Card>
									</motion.div>
								)}

								{topThreeRankings[2] && (
									<motion.div
										custom={2}
										initial="hidden"
										animate="visible"
										variants={podiumReveal}
									>
										<Card className="border-orange-400/30 bg-gradient-to-b from-orange-100 to-orange-50 dark:from-orange-900/60 dark:to-orange-950/30">
											<CardContent className="p-4 text-center">
												<div className="mb-3 flex justify-center">
													<div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-orange-300 bg-orange-100 dark:border-orange-600 dark:bg-orange-900">
														{rankIcon(2, "lg")}
													</div>
												</div>
												<p className="mb-1 truncate text-sm font-semibold">
													{topThreeRankings[2].clone_name}
												</p>
												<p className="mb-3 text-xs text-muted-foreground">
													{shortAddress(topThreeRankings[2].wallet_address)}
												</p>
												<p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
													{topThreeRankings[2].like_count.toLocaleString()}
												</p>
												<p className="text-xs text-muted-foreground">likes</p>
											</CardContent>
										</Card>
									</motion.div>
								)}
							</div>
						</motion.div>
					)}

					{visibleRemainingRankings.length > 0 && (
						<div className="space-y-3">
							<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
									<BarChart3 className="h-3.5 w-3.5" /> All Rankings
								</p>
								<div className="flex items-center gap-2">
									<div className="relative">
										<Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
										<input
											type="text"
											placeholder="Search creators..."
											value={searchQuery}
											onChange={(e) => setSearchQuery(e.target.value)}
											className="h-8 w-full rounded-lg border border-border/50 bg-background/80 pl-8 pr-3 text-sm outline-none transition-all focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 sm:w-[180px]"
										/>
									</div>
									{remainingRankings.length > 10 && (
										<div className="flex gap-1">
											<Button
												variant={activeFilter === "all" ? "default" : "ghost"}
												size="sm"
												className="h-7 text-xs"
												onClick={() => setActiveFilter("all")}
											>
												All
											</Button>
											<Button
												variant={activeFilter === "top10" ? "default" : "ghost"}
												size="sm"
												className="h-7 text-xs"
												onClick={() => setActiveFilter("top10")}
											>
												Top 10
											</Button>
										</div>
									)}
								</div>
							</div>

							{visibleRemainingRankings.map((ranking, idx) => {
								const rank = idx + (activeFilter === "top10" ? 3 : 4);
								const isPayoutSlot = rank <= 4;
								const relativeScore = (ranking.like_count / maxLikes) * 100;

								return (
									<motion.div
										key={ranking.creator_id}
										custom={rank}
										initial="hidden"
										whileInView="visible"
										viewport={{ once: true, margin: "-50px" }}
										variants={revealUp}
									>
										<Card
											id={rank === 4 ? "my-rank-row" : undefined}
											className={`group relative overflow-hidden border-border/60 bg-background/80 transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-400/30 hover:shadow-[0_8px_30px_-12px_rgba(245,158,11,0.4)] ${
												isPayoutSlot
													? "border-amber-500/25 bg-amber-500/[0.03]"
													: ""
											}`}
										>
											<div
												className="absolute bottom-0 left-0 top-0 bg-amber-500/[0.05] transition-all duration-500"
												style={{ width: `${Math.max(relativeScore, 3)}%` }}
											/>

											<CardContent className="relative flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:gap-4">
												<div className="flex w-full items-center gap-3 sm:w-auto">
													<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-muted/50">
														{rankIcon(rank - 1)}
													</div>
												</div>

												<div className="min-w-0 w-full flex-1">
													<div className="flex flex-wrap items-center gap-2">
														<p className="truncate text-sm font-semibold tracking-tight">
															{ranking.clone_name}
														</p>
														{isPayoutSlot && (
															<Badge
																variant="outline"
																className="border-amber-500/35 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
															>
																Paid
															</Badge>
														)}
														{ranking.trend && (
															<div className="flex items-center gap-0.5">
																{ranking.trend === "up" ? (
																	<ArrowUp className="h-3 w-3 text-green-500" />
																) : ranking.trend === "down" ? (
																	<ArrowDown className="h-3 w-3 text-red-500" />
																) : null}
															</div>
														)}
													</div>
													<p className="text-xs text-muted-foreground">
														{shortAddress(ranking.wallet_address)}
													</p>
												</div>

												<div className="flex w-full items-center justify-between sm:w-auto sm:flex-col sm:items-end sm:gap-0.5">
													<p className="text-xl font-bold leading-none tracking-tight">
														{ranking.like_count.toLocaleString()}
													</p>
													<p className="text-xs text-muted-foreground">likes</p>
												</div>
											</CardContent>
										</Card>
									</motion.div>
								);
							})}
						</div>
					)}

					{remainingRankings.length > 10 && activeFilter === "all" && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.3 }}
						>
							<Button
								variant="outline"
								className="w-full border-amber-500/25 hover:bg-amber-500/10"
								onClick={() => setShowAllRankings((v) => !v)}
							>
								{showAllRankings ? (
									<>Show less</>
								) : (
									<>Show all creators ({remainingRankings.length} more)</>
								)}
							</Button>
						</motion.div>
					)}
				</div>
			)}
		</div>
	);
}
