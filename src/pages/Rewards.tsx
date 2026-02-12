import { motion } from "framer-motion";
import {
	CalendarDays,
	CheckCircle2,
	Clock3,
	ExternalLink,
	Flame,
	Rocket,
	ShieldCheck,
	Sparkles,
	Target,
	Trophy,
	Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAccount } from "wagmi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InlineLoader, PageLoader } from "@/components/ui/page-loader";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { formatFixed, toFiniteNumber } from "@/lib/format-number";
import { getExplorerUrl } from "@/lib/mock-contract";

interface RewardEpoch {
	id: number;
	status: "open" | "closed" | "paid" | string;
	payout_tx_hash: string | null;
	reward_pool: number | string;
	end_at: string;
}

interface RewardCreator {
	id?: string;
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

interface EpochFilterOption {
	id: number;
	status: "open" | "closed" | "paid" | string;
	reward_pool: number | string;
	end_at: string;
}

interface CreatorRow {
	id: string;
	clone_name: string;
	wallet_address: string;
}

interface CreatorPostRow {
	id: string;
	creator_id: string;
	epoch_id: number;
	created_at: string;
	commit_tx_hash: string | null;
}

interface LikeRow {
	id: string;
	post_id: string;
	created_at: string;
}

interface CreatorRanking {
	creatorId: string;
	likes: number;
}

interface RewardEstimator {
	status: "disconnected" | "no-creator" | "ready";
	creatorId: string | null;
	creatorName: string;
	epochId: number | null;
	rewardPool: number;
	currentLikes: number;
	currentRank: number | null;
	top5Threshold: number;
	estimatedReward: number;
	totalCreators: number;
}

interface MissionItem {
	id: string;
	title: string;
	description: string;
	progressLabel: string;
	progress: number;
	done: boolean;
	href: string;
}

interface TimelineEvent {
	id: string;
	type: "reward" | "post" | "like";
	title: string;
	detail: string;
	at: string;
	href?: string;
}

interface HeatmapCell {
	dateKey: string;
	count: number;
	level: 0 | 1 | 2 | 3 | 4;
}

interface PostingSuggestion {
	hour: number;
	avgLikes: number;
	posts: number;
	confidence: "low" | "medium" | "high";
}

const TOP5_SPLIT = [0.4, 0.25, 0.15, 0.1, 0.1] as const;
const SIMULATOR_MAX_LIKES = 250;

function shortAddress(address?: string | null) {
	if (!address) return "-";
	return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function clampProgress(value: number) {
	if (value < 0) return 0;
	if (value > 100) return 100;
	return value;
}

function estimateRewardByRank(rewardPool: number, rank: number | null) {
	if (!rank || rank < 1 || rank > 5) return 0;
	return rewardPool * TOP5_SPLIT[rank - 1];
}

function getRankForLikes(rankings: CreatorRanking[], likes: number) {
	const betterCount = rankings.filter((item) => item.likes > likes).length;
	return betterCount + 1;
}

function computeStreakDays(dates: string[]) {
	if (dates.length === 0) return 0;

	const uniqueDays = new Set(
		dates.map((isoDate) => {
			const date = new Date(isoDate);
			date.setHours(0, 0, 0, 0);
			return date.toISOString().slice(0, 10);
		}),
	);

	const cursor = new Date();
	cursor.setHours(0, 0, 0, 0);
	let streak = 0;

	while (uniqueDays.has(cursor.toISOString().slice(0, 10))) {
		streak += 1;
		cursor.setDate(cursor.getDate() - 1);
	}

	return streak;
}

function timeAgoLabel(isoDate: string) {
	const ms = Date.now() - new Date(isoDate).getTime();
	if (!Number.isFinite(ms) || ms < 0) return "just now";
	const minutes = Math.floor(ms / 60000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d ago`;
	return new Date(isoDate).toLocaleDateString();
}

function formatHourWindow(hour: number) {
	const start = new Date();
	start.setHours(hour, 0, 0, 0);
	const end = new Date(start);
	end.setHours((hour + 2) % 24, 0, 0, 0);

	const formatHour = (date: Date) =>
		date.toLocaleTimeString([], {
			hour: "numeric",
			hour12: true,
		});

	return `${formatHour(start)} - ${formatHour(end)}`;
}

function computeHeatLevel(count: number, maxCount: number): 0 | 1 | 2 | 3 | 4 {
	if (count <= 0 || maxCount <= 0) return 0;
	const ratio = count / maxCount;
	if (ratio < 0.25) return 1;
	if (ratio < 0.5) return 2;
	if (ratio < 0.75) return 3;
	return 4;
}

function buildHeatmapCells(activityDates: string[], days = 28): HeatmapCell[] {
	const counts = new Map<string, number>();

	activityDates.forEach((isoDate) => {
		const date = new Date(isoDate);
		date.setHours(0, 0, 0, 0);
		const key = date.toISOString().slice(0, 10);
		counts.set(key, (counts.get(key) ?? 0) + 1);
	});

	const cells: HeatmapCell[] = [];
	const cursor = new Date();
	cursor.setHours(0, 0, 0, 0);
	cursor.setDate(cursor.getDate() - (days - 1));

	for (let i = 0; i < days; i += 1) {
		const key = cursor.toISOString().slice(0, 10);
		const count = counts.get(key) ?? 0;
		cells.push({ dateKey: key, count, level: 0 });
		cursor.setDate(cursor.getDate() + 1);
	}

	const maxCount = Math.max(...cells.map((cell) => cell.count), 0);
	return cells.map((cell) => ({
		...cell,
		level: computeHeatLevel(cell.count, maxCount),
	}));
}

const rowReveal = {
	hidden: { opacity: 0, y: 12 },
	visible: (i: number) => ({
		opacity: 1,
		y: 0,
		transition: {
			delay: i * 0.035,
			duration: 0.35,
			ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
		},
	}),
};

export default function Rewards() {
	const { address } = useAccount();

	const [rewards, setRewards] = useState<RewardRow[]>([]);
	const [epochs, setEpochs] = useState<EpochFilterOption[]>([]);
	const [creators, setCreators] = useState<CreatorRow[]>([]);
	const [epochFilter, setEpochFilter] = useState<string>("all");
	const [loading, setLoading] = useState(true);
	const [insightsLoading, setInsightsLoading] = useState(true);

	const [rankings, setRankings] = useState<CreatorRanking[]>([]);
	const [likesByCreator, setLikesByCreator] = useState<Record<string, number>>(
		{},
	);
	const [postsByCreator, setPostsByCreator] = useState<Record<string, number>>(
		{},
	);

	const [estimator, setEstimator] = useState<RewardEstimator>({
		status: "disconnected",
		creatorId: null,
		creatorName: "Creator",
		epochId: null,
		rewardPool: 0,
		currentLikes: 0,
		currentRank: null,
		top5Threshold: 0,
		estimatedReward: 0,
		totalCreators: 0,
	});

	const [missions, setMissions] = useState<MissionItem[]>([]);
	const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
	const [streakDays, setStreakDays] = useState(0);
	const [streakMultiplier, setStreakMultiplier] = useState(1);
	const [heatmap, setHeatmap] = useState<HeatmapCell[]>([]);
	const [postingSuggestions, setPostingSuggestions] = useState<
		PostingSuggestion[]
	>([]);

	const [simulatorLikes, setSimulatorLikes] = useState(0);
	const [compareLeftId, setCompareLeftId] = useState<string>("none");
	const [compareRightId, setCompareRightId] = useState<string>("none");
	const [showAllMissions, setShowAllMissions] = useState(false);
	const [showAdvancedInsights, setShowAdvancedInsights] = useState(false);

	useEffect(() => {
		void loadData();
	}, [address]);

	const activeEpoch = useMemo(() => {
		return epochs.find((epoch) => epoch.status === "open") ?? epochs[0] ?? null;
	}, [epochs]);

	const filtered = useMemo(() => {
		return rewards.filter(
			(reward) =>
				epochFilter === "all" || reward.epoch_id === Number(epochFilter),
		);
	}, [rewards, epochFilter]);

	const totalRewardBnb = filtered.reduce(
		(sum, reward) => sum + toFiniteNumber(reward.reward_amount),
		0,
	);
	const paidRecords = filtered.filter((reward) =>
		Boolean(reward.epoch?.payout_tx_hash),
	).length;
	const uniqueCreators = new Set(
		filtered.map((reward) => reward.creator?.wallet_address).filter(Boolean),
	).size;

	const simulatorRank = getRankForLikes(rankings, simulatorLikes);
	const simulatorEstimatedReward = estimateRewardByRank(
		toFiniteNumber(activeEpoch?.reward_pool),
		simulatorRank,
	);

	const compareLeft =
		creators.find((creator) => creator.id === compareLeftId) ?? null;
	const compareRight =
		creators.find((creator) => creator.id === compareRightId) ?? null;

	const compareMetrics = (creatorId: string | undefined) => {
		if (!creatorId) {
			return {
				likes: 0,
				rank: null as number | null,
				epochPosts: 0,
				payout: 0,
			};
		}

		const likes = toFiniteNumber(likesByCreator[creatorId]);
		const rankIndex = rankings.findIndex(
			(entry) => entry.creatorId === creatorId,
		);
		const rank = rankIndex >= 0 ? rankIndex + 1 : null;
		const payout = estimateRewardByRank(
			toFiniteNumber(activeEpoch?.reward_pool),
			rank,
		);

		return {
			likes,
			rank,
			epochPosts: toFiniteNumber(postsByCreator[creatorId]),
			payout,
		};
	};

	const leftMetrics = compareMetrics(compareLeft?.id);
	const rightMetrics = compareMetrics(compareRight?.id);
	const prioritizedMissions = [...missions].sort(
		(a, b) => Number(a.done) - Number(b.done),
	);
	const visibleMissions = showAllMissions
		? prioritizedMissions
		: prioritizedMissions.slice(0, 3);
	const hiddenMissionCount = Math.max(
		0,
		prioritizedMissions.length - visibleMissions.length,
	);

	async function loadData() {
		setLoading(true);
		setInsightsLoading(true);

		const [rewardsRes, epochsRes, creatorsRes] = await Promise.all([
			supabase
				.from("epoch_rewards")
				.select(
					"*, creator:creators(id, clone_name, wallet_address), epoch:epochs(id, status, payout_tx_hash, reward_pool, end_at)",
				)
				.order("epoch_id", { ascending: false }),
			supabase
				.from("epochs")
				.select("id, status, reward_pool, end_at")
				.order("id", { ascending: false }),
			supabase
				.from("creators")
				.select("id, clone_name, wallet_address")
				.order("clone_name", { ascending: true }),
		]);

		const rewardRows = (rewardsRes.data ?? []) as RewardRow[];
		const epochRows = (epochsRes.data ?? []) as EpochFilterOption[];
		const creatorRows = (creatorsRes.data ?? []) as CreatorRow[];

		setRewards(rewardRows);
		setEpochs(epochRows);
		setCreators(creatorRows);

		const openEpoch =
			epochRows.find((epoch) => epoch.status === "open") ??
			epochRows[0] ??
			null;

		let computedRankings: CreatorRanking[] = [];
		let computedLikesByCreator: Record<string, number> = {};
		let computedPostsByCreator: Record<string, number> = {};

		if (openEpoch) {
			const { data: epochPostsData } = await supabase
				.from("posts")
				.select("id, creator_id, epoch_id, created_at, commit_tx_hash")
				.eq("epoch_id", openEpoch.id);

			const epochPosts = (epochPostsData ?? []) as CreatorPostRow[];
			const epochPostIds = epochPosts.map((post) => post.id);

			const postCounts = epochPosts.reduce<Record<string, number>>(
				(acc, post) => {
					acc[post.creator_id] = (acc[post.creator_id] ?? 0) + 1;
					return acc;
				},
				{},
			);

			computedPostsByCreator = postCounts;

			if (epochPostIds.length > 0) {
				const { data: likesData } = await supabase
					.from("likes")
					.select("id, post_id, created_at")
					.in("post_id", epochPostIds);
				const likesRows = (likesData ?? []) as LikeRow[];

				const likesPerPost = likesRows.reduce<Record<string, number>>(
					(acc, like) => {
						acc[like.post_id] = (acc[like.post_id] ?? 0) + 1;
						return acc;
					},
					{},
				);

				computedLikesByCreator = epochPosts.reduce<Record<string, number>>(
					(acc, post) => {
						acc[post.creator_id] =
							(acc[post.creator_id] ?? 0) + (likesPerPost[post.id] ?? 0);
						return acc;
					},
					{},
				);
			}

			computedRankings = Object.entries(computedLikesByCreator)
				.map(([creatorId, likes]) => ({
					creatorId,
					likes: toFiniteNumber(likes),
				}))
				.sort((a, b) => b.likes - a.likes);
		}

		setLikesByCreator(computedLikesByCreator);
		setPostsByCreator(computedPostsByCreator);
		setRankings(computedRankings);

		if (computedRankings.length >= 2) {
			setCompareLeftId(computedRankings[0].creatorId);
			setCompareRightId(computedRankings[1].creatorId);
		} else if (creatorRows.length >= 2) {
			setCompareLeftId(creatorRows[0].id);
			setCompareRightId(creatorRows[1].id);
		} else if (creatorRows.length === 1) {
			setCompareLeftId(creatorRows[0].id);
			setCompareRightId("none");
		}

		await loadPersonalInsights(
			address,
			openEpoch,
			rewardRows,
			computedRankings,
			computedLikesByCreator,
			computedPostsByCreator,
		);

		setLoading(false);
		setInsightsLoading(false);
	}

	async function loadPersonalInsights(
		walletAddress: string | undefined,
		openEpoch: EpochFilterOption | null,
		rewardRows: RewardRow[],
		rankingRows: CreatorRanking[],
		likesMap: Record<string, number>,
		postsMap: Record<string, number>,
	) {
		if (!walletAddress) {
			setEstimator({
				status: "disconnected",
				creatorId: null,
				creatorName: "Creator",
				epochId: openEpoch?.id ?? null,
				rewardPool: toFiniteNumber(openEpoch?.reward_pool),
				currentLikes: 0,
				currentRank: null,
				top5Threshold: rankingRows[4]?.likes ?? 0,
				estimatedReward: 0,
				totalCreators: rankingRows.length,
			});

			setMissions([
				{
					id: "connect-wallet",
					title: "Connect your wallet",
					description:
						"Unlock personal estimator, missions, and timeline insights.",
					progressLabel: "Not connected",
					progress: 0,
					done: false,
					href: "/",
				},
			]);

			setTimeline([]);
			setStreakDays(0);
			setStreakMultiplier(1);
			setHeatmap([]);
			setPostingSuggestions([]);
			setSimulatorLikes(0);
			return;
		}

		const { data: creatorData } = await supabase
			.from("creators")
			.select("id, clone_name, wallet_address")
			.ilike("wallet_address", walletAddress)
			.maybeSingle();

		if (!creatorData) {
			setEstimator({
				status: "no-creator",
				creatorId: null,
				creatorName: "Creator",
				epochId: openEpoch?.id ?? null,
				rewardPool: toFiniteNumber(openEpoch?.reward_pool),
				currentLikes: 0,
				currentRank: null,
				top5Threshold: rankingRows[4]?.likes ?? 0,
				estimatedReward: 0,
				totalCreators: rankingRows.length,
			});

			setMissions([
				{
					id: "create-profile",
					title: "Create your clone profile",
					description:
						"Set your persona and style to enter ranking and payout cycles.",
					progressLabel: "0 / 1 complete",
					progress: 0,
					done: false,
					href: "/onboarding",
				},
			]);

			setTimeline([]);
			setStreakDays(0);
			setStreakMultiplier(1);
			setHeatmap([]);
			setPostingSuggestions([]);
			setSimulatorLikes(0);
			return;
		}

		const creator = creatorData as CreatorRow;
		const creatorLikes = toFiniteNumber(likesMap[creator.id]);
		const creatorRankIndex = rankingRows.findIndex(
			(row) => row.creatorId === creator.id,
		);
		const creatorRank = creatorRankIndex >= 0 ? creatorRankIndex + 1 : null;
		const rewardPool = toFiniteNumber(openEpoch?.reward_pool);
		const top5Threshold = rankingRows[4]?.likes ?? 0;
		const estimatedReward = estimateRewardByRank(rewardPool, creatorRank);

		setEstimator({
			status: "ready",
			creatorId: creator.id,
			creatorName: creator.clone_name,
			epochId: openEpoch?.id ?? null,
			rewardPool,
			currentLikes: creatorLikes,
			currentRank: creatorRank,
			top5Threshold,
			estimatedReward,
			totalCreators: rankingRows.length,
		});

		setSimulatorLikes(creatorLikes);

		const { data: creatorPostsData } = await supabase
			.from("posts")
			.select("id, creator_id, epoch_id, created_at, commit_tx_hash")
			.eq("creator_id", creator.id)
			.order("created_at", { ascending: false })
			.limit(40);

		const creatorPosts = (creatorPostsData ?? []) as CreatorPostRow[];
		const creatorPostIds = creatorPosts.map((post) => post.id);

		let likeEvents: LikeRow[] = [];
		if (creatorPostIds.length > 0) {
			const { data: likesData } = await supabase
				.from("likes")
				.select("id, post_id, created_at")
				.in("post_id", creatorPostIds)
				.order("created_at", { ascending: false });
			likeEvents = (likesData ?? []) as LikeRow[];
		}

		const likeEventsForTimeline = likeEvents.slice(0, 20);

		const streakActivityDates = [
			...creatorPosts.map((post) => post.created_at),
			...likeEvents.map((like) => like.created_at),
		];
		const weeklyStreak = computeStreakDays(streakActivityDates);
		const multiplier = Math.min(1.35, 1 + weeklyStreak * 0.03);

		setStreakDays(weeklyStreak);
		setStreakMultiplier(multiplier);
		setHeatmap(buildHeatmapCells(streakActivityDates, 28));

		const likesPerPost = likeEvents.reduce<Record<string, number>>(
			(acc, item) => {
				acc[item.post_id] = (acc[item.post_id] ?? 0) + 1;
				return acc;
			},
			{},
		);

		const hourlyBuckets = Array.from({ length: 24 }, (_, hour) => ({
			hour,
			postCount: 0,
			likeCount: 0,
		}));
		creatorPosts.forEach((post) => {
			const hour = new Date(post.created_at).getHours();
			hourlyBuckets[hour].postCount += 1;
			hourlyBuckets[hour].likeCount += likesPerPost[post.id] ?? 0;
		});

		const suggestions = hourlyBuckets
			.filter((bucket) => bucket.postCount > 0)
			.map<PostingSuggestion>((bucket) => {
				const avgLikes = bucket.likeCount / bucket.postCount;
				return {
					hour: bucket.hour,
					avgLikes,
					posts: bucket.postCount,
					confidence:
						bucket.postCount >= 5
							? "high"
							: bucket.postCount >= 3
								? "medium"
								: "low",
				};
			})
			.sort((a, b) => b.avgLikes - a.avgLikes || b.posts - a.posts)
			.slice(0, 3);

		setPostingSuggestions(suggestions);

		const postsInEpoch = openEpoch ? toFiniteNumber(postsMap[creator.id]) : 0;
		const likesGoal = 5;
		const postGoal = 3;
		const top5Done = creatorRank !== null && creatorRank <= 5;
		const neededForTop5 = Math.max(0, top5Threshold + 1 - creatorLikes);

		setMissions([
			{
				id: "profile-ready",
				title: "Clone profile active",
				description: "Your creator identity is live and eligible for ranking.",
				progressLabel: "1 / 1 complete",
				progress: 100,
				done: true,
				href: "/onboarding",
			},
			{
				id: "publish-posts",
				title: "Publish 3 posts this epoch",
				description:
					"Consistent posting improves visibility and ranking performance.",
				progressLabel: `${postsInEpoch} / ${postGoal} posts`,
				progress: clampProgress((postsInEpoch / postGoal) * 100),
				done: postsInEpoch >= postGoal,
				href: "/feed",
			},
			{
				id: "earn-likes",
				title: "Reach 5 likes this epoch",
				description: "Likes are the core signal used to determine ranking.",
				progressLabel: `${creatorLikes} / ${likesGoal} likes`,
				progress: clampProgress((creatorLikes / likesGoal) * 100),
				done: creatorLikes >= likesGoal,
				href: "/feed",
			},
			{
				id: "top-five",
				title: "Enter Top 5 payout range",
				description: top5Done
					? "You are currently in payout range."
					: `Need around ${neededForTop5} more likes to break Top 5.`,
				progressLabel: creatorRank
					? `Current rank #${creatorRank}`
					: "Unranked",
				progress: top5Done
					? 100
					: clampProgress(
							(creatorLikes / Math.max(top5Threshold + 1, 1)) * 100,
						),
				done: top5Done,
				href: "/leaderboard",
			},
			{
				id: "streak",
				title: "Weekly consistency streak",
				description: `Keep daily post/engagement activity to raise your streak multiplier (${formatFixed(multiplier, 2)}x).`,
				progressLabel: `${weeklyStreak} day streak`,
				progress: clampProgress((weeklyStreak / 7) * 100),
				done: weeklyStreak >= 7,
				href: "/feed",
			},
		]);

		const postById = creatorPosts.reduce<Record<string, CreatorPostRow>>(
			(acc, post) => {
				acc[post.id] = post;
				return acc;
			},
			{},
		);

		const rewardEvents = rewardRows
			.filter(
				(row) =>
					(row.creator?.wallet_address ?? "").toLowerCase() ===
					creator.wallet_address.toLowerCase(),
			)
			.slice(0, 8)
			.map<TimelineEvent>((row) => ({
				id: `reward-${row.id}`,
				type: "reward",
				title: `Reward round: Epoch ${row.epoch_id}`,
				detail: `Rank #${row.rank} • ${formatFixed(row.reward_amount, 4)} tBNB`,
				at: row.epoch?.end_at ?? new Date().toISOString(),
				href: row.epoch?.payout_tx_hash
					? getExplorerUrl(row.epoch.payout_tx_hash)
					: undefined,
			}));

		const postEvents = creatorPosts.slice(0, 10).map<TimelineEvent>((post) => ({
			id: `post-${post.id}`,
			type: "post",
			title: "Published content",
			detail: `Epoch ${post.epoch_id}${post.commit_tx_hash ? " • Proof committed" : " • Awaiting commit"}`,
			at: post.created_at,
			href: `/post/${post.id}`,
		}));

		const likeTimelineEvents = likeEventsForTimeline
			.slice(0, 10)
			.map<TimelineEvent>((like) => ({
				id: `like-${like.id}`,
				type: "like",
				title: "Received a new like",
				detail:
					`Engagement on your post ${postById[like.post_id] ? `from epoch ${postById[like.post_id].epoch_id}` : ""}`.trim(),
				at: like.created_at,
				href: postById[like.post_id] ? `/post/${like.post_id}` : undefined,
			}));

		const mergedEvents = [...rewardEvents, ...postEvents, ...likeTimelineEvents]
			.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
			.slice(0, 12);

		setTimeline(mergedEvents);
	}

	const paymentStatus = (status: string) => {
		if (status === "paid") return "default" as const;
		if (status === "closed") return "secondary" as const;
		return "outline" as const;
	};

	const top5Thresholds = [0, 1, 2, 3, 4].map(
		(index) => rankings[index]?.likes ?? 0,
	);

	if (loading)
		return <PageLoader message="Syncing rewards and payout proofs..." />;

	return (
		<div className="container py-6 sm:py-8 md:py-10">
			<section className="relative mb-6 overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-background/95 via-background/88 to-amber-50/40 p-5 shadow-[0_18px_70px_-34px_rgba(245,158,11,0.55)] sm:mb-8 sm:p-6 md:p-8">
				<div className="pointer-events-none absolute right-[-5rem] top-[-4rem] h-56 w-56 rounded-full bg-[radial-gradient(circle,_rgba(245,158,11,0.24),_transparent_70%)] blur-2xl" />
				<div className="pointer-events-none absolute left-[-3rem] top-16 h-36 w-36 rounded-full bg-[radial-gradient(circle,_rgba(251,191,36,0.16),_transparent_72%)] blur-xl" />

				<div className="relative z-10">
					<div>
						<p className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
							<Sparkles className="h-3.5 w-3.5" />
							Creator Rewards
						</p>
						<h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
							Rewards
						</h1>
						<p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
							See where you stand this epoch, what to do next, and payout proof
							history in one place.
						</p>
					</div>
				</div>
			</section>

			<Card className="mb-6 border-border/70 bg-background/75">
				<CardContent className="grid gap-2 p-4 text-sm sm:grid-cols-3 sm:gap-3">
					<div className="rounded-xl border border-border/70 bg-background/70 p-3">
						<p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
							Step 1
						</p>
						<p className="mt-1 font-medium text-foreground">Check your rank</p>
						<p className="text-xs text-muted-foreground">
							Use the estimator to see your current position in this epoch.
						</p>
					</div>
					<div className="rounded-xl border border-border/70 bg-background/70 p-3">
						<p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
							Step 2
						</p>
						<p className="mt-1 font-medium text-foreground">
							Complete missions
						</p>
						<p className="text-xs text-muted-foreground">
							Follow the top mission actions to climb into Top 5 payout range.
						</p>
					</div>
					<div className="rounded-xl border border-border/70 bg-background/70 p-3">
						<p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
							Step 3
						</p>
						<p className="mt-1 font-medium text-foreground">Verify payouts</p>
						<p className="text-xs text-muted-foreground">
							When epochs close, confirm final rewards with onchain proof links.
						</p>
					</div>
				</CardContent>
			</Card>

			<motion.div
				initial={{ opacity: 0, y: 14 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4 }}
				className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
			>
				<Card className="border-border/70 bg-background/70">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							History rewards (filtered)
						</CardTitle>
					</CardHeader>
					<CardContent className="pt-0">
						<p className="text-2xl font-semibold tracking-tight">
							{formatFixed(totalRewardBnb, 3)} tBNB
						</p>
					</CardContent>
				</Card>

				<Card className="border-border/70 bg-background/70">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Paid epochs (filtered)
						</CardTitle>
					</CardHeader>
					<CardContent className="pt-0">
						<p className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
							<ShieldCheck className="h-5 w-5 text-primary" />
							{paidRecords}
						</p>
					</CardContent>
				</Card>

				<Card className="border-border/70 bg-background/70 sm:col-span-2 lg:col-span-1">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Rewarded creators (filtered)
						</CardTitle>
					</CardHeader>
					<CardContent className="pt-0">
						<p className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
							<Wallet className="h-5 w-5 text-primary" />
							{uniqueCreators}
						</p>
					</CardContent>
				</Card>
			</motion.div>

			<div className="mb-6 grid gap-4 lg:grid-cols-2">
				<Card className="border-border/70 bg-background/75">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
							<Trophy className="h-4 w-4 text-primary" />
							Personal Reward Estimator
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{insightsLoading ? (
							<InlineLoader label="Calculating your payout estimate..." />
						) : estimator.status === "disconnected" ? (
							<div className="rounded-xl border border-dashed border-border/70 bg-background/70 p-4">
								<p className="mb-3 text-sm text-muted-foreground">
									Connect your wallet to unlock personalized reward projections.
								</p>
								<Button asChild variant="outline" className="border-primary/35">
									<Link to="/">Connect wallet</Link>
								</Button>
							</div>
						) : estimator.status === "no-creator" ? (
							<div className="rounded-xl border border-dashed border-border/70 bg-background/70 p-4">
								<p className="mb-3 text-sm text-muted-foreground">
									No creator profile found for this wallet. Set up your clone to
									enter ranking cycles.
								</p>
								<Button asChild variant="outline" className="border-primary/35">
									<Link to="/onboarding">Create clone profile</Link>
								</Button>
							</div>
						) : (
							<>
								<div className="grid gap-3 sm:grid-cols-3">
									<div className="rounded-xl border border-border/70 bg-background/70 p-3">
										<p className="text-xs text-muted-foreground">
											Estimated payout
										</p>
										<p className="text-xl font-semibold tracking-tight">
											{formatFixed(estimator.estimatedReward, 4)} tBNB
										</p>
									</div>
									<div className="rounded-xl border border-border/70 bg-background/70 p-3">
										<p className="text-xs text-muted-foreground">
											Current rank
										</p>
										<p className="text-xl font-semibold tracking-tight">
											{estimator.currentRank
												? `#${estimator.currentRank}`
												: "-"}
										</p>
									</div>
									<div className="rounded-xl border border-border/70 bg-background/70 p-3">
										<p className="text-xs text-muted-foreground">Epoch likes</p>
										<p className="text-xl font-semibold tracking-tight">
											{estimator.currentLikes}
										</p>
									</div>
								</div>

								<div className="rounded-xl border border-primary/25 bg-primary/10 p-3 text-sm">
									<p className="font-medium text-foreground">
										{estimator.creatorName} · Epoch {estimator.epochId ?? "-"}
									</p>
									<p className="text-muted-foreground">
										Pool: {formatFixed(estimator.rewardPool, 2)} tBNB · Active
										creators: {estimator.totalCreators}
									</p>
									<p className="mt-1 text-muted-foreground">
										{estimator.currentRank && estimator.currentRank <= 5
											? "You are inside payout range. Keep posting and engagement steady to hold rank."
											: `Need about ${Math.max(0, estimator.top5Threshold + 1 - estimator.currentLikes)} more likes to challenge Top 5.`}
									</p>
								</div>
							</>
						)}
					</CardContent>
				</Card>

				<Card className="border-border/70 bg-background/75">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
							<Target className="h-4 w-4 text-primary" />
							Creator Growth Mission Board
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						{insightsLoading ? (
							<InlineLoader label="Updating mission progress..." />
						) : (
							visibleMissions.map((mission) => (
								<div
									key={mission.id}
									className="rounded-xl border border-border/70 bg-background/70 p-3"
								>
									<div className="mb-2 flex items-start justify-between gap-3">
										<div>
											<p className="text-sm font-semibold tracking-tight">
												{mission.title}
											</p>
											<p className="text-xs text-muted-foreground">
												{mission.description}
											</p>
										</div>
										{mission.done ? (
											<CheckCircle2 className="h-4 w-4 text-primary" />
										) : (
											<Rocket className="h-4 w-4 text-muted-foreground" />
										)}
									</div>

									<div className="mb-2 h-1.5 overflow-hidden rounded-full bg-secondary/70">
										<div
											className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
											style={{ width: `${mission.progress}%` }}
										/>
									</div>

									<div className="flex items-center justify-between">
										<span className="text-xs text-muted-foreground">
											{mission.progressLabel}
										</span>
										<Button
											asChild
											size="sm"
											variant="ghost"
											className="h-7 px-2 text-xs text-primary hover:text-primary"
										>
											<Link to={mission.href}>Go</Link>
										</Button>
									</div>
								</div>
							))
						)}

						{!insightsLoading && (
							<div className="rounded-xl border border-primary/25 bg-primary/10 p-3">
								<div className="mb-1 flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
									<Flame className="h-4 w-4 text-primary" />
									Mission Streak Rewards
								</div>
								<p className="text-xs text-muted-foreground">
									Current streak:{" "}
									<span className="font-semibold text-foreground">
										{streakDays} days
									</span>{" "}
									· Multiplier:
									<span className="font-semibold text-foreground">
										{" "}
										{formatFixed(streakMultiplier, 2)}x
									</span>
								</p>
							</div>
						)}

						{!insightsLoading && hiddenMissionCount > 0 ? (
							<Button
								variant="outline"
								size="sm"
								className="w-full border-primary/30"
								onClick={() => setShowAllMissions((value) => !value)}
							>
								{showAllMissions
									? "Show fewer missions"
									: `Show ${hiddenMissionCount} more mission${hiddenMissionCount > 1 ? "s" : ""}`}
							</Button>
						) : null}
					</CardContent>
				</Card>
			</div>

			<Card className="mb-6 border-border/70 bg-background/75">
				<CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<p className="text-sm font-semibold tracking-tight text-foreground">
							Advanced insights
						</p>
						<p className="text-xs text-muted-foreground">
							Optional tools for simulation, comparison, and activity analysis.
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						className="w-full border-primary/30 sm:w-auto"
						onClick={() => setShowAdvancedInsights((value) => !value)}
					>
						{showAdvancedInsights
							? "Hide advanced insights"
							: "Show advanced insights"}
					</Button>
				</CardContent>
			</Card>

			{showAdvancedInsights ? (
				<>
					<div className="mb-6 grid gap-4 lg:grid-cols-2">
						<Card className="border-border/70 bg-background/75">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
									<Sparkles className="h-4 w-4 text-primary" />
									Epoch Simulator
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<p className="text-sm text-muted-foreground">
									Simulate a like target to estimate likely rank and payout in
									the current epoch before publishing your next post.
								</p>

								<div className="rounded-xl border border-border/70 bg-background/70 p-3">
									<div className="mb-2 flex items-center justify-between text-sm">
										<span className="text-muted-foreground">Target likes</span>
										<span className="font-semibold text-foreground">
											{simulatorLikes}
										</span>
									</div>

									<Slider
										value={[simulatorLikes]}
										min={0}
										max={SIMULATOR_MAX_LIKES}
										step={1}
										onValueChange={(values) =>
											setSimulatorLikes(toFiniteNumber(values[0]))
										}
									/>

									<div className="mt-3">
										<Input
											type="number"
											min={0}
											max={SIMULATOR_MAX_LIKES}
											value={simulatorLikes}
											onChange={(event) =>
												setSimulatorLikes(
													Math.max(
														0,
														Math.min(
															SIMULATOR_MAX_LIKES,
															toFiniteNumber(event.target.value),
														),
													),
												)
											}
										/>
									</div>
								</div>

								<div className="grid gap-3 sm:grid-cols-2">
									<div className="rounded-xl border border-border/70 bg-background/70 p-3">
										<p className="text-xs text-muted-foreground">
											Projected rank
										</p>
										<p className="text-xl font-semibold tracking-tight">
											#{simulatorRank}
										</p>
									</div>
									<div className="rounded-xl border border-border/70 bg-background/70 p-3">
										<p className="text-xs text-muted-foreground">
											Projected payout
										</p>
										<p className="text-xl font-semibold tracking-tight">
											{formatFixed(simulatorEstimatedReward, 4)} tBNB
										</p>
									</div>
								</div>

								<div className="rounded-xl border border-border/70 bg-background/70 p-3">
									<p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
										Top 5 cutoff snapshot
									</p>
									<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
										{top5Thresholds.map((likes, index) => (
											<div
												key={`cutoff-${index}`}
												className="rounded-lg border border-border/60 bg-background px-2 py-1.5 text-center"
											>
												<p className="text-[11px] text-muted-foreground">
													Rank #{index + 1}
												</p>
												<p className="text-sm font-semibold">{likes}</p>
											</div>
										))}
									</div>
								</div>
							</CardContent>
						</Card>

						<Card className="border-border/70 bg-background/75">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
									<ShieldCheck className="h-4 w-4 text-primary" />
									Creator Compare Mode
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<p className="text-sm text-muted-foreground">
									Compare two creators side-by-side to understand relative
									momentum and payout position.
								</p>

								<div className="grid gap-3 sm:grid-cols-2">
									<Select
										value={compareLeftId}
										onValueChange={setCompareLeftId}
									>
										<SelectTrigger className="border-primary/25 bg-background/80">
											<SelectValue placeholder="Select creator A" />
										</SelectTrigger>
										<SelectContent>
											{creators.map((creator) => (
												<SelectItem key={creator.id} value={creator.id}>
													{creator.clone_name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>

									<Select
										value={compareRightId}
										onValueChange={setCompareRightId}
									>
										<SelectTrigger className="border-primary/25 bg-background/80">
											<SelectValue placeholder="Select creator B" />
										</SelectTrigger>
										<SelectContent>
											{creators.map((creator) => (
												<SelectItem key={creator.id} value={creator.id}>
													{creator.clone_name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="grid gap-3 sm:grid-cols-2">
									<div className="rounded-xl border border-border/70 bg-background/70 p-3">
										<p className="truncate text-sm font-semibold tracking-tight">
											{compareLeft?.clone_name ?? "Select creator"}
										</p>
										<p className="text-xs text-muted-foreground">
											{shortAddress(compareLeft?.wallet_address)}
										</p>
										<div className="mt-2 space-y-1 text-sm">
											<p>
												Rank:{" "}
												<span className="font-semibold">
													{leftMetrics.rank ? `#${leftMetrics.rank}` : "-"}
												</span>
											</p>
											<p>
												Likes:{" "}
												<span className="font-semibold">
													{leftMetrics.likes}
												</span>
											</p>
											<p>
												Posts:{" "}
												<span className="font-semibold">
													{leftMetrics.epochPosts}
												</span>
											</p>
											<p>
												Est. payout:{" "}
												<span className="font-semibold">
													{formatFixed(leftMetrics.payout, 4)} tBNB
												</span>
											</p>
										</div>
									</div>

									<div className="rounded-xl border border-border/70 bg-background/70 p-3">
										<p className="truncate text-sm font-semibold tracking-tight">
											{compareRight?.clone_name ?? "Select creator"}
										</p>
										<p className="text-xs text-muted-foreground">
											{shortAddress(compareRight?.wallet_address)}
										</p>
										<div className="mt-2 space-y-1 text-sm">
											<p>
												Rank:{" "}
												<span className="font-semibold">
													{rightMetrics.rank ? `#${rightMetrics.rank}` : "-"}
												</span>
											</p>
											<p>
												Likes:{" "}
												<span className="font-semibold">
													{rightMetrics.likes}
												</span>
											</p>
											<p>
												Posts:{" "}
												<span className="font-semibold">
													{rightMetrics.epochPosts}
												</span>
											</p>
											<p>
												Est. payout:{" "}
												<span className="font-semibold">
													{formatFixed(rightMetrics.payout, 4)} tBNB
												</span>
											</p>
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>

					<div className="mb-6 grid gap-4 lg:grid-cols-2">
						<Card className="border-border/70 bg-background/75">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
									<CalendarDays className="h-4 w-4 text-primary" />
									Creator Performance Heatmap
								</CardTitle>
							</CardHeader>
							<CardContent>
								{insightsLoading ? (
									<InlineLoader label="Building activity heatmap..." />
								) : heatmap.length === 0 ? (
									<p className="rounded-xl border border-dashed border-border/70 bg-background/70 px-3 py-5 text-sm text-muted-foreground">
										No activity yet. Publish and engage to generate your
										performance map.
									</p>
								) : (
									<>
										<div className="grid grid-cols-7 gap-1.5">
											{heatmap.map((cell) => {
												const levelClass =
													cell.level === 0
														? "bg-secondary/60"
														: cell.level === 1
															? "bg-amber-200/40 dark:bg-amber-500/20"
															: cell.level === 2
																? "bg-amber-300/55 dark:bg-amber-500/35"
																: cell.level === 3
																	? "bg-amber-400/70 dark:bg-amber-400/50"
																	: "bg-amber-500/85 dark:bg-amber-300/70";

												return (
													<div
														key={cell.dateKey}
														title={`${cell.dateKey}: ${cell.count} activities`}
														className={`h-7 rounded-md border border-border/60 ${levelClass}`}
													/>
												);
											})}
										</div>

										<div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
											<span>Last 28 days</span>
											<span>Higher intensity = more post/like activity</span>
										</div>
									</>
								)}
							</CardContent>
						</Card>

						<Card className="border-border/70 bg-background/75">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
									<Clock3 className="h-4 w-4 text-primary" />
									Smart Posting Window Suggestions
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-2.5">
								{insightsLoading ? (
									<InlineLoader label="Analyzing like velocity by posting hour..." />
								) : postingSuggestions.length === 0 ? (
									<p className="rounded-xl border border-dashed border-border/70 bg-background/70 px-3 py-5 text-sm text-muted-foreground">
										Not enough posting history yet. Publish a few posts and this
										panel will suggest optimal windows.
									</p>
								) : (
									postingSuggestions.map((item, index) => (
										<div
											key={`window-${item.hour}`}
											className="rounded-xl border border-border/70 bg-background/70 p-3"
										>
											<div className="mb-1 flex items-center justify-between gap-3">
												<p className="text-sm font-semibold tracking-tight">
													#{index + 1} {formatHourWindow(item.hour)}
												</p>
												<Badge variant="outline" className="capitalize">
													{item.confidence}
												</Badge>
											</div>
											<p className="text-xs text-muted-foreground">
												Avg likes/post:{" "}
												<span className="font-semibold text-foreground">
													{formatFixed(item.avgLikes, 2)}
												</span>{" "}
												· Sample posts:{" "}
												<span className="font-semibold text-foreground">
													{item.posts}
												</span>
											</p>
										</div>
									))
								)}
							</CardContent>
						</Card>
					</div>

					<Card className="mb-6 border-border/70 bg-background/75">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
								<Clock3 className="h-4 w-4 text-primary" />
								Wallet Activity Timeline
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2">
							{insightsLoading ? (
								<InlineLoader label="Loading wallet timeline..." />
							) : timeline.length === 0 ? (
								<p className="rounded-xl border border-dashed border-border/70 bg-background/70 px-3 py-5 text-sm text-muted-foreground">
									No wallet activity yet. Start posting and earning likes to
									build your timeline.
								</p>
							) : (
								timeline.map((event) => (
									<div
										key={event.id}
										className="flex flex-col gap-2 rounded-xl border border-border/70 bg-background/70 px-3 py-2.5 sm:flex-row sm:items-start sm:gap-3"
									>
										<span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
											{event.type === "reward" ? (
												<Trophy className="h-3.5 w-3.5 text-primary" />
											) : event.type === "post" ? (
												<Rocket className="h-3.5 w-3.5 text-primary" />
											) : (
												<Sparkles className="h-3.5 w-3.5 text-primary" />
											)}
										</span>

										<div className="min-w-0 flex-1">
											<div className="flex items-center justify-between gap-3">
												<p className="truncate text-sm font-semibold tracking-tight">
													{event.title}
												</p>
												<span className="shrink-0 text-[11px] text-muted-foreground">
													{timeAgoLabel(event.at)}
												</span>
											</div>
											<p className="text-xs text-muted-foreground">
												{event.detail}
											</p>
										</div>

										{event.href ? (
											<a
												href={event.href}
												target={
													event.href.startsWith("http") ? "_blank" : undefined
												}
												rel={
													event.href.startsWith("http")
														? "noopener noreferrer"
														: undefined
												}
												className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
											>
												<ExternalLink className="h-3.5 w-3.5" />
											</a>
										) : null}
									</div>
								))
							)}
						</CardContent>
					</Card>
				</>
			) : null}

			<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 className="text-lg font-semibold tracking-tight">
						Payout history
					</h2>
					<p className="text-sm text-muted-foreground">
						Review finalized rewards and payout proof by epoch.
					</p>
				</div>
				<Select value={epochFilter} onValueChange={setEpochFilter}>
					<SelectTrigger className="h-10 w-full border-primary/25 bg-background/80 sm:w-[180px]">
						<SelectValue placeholder="History epoch" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Epochs</SelectItem>
						{epochs.map((epoch) => (
							<SelectItem key={epoch.id} value={String(epoch.id)}>
								Epoch {epoch.id}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{filtered.length === 0 ? (
				<Card className="border-dashed border-border/70 bg-background/60">
					<CardContent className="py-16 text-center">
						<p className="mb-4 text-muted-foreground">
							No reward records yet. Winners appear here once an epoch closes
							and payout runs.
						</p>
						<Button asChild variant="outline" className="border-primary/35">
							<Link to="/leaderboard">See current leaderboard</Link>
						</Button>
					</CardContent>
				</Card>
			) : (
				<Card className="overflow-hidden border-border/70 bg-background/75">
					<CardContent className="p-0">
						<div className="divide-y divide-border/60 md:hidden">
							{filtered.map((reward, idx) => (
								<motion.div
									key={reward.id}
									custom={idx}
									initial="hidden"
									whileInView="visible"
									viewport={{ once: true }}
									variants={rowReveal}
									className="space-y-3 p-4"
								>
									<div className="flex items-center justify-between gap-2">
										<Badge variant="outline" className="border-primary/30">
											Epoch {reward.epoch_id}
										</Badge>
										<Badge
											variant={paymentStatus(reward.epoch?.status ?? "open")}
											className="capitalize"
										>
											{reward.epoch?.status ?? "open"}
										</Badge>
									</div>

									<div>
										<p className="text-sm font-semibold tracking-tight">
											{reward.creator?.clone_name || "Unknown creator"}
										</p>
										<p className="text-xs text-muted-foreground">
											{shortAddress(reward.creator?.wallet_address)}
										</p>
									</div>

									<div className="grid grid-cols-3 gap-2 rounded-xl border border-border/70 bg-background/70 p-2.5 text-center">
										<div>
											<p className="text-[11px] text-muted-foreground">Rank</p>
											<p className="text-sm font-semibold">#{reward.rank}</p>
										</div>
										<div>
											<p className="text-[11px] text-muted-foreground">Likes</p>
											<p className="text-sm font-semibold">
												{reward.like_count}
											</p>
										</div>
										<div>
											<p className="text-[11px] text-muted-foreground">
												Reward
											</p>
											<p className="text-sm font-semibold">
												{formatFixed(reward.reward_amount, 4)}
											</p>
										</div>
									</div>

									{reward.epoch?.payout_tx_hash ? (
										<a
											href={getExplorerUrl(reward.epoch.payout_tx_hash)}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
										>
											Tx Proof
											<ExternalLink className="h-3 w-3" />
										</a>
									) : (
										<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
											<Clock3 className="h-3 w-3" /> Pending
										</span>
									)}
								</motion.div>
							))}
						</div>

						<div className="hidden overflow-x-auto md:block">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Epoch</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Rank</TableHead>
										<TableHead>Creator</TableHead>
										<TableHead className="text-right">Likes</TableHead>
										<TableHead className="text-right">Reward</TableHead>
										<TableHead>Proof</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filtered.map((reward, idx) => (
										<motion.tr
											key={reward.id}
											custom={idx}
											initial="hidden"
											whileInView="visible"
											viewport={{ once: true }}
											variants={rowReveal}
											className="border-b border-border/60 transition-colors hover:bg-amber-50/30 dark:hover:bg-amber-500/5"
										>
											<TableCell>
												<Badge variant="outline" className="border-primary/30">
													Epoch {reward.epoch_id}
												</Badge>
											</TableCell>
											<TableCell>
												<Badge
													variant={paymentStatus(
														reward.epoch?.status ?? "open",
													)}
													className="capitalize"
												>
													{reward.epoch?.status ?? "open"}
												</Badge>
											</TableCell>
											<TableCell className="font-semibold">
												#{reward.rank}
											</TableCell>
											<TableCell>
												<p className="text-sm font-semibold tracking-tight">
													{reward.creator?.clone_name || "Unknown creator"}
												</p>
												<p className="text-xs text-muted-foreground">
													{shortAddress(reward.creator?.wallet_address)}
												</p>
											</TableCell>
											<TableCell className="text-right">
												{reward.like_count}
											</TableCell>
											<TableCell className="text-right font-medium">
												{formatFixed(reward.reward_amount, 4)} tBNB
											</TableCell>
											<TableCell>
												{reward.epoch?.payout_tx_hash ? (
													<a
														href={getExplorerUrl(reward.epoch.payout_tx_hash)}
														target="_blank"
														rel="noopener noreferrer"
														className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
													>
														Tx Proof
														<ExternalLink className="h-3 w-3" />
													</a>
												) : (
													<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
														<Clock3 className="h-3 w-3" /> Pending
													</span>
												)}
											</TableCell>
										</motion.tr>
									))}
								</TableBody>
							</Table>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
