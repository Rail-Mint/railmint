import { useConnectModal } from "@rainbow-me/rainbowkit";
import { motion } from "framer-motion";
import {
	ArrowLeft,
	BarChart3,
	ChevronLeft,
	ChevronRight,
	FileText,
	Gift,
	LayoutGrid,
	Menu,
	Settings,
	Shield,
	Sparkles,
	Trophy,
	UserCog,
	WalletCards,
	X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAccount, useConnect } from "wagmi";
// eslint-disable-next-line @typescript-eslint/no-deprecated
import { BrandMark } from "@/components/branding/BrandMark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { supabase } from "@/integrations/supabase/client";

type CreatorProfile = {
	id: string;
	clone_name: string;
	x_handle: string | null;
	persona_text: string;
	prompt_template: string;
	wallet_address: string;
} | null;

type StudioStats = {
	postsCount: number;
	rewardRows: number;
};

type RewardRow = {
	id: string;
	epoch_id: number;
	rank: number;
	like_count: number;
	reward_amount: number | string;
	epoch?: {
		id: number;
		status: string;
		end_at: string;
		reward_pool: number;
		payout_tx_hash: string | null;
	} | null;
	creator?: {
		clone_name: string;
		wallet_address: string;
	} | null;
};

type PostPreview = {
	id: string;
	content_text: string;
	created_at: string;
	epoch_id: number;
	commit_tx_hash: string | null;
	like_count: number;
};

type ProfileFormState = {
	clone_name: string;
	x_handle: string;
	persona_text: string;
	prompt_template: string;
};

const DEFAULT_PROFILE_FORM: ProfileFormState = {
	clone_name: "",
	x_handle: "",
	persona_text: "",
	prompt_template: "",
};

type NavItem = {
	key:
		| "overview"
		| "profile"
		| "content"
		| "analytics"
		| "leaderboard"
		| "rewards"
		| "wallet"
		| "security"
		| "settings";
	label: string;
	description: string;
	icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
	{
		key: "overview",
		label: "Overview",
		description: "Studio summary and quick actions",
		icon: LayoutGrid,
	},
	{
		key: "profile",
		label: "Profile",
		description: "Clone identity and persona",
		icon: UserCog,
	},
	{
		key: "content",
		label: "Content",
		description: "Publishing and feed workflow",
		icon: FileText,
	},
	{
		key: "analytics",
		label: "Analytics",
		description: "Engagement and growth metrics",
		icon: BarChart3,
	},
	{
		key: "leaderboard",
		label: "Leaderboard",
		description: "Rank tracking and momentum",
		icon: Trophy,
	},
	{
		key: "rewards",
		label: "Rewards",
		description: "Payouts and incentives",
		icon: Gift,
	},
	{
		key: "wallet",
		label: "Wallet",
		description: "Funding and payout addresses",
		icon: WalletCards,
	},
	{
		key: "security",
		label: "Security",
		description: "Session and access controls",
		icon: Shield,
	},
	{
		key: "settings",
		label: "Settings",
		description: "Studio preferences",
		icon: Settings,
	},
];

function navHref(key: NavItem["key"]) {
	return key === "overview" ? "/studio" : `/studio/${key}`;
}

function sectionTitle(key: NavItem["key"]) {
	return navItems.find((item) => item.key === key)?.label ?? "Overview";
}

function resolveWalletLoginError(error: unknown, connectorName: string) {
	const retryHint = `Please click ${connectorName} again to sign in.`;
	const message =
		error instanceof Error
			? error.message.trim()
			: typeof error === "string"
				? error.trim()
				: "";
	const normalized = message.toLowerCase();
	const maybeCode =
		typeof error === "object" && error !== null && "code" in error
			? Number((error as { code?: unknown }).code)
			: null;

	if (
		maybeCode === 4001 ||
		normalized.includes("user rejected") ||
		normalized.includes("user denied") ||
		normalized.includes("rejected the request") ||
		normalized.includes("cancel") ||
		normalized.includes("closed")
	) {
		return `Login was cancelled in ${connectorName}. ${retryHint}`;
	}

	if (!message) {
		return `Could not connect with ${connectorName}. ${retryHint}`;
	}

	return `${message} ${retryHint}`;
}

function isWalletConnectConnector(connector: { id: string; name: string }) {
	const id = connector.id.toLowerCase();
	const name = connector.name.toLowerCase();
	return id.includes("walletconnect") || name.includes("walletconnect");
}

function isBrowserWalletConnector(connector: { id: string; name: string }) {
	const id = connector.id.toLowerCase();
	const name = connector.name.toLowerCase();
	return (
		id.includes("injected") ||
		name.includes("browser wallet") ||
		name === "injected"
	);
}

export default function Studio() {
	const { address, isConnected } = useAccount();
	const { connectAsync, connectors, status, variables } = useConnect();
	const { openConnectModal } = useConnectModal();
	const navigate = useNavigate();
	const location = useLocation();
	const [profile, setProfile] = useState<CreatorProfile>(null);
	const [stats, setStats] = useState<StudioStats>({
		postsCount: 0,
		rewardRows: 0,
	});
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
	const [isLeavingToFeed, setIsLeavingToFeed] = useState(false);
	const [connectError, setConnectError] = useState<string | null>(null);
	const [loadingData, setLoadingData] = useState(false);
	const [dataError, setDataError] = useState<string | null>(null);
	const [recentPosts, setRecentPosts] = useState<PostPreview[]>([]);
	const [rewardHistory, setRewardHistory] = useState<RewardRow[]>([]);
	const [topOpenRows, setTopOpenRows] = useState<RewardRow[]>([]);
	const [openEpoch, setOpenEpoch] = useState<RewardRow["epoch"] | null>(null);
	const [profileForm, setProfileForm] =
		useState<ProfileFormState>(DEFAULT_PROFILE_FORM);
	const [profileSaveState, setProfileSaveState] = useState<
		"idle" | "saving" | "saved" | "error"
	>("idle");
	const [profileSaveMessage, setProfileSaveMessage] = useState<string | null>(
		null,
	);
	const [studioDensityCompact, setStudioDensityCompact] = useState(false);
	const [autoCollapseSidebar, setAutoCollapseSidebar] = useState(false);
	const [desktopSidebarHidden, setDesktopSidebarHidden] = useState(false);
	const [showConnectTransition, setShowConnectTransition] = useState(false);
	const [showDisconnectTransition, setShowDisconnectTransition] =
		useState(false);
	const backTimerRef = useRef<number | null>(null);
	const pendingWalletLoginRef = useRef<string | null>(null);
	const wasConnectedRef = useRef(isConnected);
	const connectTransitionTimerRef = useRef<number | null>(null);
	const disconnectTransitionTimerRef = useRef<number | null>(null);

	const shortAddress = (wallet?: string | null) => {
		if (!wallet) return "--";
		return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
	};

	const formatDate = (value?: string | null) => {
		if (!value) return "--";
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return "--";
		return date.toLocaleDateString();
	};

	const formatReward = (value: number | string) =>
		Number(value || 0).toFixed(3);

	const activeSection = useMemo<NavItem["key"]>(() => {
		const segment = location.pathname.split("/")[2];
		if (!segment) return "overview";
		const matched = navItems.find((item) => item.key === segment);
		return matched ? matched.key : "overview";
	}, [location.pathname]);

	const connectorOptions = useMemo(() => {
		const raw = connectors.filter(
			(connector) => connector.id !== "mock" && connector.id !== "safe",
		);
		const used = new Set<string>();
		const unique: typeof raw = [];
		for (const connector of raw) {
			const key = `${connector.name.toLowerCase().trim()}-${connector.id}`;
			if (used.has(key)) continue;
			used.add(key);
			unique.push(connector);
		}
		return unique;
	}, [connectors]);

	const topConnectorOptions = useMemo(() => {
		const source = connectorOptions.filter(
			(connector) =>
				!isWalletConnectConnector(connector) &&
				!isBrowserWalletConnector(connector),
		);
		const used = new Set<string>();
		const ordered: typeof source = [];

		const priorityMatchers = [
			(name: string) => name.includes("metamask"),
			(name: string) => name.includes("trust"),
			(name: string) => name.includes("brave"),
			(name: string) => name.includes("base"),
			(name: string) => name.includes("coinbase"),
			(name: string) => name.includes("rainbow"),
		];

		for (const matcher of priorityMatchers) {
			const match = source.find((connector) => {
				const normalized = connector.name.toLowerCase();
				return !used.has(normalized) && matcher(normalized);
			});
			if (match) {
				ordered.push(match);
				used.add(match.name.toLowerCase());
			}
		}

		for (const connector of source) {
			const normalized = connector.name.toLowerCase();
			if (used.has(normalized)) continue;
			ordered.push(connector);
			used.add(normalized);
			if (ordered.length >= 4) break;
		}

		return ordered.slice(0, 4);
	}, [connectorOptions]);

	function resolveWalletLogo(connectorName: string) {
		const name = connectorName.toLowerCase();
		if (name.includes("metamask")) return "/brand/metamask.png";
		if (name.includes("trust")) return "/brand/trust-wallet.png";
		if (name.includes("base")) return "/brand/coinbase-wallet.png";
		if (name.includes("coinbase")) return "/brand/coinbase-wallet.png";
		if (name.includes("brave")) return "/brand/brave-wallet.png";
		if (name.includes("walletconnect")) return "/brand/rainbow.png";
		if (name.includes("rainbow")) return "/brand/rainbow.png";
		return "/brand/rainbow.png";
	}

	function handleBackToFeed() {
		if (isLeavingToFeed) return;
		setIsLeavingToFeed(true);
		if (backTimerRef.current) {
			window.clearTimeout(backTimerRef.current);
		}
		backTimerRef.current = window.setTimeout(() => {
			navigate("/");
		}, 220);
	}

	async function handleConnectorConnect(
		connector: (typeof connectorOptions)[number],
	) {
		setConnectError(null);
		pendingWalletLoginRef.current = connector.name;
		try {
			if (connector.type === "injected") {
				const provider = await connector.getProvider();
				if (!provider) {
					pendingWalletLoginRef.current = null;
					setConnectError(
						`${connector.name} is not available in this browser. Please unlock/install it and login again.`,
					);
					return;
				}
			}

			await connectAsync({ connector });
		} catch (error) {
			pendingWalletLoginRef.current = null;
			const message = resolveWalletLoginError(error, connector.name);
			setConnectError(message);
		}
	}

	useEffect(() => {
		if (isConnected) {
			pendingWalletLoginRef.current = null;
			return;
		}

		if (status === "pending") return;

		const connectorName = pendingWalletLoginRef.current;
		if (!connectorName || connectError) return;

		pendingWalletLoginRef.current = null;
		setConnectError(
			`Login was not completed in ${connectorName}. Please click ${connectorName} again to sign in.`,
		);
	}, [connectError, isConnected, status]);

	useEffect(() => {
		const wasConnected = wasConnectedRef.current;

		if (!wasConnected && isConnected) {
			setShowConnectTransition(true);
			if (connectTransitionTimerRef.current) {
				window.clearTimeout(connectTransitionTimerRef.current);
			}
			connectTransitionTimerRef.current = window.setTimeout(() => {
				setShowConnectTransition(false);
				connectTransitionTimerRef.current = null;
			}, 700);
		}

		if (wasConnected && !isConnected) {
			setShowConnectTransition(false);
			if (connectTransitionTimerRef.current) {
				window.clearTimeout(connectTransitionTimerRef.current);
				connectTransitionTimerRef.current = null;
			}
			setShowDisconnectTransition(true);
			if (disconnectTransitionTimerRef.current) {
				window.clearTimeout(disconnectTransitionTimerRef.current);
			}
			disconnectTransitionTimerRef.current = window.setTimeout(() => {
				setShowDisconnectTransition(false);
				disconnectTransitionTimerRef.current = null;
			}, 760);
		}

		if (isConnected) {
			setShowDisconnectTransition(false);
			if (disconnectTransitionTimerRef.current) {
				window.clearTimeout(disconnectTransitionTimerRef.current);
				disconnectTransitionTimerRef.current = null;
			}
		} else if (showConnectTransition) {
			setShowConnectTransition(false);
		}

		wasConnectedRef.current = isConnected;
	}, [isConnected]);

	useEffect(() => {
		return () => {
			if (backTimerRef.current) {
				window.clearTimeout(backTimerRef.current);
			}
			if (connectTransitionTimerRef.current) {
				window.clearTimeout(connectTransitionTimerRef.current);
			}
			if (disconnectTransitionTimerRef.current) {
				window.clearTimeout(disconnectTransitionTimerRef.current);
			}
		};
	}, []);

	useEffect(() => {
		const preferenceKey = "railmint.studio.preferences.v1";

		const raw = window.localStorage.getItem(preferenceKey);
		if (!raw) return;
		try {
			const parsed = JSON.parse(raw) as {
				densityCompact?: boolean;
				autoCollapse?: boolean;
				sidebarHidden?: boolean;
			};
			setStudioDensityCompact(Boolean(parsed.densityCompact));
			setAutoCollapseSidebar(Boolean(parsed.autoCollapse));
			setDesktopSidebarHidden(Boolean(parsed.sidebarHidden));
			if (parsed.autoCollapse) {
				setSidebarCollapsed(true);
			}
		} catch {
			window.localStorage.removeItem(preferenceKey);
		}
	}, []);

	useEffect(() => {
		window.localStorage.setItem(
			"railmint.studio.preferences.v1",
			JSON.stringify({
				densityCompact: studioDensityCompact,
				autoCollapse: autoCollapseSidebar,
				sidebarHidden: desktopSidebarHidden,
			}),
		);
	}, [studioDensityCompact, autoCollapseSidebar, desktopSidebarHidden]);

	useEffect(() => {
		if (!address) {
			setProfile(null);
			setStats({ postsCount: 0, rewardRows: 0 });
			setRecentPosts([]);
			setRewardHistory([]);
			setTopOpenRows([]);
			setOpenEpoch(null);
			setDataError(null);
			setProfileForm(DEFAULT_PROFILE_FORM);
			return;
		}

		let cancelled = false;
		setLoadingData(true);
		setDataError(null);

		void (async () => {
			try {
				const [creatorResult, openEpochResult] = await Promise.all([
					supabase
						.from("creators")
						.select(
							"id, clone_name, x_handle, persona_text, prompt_template, wallet_address",
						)
						.ilike("wallet_address", address)
						.maybeSingle(),
					supabase
						.from("epochs")
						.select("id, status, end_at, reward_pool, payout_tx_hash")
						.eq("status", "open")
						.order("id", { ascending: false })
						.limit(1)
						.maybeSingle(),
				]);

				if (cancelled) return;

				const creator = creatorResult.data;
				setProfile(creator ?? null);
				setProfileForm(
					creator
						? {
								clone_name: creator.clone_name,
								x_handle: creator.x_handle ?? "",
								persona_text: creator.persona_text,
								prompt_template: creator.prompt_template,
							}
						: DEFAULT_PROFILE_FORM,
				);

				setOpenEpoch(openEpochResult.data ?? null);

				if (!creator?.id) {
					setStats({ postsCount: 0, rewardRows: 0 });
					setRecentPosts([]);
					setRewardHistory([]);
					setTopOpenRows([]);
					setLoadingData(false);
					return;
				}

				const [postCountResult, rewardCountResult, postsResult, rewardsResult] =
					await Promise.all([
						supabase
							.from("posts")
							.select("id", { count: "exact", head: true })
							.eq("creator_id", creator.id),
						supabase
							.from("epoch_rewards")
							.select("id", { count: "exact", head: true })
							.eq("creator_id", creator.id),
						supabase
							.from("posts")
							.select("id, content_text, created_at, epoch_id, commit_tx_hash")
							.eq("creator_id", creator.id)
							.order("created_at", { ascending: false })
							.limit(20),
						supabase
							.from("epoch_rewards")
							.select(
								"id, epoch_id, rank, like_count, reward_amount, epoch:epochs(id, status, end_at, reward_pool, payout_tx_hash)",
							)
							.eq("creator_id", creator.id)
							.order("epoch_id", { ascending: false })
							.limit(16),
					]);

				const rawPosts =
					(postsResult.data as Omit<PostPreview, "like_count">[] | null) ?? [];
				const likesResult = rawPosts.length
					? await supabase
							.from("likes")
							.select("post_id")
							.in(
								"post_id",
								rawPosts.map((post) => post.id),
							)
					: { data: [] as { post_id: string }[] };

				if (cancelled) return;

				const likeCountMap = new Map<string, number>();
				for (const row of likesResult.data ?? []) {
					likeCountMap.set(
						row.post_id,
						(likeCountMap.get(row.post_id) ?? 0) + 1,
					);
				}

				setRecentPosts(
					rawPosts.map((post) => ({
						...post,
						like_count: likeCountMap.get(post.id) ?? 0,
					})),
				);
				setRewardHistory((rewardsResult.data as RewardRow[] | null) ?? []);
				setStats({
					postsCount: postCountResult.count ?? 0,
					rewardRows: rewardCountResult.count ?? 0,
				});

				if (openEpochResult.data?.id) {
					const openTopResult = await supabase
						.from("epoch_rewards")
						.select(
							"id, epoch_id, rank, like_count, reward_amount, creator:creators(clone_name, wallet_address)",
						)
						.eq("epoch_id", openEpochResult.data.id)
						.order("rank", { ascending: true })
						.limit(5);
					if (!cancelled) {
						setTopOpenRows((openTopResult.data as RewardRow[] | null) ?? []);
					}
				} else {
					setTopOpenRows([]);
				}
			} catch (error) {
				if (!cancelled) {
					setDataError(
						error instanceof Error
							? error.message
							: "Unable to load studio data.",
					);
				}
			} finally {
				if (!cancelled) {
					setLoadingData(false);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [address]);

	const recentPostsLast7Days = useMemo(() => {
		const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
		return recentPosts.filter(
			(post) => new Date(post.created_at).getTime() >= cutoff,
		).length;
	}, [recentPosts]);

	const totalLikes = useMemo(
		() => recentPosts.reduce((sum, post) => sum + post.like_count, 0),
		[recentPosts],
	);

	const averageLikes = useMemo(() => {
		if (!recentPosts.length) return 0;
		return totalLikes / recentPosts.length;
	}, [recentPosts, totalLikes]);

	const bestPost = useMemo(() => {
		if (!recentPosts.length) return null;
		return [...recentPosts].sort((a, b) => b.like_count - a.like_count)[0];
	}, [recentPosts]);

	const openEpochReward = useMemo(() => {
		if (!openEpoch?.id) return null;
		return rewardHistory.find((row) => row.epoch_id === openEpoch.id) ?? null;
	}, [rewardHistory, openEpoch]);

	async function handleSaveProfile() {
		if (!profile?.id) return;
		setProfileSaveState("saving");
		setProfileSaveMessage(null);

		const { error } = await supabase
			.from("creators")
			.update({
				clone_name: profileForm.clone_name.trim(),
				x_handle: profileForm.x_handle.trim() || null,
				persona_text: profileForm.persona_text.trim(),
				prompt_template: profileForm.prompt_template.trim(),
			})
			.eq("id", profile.id);

		if (error) {
			setProfileSaveState("error");
			setProfileSaveMessage(error.message);
			return;
		}

		setProfile((prev) =>
			prev
				? {
						...prev,
						clone_name: profileForm.clone_name.trim(),
						x_handle: profileForm.x_handle.trim() || null,
						persona_text: profileForm.persona_text.trim(),
						prompt_template: profileForm.prompt_template.trim(),
					}
				: prev,
		);
		setProfileSaveState("saved");
		setProfileSaveMessage("Profile saved.");
	}

	const profileCompletion = useMemo(() => {
		const checks = [
			Boolean(profile?.clone_name?.trim()),
			Boolean(profile?.x_handle?.trim()),
			Boolean(profile?.persona_text?.trim()),
			Boolean(profile?.prompt_template?.trim()),
		];
		const done = checks.filter(Boolean).length;
		return Math.round((done / checks.length) * 100);
	}, [profile]);

	const canSaveProfile =
		Boolean(profile?.id) &&
		Boolean(profileForm.clone_name.trim()) &&
		Boolean(profileForm.persona_text.trim()) &&
		Boolean(profileForm.prompt_template.trim());

	function renderSectionContent() {
		if (loadingData) {
			return (
				<Card className="border-border/70 bg-background/80">
					<CardContent className="py-12 text-center text-sm text-muted-foreground">
						Loading creator workspace...
					</CardContent>
				</Card>
			);
		}

		if (dataError) {
			return (
				<Card className="border-destructive/40 bg-destructive/5">
					<CardHeader>
						<CardTitle>Could not load studio data</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3 text-sm text-muted-foreground">
						<p>{dataError}</p>
						<Button
							type="button"
							variant="outline"
							onClick={() => window.location.reload()}
						>
							Reload
						</Button>
					</CardContent>
				</Card>
			);
		}

		if (!profile) {
			return (
				<Card className="border-border/70 bg-background/80">
					<CardHeader>
						<CardTitle>Complete onboarding to unlock studio features</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3 text-sm text-muted-foreground">
						<p>
							Your wallet is connected, but no creator profile is linked yet.
							Start onboarding to create and activate your studio identity.
						</p>
						<div className="flex flex-wrap gap-2">
							<Button asChild>
								<Link to="/onboarding">Start Onboarding</Link>
							</Button>
							<Button asChild variant="outline">
								<Link to="/feed">Explore Feed</Link>
							</Button>
						</div>
					</CardContent>
				</Card>
			);
		}

		switch (activeSection) {
			case "overview":
				return (
					<div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
						<Card className="border-border/70 bg-background/80">
							<CardHeader>
								<CardTitle>Studio Snapshot</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3 text-sm text-muted-foreground">
								<p>
									Profile completion:{" "}
									<span className="font-semibold text-foreground">
										{profileCompletion}%
									</span>
								</p>
								<p>
									Posts in last 7 days:{" "}
									<span className="font-semibold text-foreground">
										{recentPostsLast7Days}
									</span>
								</p>
								<p>
									Average likes per post:{" "}
									<span className="font-semibold text-foreground">
										{averageLikes.toFixed(1)}
									</span>
								</p>
								{openEpoch ? (
									<p>
										Open epoch #{openEpoch.id} ({openEpoch.status}) ends{" "}
										{formatDate(openEpoch.end_at)}.
									</p>
								) : (
									<p>No open epoch right now.</p>
								)}
							</CardContent>
						</Card>
						<Card className="border-border/70 bg-background/80">
							<CardHeader>
								<CardTitle>Quick Actions</CardTitle>
							</CardHeader>
							<CardContent className="space-y-2">
								<Button
									asChild
									variant="outline"
									className="w-full justify-start"
								>
									<Link to="/feed">Open Feed</Link>
								</Button>
								<Button
									asChild
									variant="outline"
									className="w-full justify-start"
								>
									<Link to="/studio/content">Review Content</Link>
								</Button>
								<Button
									asChild
									variant="outline"
									className="w-full justify-start"
								>
									<Link to="/studio/rewards">Open Reward History</Link>
								</Button>
							</CardContent>
						</Card>
					</div>
				);

			case "profile":
				return (
					<Card className="border-border/70 bg-background/80">
						<CardHeader>
							<CardTitle>Profile and Persona</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid gap-3 sm:grid-cols-2">
								<div>
									<p className="mb-1 text-sm font-medium">Clone name</p>
									<Input
										value={profileForm.clone_name}
										onChange={(event) =>
											setProfileForm((prev) => ({
												...prev,
												clone_name: event.target.value,
											}))
										}
									/>
								</div>
								<div>
									<p className="mb-1 text-sm font-medium">X handle</p>
									<Input
										value={profileForm.x_handle}
										onChange={(event) =>
											setProfileForm((prev) => ({
												...prev,
												x_handle: event.target.value,
											}))
										}
									/>
								</div>
							</div>
							<div>
								<p className="mb-1 text-sm font-medium">Persona text</p>
								<Textarea
									rows={5}
									value={profileForm.persona_text}
									onChange={(event) =>
										setProfileForm((prev) => ({
											...prev,
											persona_text: event.target.value,
										}))
									}
								/>
							</div>
							<div>
								<p className="mb-1 text-sm font-medium">Prompt template</p>
								<Textarea
									rows={5}
									value={profileForm.prompt_template}
									onChange={(event) =>
										setProfileForm((prev) => ({
											...prev,
											prompt_template: event.target.value,
										}))
									}
								/>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<Button
									type="button"
									onClick={() => {
										void handleSaveProfile();
									}}
									disabled={!canSaveProfile || profileSaveState === "saving"}
								>
									{profileSaveState === "saving" ? "Saving..." : "Save Profile"}
								</Button>
								{profileSaveMessage ? (
									<p
										className={`text-sm ${
											profileSaveState === "error"
												? "text-destructive"
												: "text-muted-foreground"
										}`}
									>
										{profileSaveMessage}
									</p>
								) : null}
							</div>
						</CardContent>
					</Card>
				);

			case "content":
				return (
					<Card className="border-border/70 bg-background/80">
						<CardHeader>
							<CardTitle>Recent Content</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							{recentPosts.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									No content yet. Open feed to publish your first post.
								</p>
							) : (
								recentPosts.slice(0, 8).map((post) => (
									<div
										key={post.id}
										className="rounded-xl border border-border/70 bg-background/70 p-3"
									>
										<p className="line-clamp-2 text-sm text-foreground">
											{post.content_text}
										</p>
										<p className="mt-1 text-xs text-muted-foreground">
											{post.like_count} likes · epoch {post.epoch_id} ·{" "}
											{formatDate(post.created_at)}
										</p>
									</div>
								))
							)}
							<div className="flex flex-wrap gap-2">
								<Button asChild variant="outline" size="sm">
									<Link to="/feed">Open Feed</Link>
								</Button>
							</div>
						</CardContent>
					</Card>
				);

			case "analytics":
				return (
					<div className="grid gap-4 lg:grid-cols-3">
						<Card className="border-border/70 bg-background/80">
							<CardHeader>
								<CardTitle className="text-sm">Total likes</CardTitle>
							</CardHeader>
							<CardContent className="text-2xl font-semibold">
								{totalLikes}
							</CardContent>
						</Card>
						<Card className="border-border/70 bg-background/80">
							<CardHeader>
								<CardTitle className="text-sm">Average likes/post</CardTitle>
							</CardHeader>
							<CardContent className="text-2xl font-semibold">
								{averageLikes.toFixed(1)}
							</CardContent>
						</Card>
						<Card className="border-border/70 bg-background/80">
							<CardHeader>
								<CardTitle className="text-sm">Best post</CardTitle>
							</CardHeader>
							<CardContent className="text-sm text-muted-foreground">
								{bestPost
									? `${bestPost.like_count} likes · ${formatDate(bestPost.created_at)}`
									: "No data yet"}
							</CardContent>
						</Card>
					</div>
				);

			case "leaderboard":
				return (
					<Card className="border-border/70 bg-background/80">
						<CardHeader>
							<CardTitle>Open Epoch Leaderboard</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							{topOpenRows.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									No open leaderboard rows yet.
								</p>
							) : (
								topOpenRows.map((row) => (
									<div
										key={row.id}
										className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2.5"
									>
										<p className="text-sm font-medium">
											#{row.rank}{" "}
											{row.creator?.clone_name ??
												shortAddress(row.creator?.wallet_address)}
										</p>
										<p className="text-xs text-muted-foreground">
											{row.like_count} likes
										</p>
									</div>
								))
							)}
							<Button asChild variant="outline" size="sm">
								<Link to="/leaderboard">Open full leaderboard</Link>
							</Button>
						</CardContent>
					</Card>
				);

			case "rewards":
				return (
					<Card className="border-border/70 bg-background/80">
						<CardHeader>
							<CardTitle>Reward History</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							{rewardHistory.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									No reward rows yet.
								</p>
							) : (
								rewardHistory.slice(0, 10).map((row) => (
									<div
										key={row.id}
										className="rounded-xl border border-border/70 bg-background/70 p-3"
									>
										<p className="text-sm font-medium">
											Epoch {row.epoch_id} · rank #{row.rank}
										</p>
										<p className="text-xs text-muted-foreground">
											{row.like_count} likes · {formatReward(row.reward_amount)}{" "}
											tBNB
										</p>
									</div>
								))
							)}
							<Button asChild variant="outline" size="sm">
								<Link to="/rewards">Open rewards board</Link>
							</Button>
						</CardContent>
					</Card>
				);

			case "wallet":
				return (
					<Card className="border-border/70 bg-background/80">
						<CardHeader>
							<CardTitle>Wallet and Payout</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3 text-sm text-muted-foreground">
							<p>
								Connected wallet:{" "}
								<span className="font-medium text-foreground">{address}</span>
							</p>
							<p>
								Payout wallet:{" "}
								<span className="font-medium text-foreground">
									{profile.wallet_address}
								</span>
							</p>
							<p>
								For security, payout destination follows your verified creator
								wallet.
							</p>
						</CardContent>
					</Card>
				);

			case "security":
				return (
					<Card className="border-border/70 bg-background/80">
						<CardHeader>
							<CardTitle>Security Checklist</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2 text-sm text-muted-foreground">
							<p>Use wallet signatures only on trusted RailMint screens.</p>
							<p>Confirm domain and network before approving transactions.</p>
							<p>Disconnect browser wallet extensions you do not use.</p>
							<p>Use a hardware wallet for larger balances.</p>
						</CardContent>
					</Card>
				);

			case "settings":
				return (
					<Card className="border-border/70 bg-background/80">
						<CardHeader>
							<CardTitle>Workspace Settings</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4 text-sm text-muted-foreground">
							<label className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2">
								<span>Compact studio density</span>
								<input
									type="checkbox"
									checked={studioDensityCompact}
									onChange={(event) =>
										setStudioDensityCompact(event.target.checked)
									}
								/>
							</label>
							<label className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2">
								<span>Auto-collapse desktop sidebar</span>
								<input
									type="checkbox"
									checked={autoCollapseSidebar}
									onChange={(event) => {
										setAutoCollapseSidebar(event.target.checked);
										if (event.target.checked) setSidebarCollapsed(true);
									}}
								/>
							</label>
						</CardContent>
					</Card>
				);

			default:
				return null;
		}
	}

	if (showConnectTransition) {
		return (
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.35, ease: "easeOut" }}
				className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_12%_10%,hsl(var(--primary)/0.18),transparent_36%),radial-gradient(circle_at_88%_0%,hsl(var(--accent)/0.16),transparent_32%)] bg-background px-4 sm:px-6"
			>
				<motion.div
					initial={{ opacity: 0, y: 14, scale: 0.985 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					transition={{ duration: 0.45, ease: "easeOut" }}
					className="w-full max-w-xl rounded-3xl border border-primary/35 bg-background/90 p-8 text-center shadow-[0_24px_90px_-38px_rgba(245,158,11,0.55)]"
				>
					<p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
						<Sparkles className="h-3.5 w-3.5" /> Login confirmed
					</p>
					<h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
						Opening your Studio workspace...
					</h2>
					<p className="mt-2 text-sm text-muted-foreground">
						Preparing your creator dashboard.
					</p>
				</motion.div>
			</motion.div>
		);
	}

	if (showDisconnectTransition) {
		return (
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.35, ease: "easeOut" }}
				className="grid min-h-screen place-items-center bg-gradient-to-br from-background via-background to-amber-50/30 px-4 sm:px-6"
			>
				<motion.div
					initial={{ opacity: 0, y: 14, scale: 0.985 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					transition={{ duration: 0.45, ease: "easeOut" }}
					className="w-full max-w-xl rounded-3xl border border-border/70 bg-background/90 p-8 text-center shadow-[0_24px_90px_-38px_rgba(245,158,11,0.55)]"
				>
					<p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
						<WalletCards className="h-3.5 w-3.5" /> Wallet disconnected
					</p>
					<h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
						Returning to Studio login...
					</h2>
					<p className="mt-2 text-sm text-muted-foreground">
						Please reconnect your wallet to continue.
					</p>
				</motion.div>
			</motion.div>
		);
	}

	if (!isConnected) {
		return (
			<motion.div
				initial={{ opacity: 0, y: 14 }}
				animate={{
					opacity: isLeavingToFeed ? 0 : 1,
					y: isLeavingToFeed ? 16 : 0,
				}}
				transition={{ duration: 0.28, ease: "easeOut" }}
				className="grid min-h-screen place-items-center bg-gradient-to-br from-background via-background to-amber-50/30 px-4 sm:px-6"
			>
				<div className="w-full max-w-5xl rounded-3xl border border-border/70 bg-background/90 p-6 shadow-[0_24px_90px_-38px_rgba(245,158,11,0.55)] sm:p-8">
					<div className="mb-8 flex flex-col gap-4 border-b border-border/60 pb-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
						<div className="flex items-center gap-3">
							<BrandMark compact markOnly className="shrink-0" />
							<div className="space-y-1">
								<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
									<span>RailMint</span>
									<span className="rounded-full border border-amber-400/45 bg-amber-300/15 px-2 py-0.5 text-[10px] font-semibold tracking-[0.15em] text-amber-600 dark:text-amber-400">
										AI
									</span>
								</div>
								<p className="bg-gradient-to-r from-foreground via-foreground to-amber-500 bg-clip-text text-2xl font-semibold tracking-tight text-transparent sm:text-[2rem]">
									Creator Studio
								</p>
							</div>
						</div>
						<button
							type="button"
							onClick={handleBackToFeed}
							className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3.5 py-1.5 text-sm font-medium text-muted-foreground shadow-[0_10px_24px_-20px_rgba(245,158,11,0.9)] backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:text-foreground"
						>
							<ArrowLeft className="h-4 w-4" /> Back to Home
						</button>
					</div>

					<div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
						<div className="space-y-4">
							<p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
								<UserCog className="h-3.5 w-3.5" /> Sign in to your studio
							</p>
							<h1 className="max-w-[24ch] text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-[2.2rem]">
								<span className="bg-gradient-to-r from-foreground via-foreground to-amber-500 bg-clip-text text-transparent">
									Welcome back to your
								</span>{" "}
								Creator Workspace.
							</h1>
							<p className="max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
								Pick a wallet below to continue where you left off.
							</p>
						</div>

						<Card className="border-border/70 bg-background/85">
							<CardHeader className="pb-3">
								<CardTitle className="flex items-center gap-2 text-base">
									<WalletCards className="h-4 w-4" /> Connect your wallet
								</CardTitle>
								<p className="text-sm text-muted-foreground">
									Choose a wallet to sign in.
								</p>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="grid gap-3 md:grid-cols-2">
									{topConnectorOptions.map((connector) => (
										<Button
											key={connector.id}
											type="button"
											variant="outline"
											className="h-14 justify-start rounded-2xl border-border/70 bg-background/70 px-4 text-base transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/45 hover:bg-background"
											disabled={status === "pending"}
											onClick={() => {
												void handleConnectorConnect(connector);
											}}
										>
											<img
												src={resolveWalletLogo(connector.name)}
												alt={`${connector.name} logo`}
												className="mr-3 h-7 w-7 rounded-sm object-contain"
												loading="lazy"
											/>
											<span className="truncate">{connector.name}</span>
											{status === "pending" &&
											variables?.connector === connector ? (
												<span className="ml-auto text-xs text-muted-foreground">
													Connecting...
												</span>
											) : null}
										</Button>
									))}
								</div>

								{connectError ? (
									<p className="text-sm text-destructive">{connectError}</p>
								) : null}

								<Button
									type="button"
									variant="outline"
									className="h-14 justify-start rounded-2xl border-border/70 bg-background/70 px-4 text-base transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/45 hover:bg-background"
									disabled={status === "pending" || !openConnectModal}
									onClick={() => openConnectModal?.()}
								>
									<WalletCards className="mr-3 h-7 w-7" />
									<span className="truncate">More wallets</span>
								</Button>
							</CardContent>
						</Card>
					</div>
				</div>
			</motion.div>
		);
	}

	return (
		<motion.div
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.35, ease: "easeOut" }}
			className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_12%_10%,hsl(var(--primary)/0.18),transparent_36%),radial-gradient(circle_at_88%_0%,hsl(var(--accent)/0.16),transparent_32%)] bg-background"
		>
			<div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--primary)/0.045)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--primary)/0.045)_1px,transparent_1px)] bg-[size:42px_42px] opacity-40" />
			<motion.div
				className="pointer-events-none absolute -left-28 top-20 h-72 w-72 rounded-full bg-primary/15 blur-3xl"
				animate={{ x: [0, 18, 0], y: [0, -12, 0] }}
				transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
			/>
			<motion.div
				className="pointer-events-none absolute -right-20 bottom-10 h-64 w-64 rounded-full bg-amber-400/20 blur-3xl"
				animate={{ x: [0, -14, 0], y: [0, 10, 0] }}
				transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
			/>
			<div className="relative flex min-h-screen">
				{desktopSidebarHidden ? (
					<button
						type="button"
						onClick={() => setDesktopSidebarHidden(false)}
						className="absolute left-2 top-20 z-40 hidden items-center gap-1 rounded-full border border-border/70 bg-background/95 px-3 py-2 text-xs font-semibold text-muted-foreground shadow-[0_12px_28px_-18px_rgba(245,158,11,0.55)] transition-colors duration-200 hover:border-primary/60 hover:text-foreground md:inline-flex"
						title="Show sidebar"
					>
						<ChevronRight className="h-4 w-4" />
						Show
					</button>
				) : null}
				<aside
					className={`hidden shrink-0 overflow-hidden border-r border-border/70 bg-gradient-to-b from-background/90 to-background/75 backdrop-blur-xl transition-[width,opacity] duration-500 ease-out md:flex md:flex-col ${
						desktopSidebarHidden
							? "w-0 opacity-0"
							: sidebarCollapsed
								? "w-[84px] opacity-100"
								: "w-[268px] opacity-100"
					}`}
				>
					<div
						className={`relative flex h-16 items-center border-b border-border/60 ${
							sidebarCollapsed
								? "h-24 flex-col justify-center gap-1.5 px-2 py-2"
								: "justify-between px-3 pr-10"
						}`}
					>
						{sidebarCollapsed ? <BrandMark compact markOnly /> : <BrandMark />}
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setSidebarCollapsed((value) => !value)}
							title={sidebarCollapsed ? "Expand panel" : "Collapse panel"}
							className={`h-7 w-7 rounded-full text-muted-foreground transition-colors duration-200 hover:text-foreground ${
								sidebarCollapsed
									? ""
									: "absolute right-2 top-1/2 -translate-y-1/2"
							}`}
						>
							{sidebarCollapsed ? (
								<ChevronRight className="h-3.5 w-3.5" />
							) : (
								<ChevronLeft className="h-3.5 w-3.5" />
							)}
						</Button>
					</div>
					<nav className="space-y-1.5 px-3 pb-4 pt-3">
						{navItems.map((item) => {
							const Icon = item.icon;
							const isActive = activeSection === item.key;
							return (
								<Link
									key={item.key}
									to={navHref(item.key)}
									className={`group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm transition-colors duration-200 ${
										isActive
											? "border border-primary/25 bg-primary/10 text-foreground shadow-[0_14px_32px_-26px_rgba(245,158,11,0.55)]"
											: "border border-transparent text-muted-foreground hover:border-border/60 hover:bg-secondary/50 hover:text-foreground"
									}`}
									title={sidebarCollapsed ? item.label : undefined}
								>
									{isActive ? (
										<motion.span
											layoutId="studio-sidebar-active"
											className="absolute inset-0 rounded-xl bg-primary/12"
											transition={{
												type: "spring",
												stiffness: 380,
												damping: 34,
											}}
										/>
									) : null}
									<Icon className="relative z-10 h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-105" />
									{!sidebarCollapsed && (
										<div className="relative z-10 min-w-0">
											<p className="truncate font-medium leading-tight">
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
				</aside>

				{mobileSidebarOpen && (
					<div className="fixed inset-0 z-40 md:hidden">
						<div
							className="absolute inset-0 bg-black/40"
							onClick={() => setMobileSidebarOpen(false)}
						/>
						<aside className="absolute left-0 top-0 h-full w-72 border-r border-border/70 bg-background p-3">
							<div className="mb-2 flex h-12 items-center justify-between">
								<BrandMark />
								<Button
									variant="ghost"
									size="icon"
									onClick={() => setMobileSidebarOpen(false)}
								>
									<X className="h-4 w-4" />
								</Button>
							</div>
							<nav className="space-y-1">
								{navItems.map((item) => {
									const Icon = item.icon;
									const isActive = activeSection === item.key;
									return (
										<Link
											key={item.key}
											to={navHref(item.key)}
											onClick={() => setMobileSidebarOpen(false)}
											className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
												isActive
													? "bg-primary/12 text-foreground"
													: "text-muted-foreground"
											}`}
										>
											<Icon className="h-4 w-4" />
											<div>
												<p className="font-medium">{item.label}</p>
												<p className="text-xs text-muted-foreground">
													{item.description}
												</p>
											</div>
										</Link>
									);
								})}
							</nav>
						</aside>
					</div>
				)}

				<main className="flex-1">
					<header className="sticky top-0 z-30 px-3 pt-3 sm:px-6">
						<div className="flex h-16 items-center justify-between rounded-2xl border border-primary/20 bg-gradient-to-r from-background/88 via-background/84 to-primary/5 px-3 shadow-[0_18px_48px_-28px_rgba(245,158,11,0.52)] backdrop-blur-xl sm:px-4">
							<div className="flex items-center gap-3">
								<Button
									variant="outline"
									size="icon"
									className="md:hidden"
									onClick={() => setMobileSidebarOpen(true)}
								>
									<Menu className="h-4 w-4" />
								</Button>
								{desktopSidebarHidden ? (
									<Button
										variant="outline"
										size="icon"
										className="hidden md:inline-flex"
										onClick={() => setDesktopSidebarHidden(false)}
										title="Show panel"
									>
										<Menu className="h-4 w-4" />
									</Button>
								) : null}
								<div className="hidden sm:block">
									<BrandMark compact />
								</div>
								<div>
									<p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
										RailMint Creator OS
									</p>
									<h1 className="text-lg font-semibold">
										{sectionTitle(activeSection)}
									</h1>
								</div>
							</div>
							<ConnectWalletButton compact />
						</div>
					</header>

					<div
						className={
							studioDensityCompact
								? "space-y-4 p-4 sm:p-5"
								: "space-y-6 p-5 sm:p-7"
						}
					>
						<section className="rounded-3xl border border-primary/25 bg-gradient-to-br from-background/94 via-background/90 to-primary/[0.07] p-5 shadow-[0_24px_60px_-34px_rgba(245,158,11,0.65)] sm:p-6">
							<div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
								<Sparkles className="h-3.5 w-3.5" /> Creator Command Center
							</div>
							<h2 className="bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-2xl font-semibold tracking-tight text-transparent sm:text-3xl">
								{profile
									? `${profile.clone_name} Studio`
									: "Set up your creator identity"}
							</h2>
							<p className="mt-2 text-sm text-muted-foreground">
								{profile
									? `Connected as ${profile.x_handle || "creator"}. Manage content, rewards, and strategy in one workspace.`
									: "Complete onboarding to unlock profile, content, and reward controls."}
							</p>
							<div className="mt-3 flex flex-wrap items-center gap-2">
								{loadingData ? (
									<Badge variant="outline">Syncing data...</Badge>
								) : null}
								{openEpoch ? (
									<Badge variant="outline">Epoch {openEpoch.id} is open</Badge>
								) : (
									<Badge variant="outline">No open epoch</Badge>
								)}
								{openEpochReward ? (
									<Badge variant="outline">
										Live rank #{openEpochReward.rank} ·{" "}
										{openEpochReward.like_count} likes
									</Badge>
								) : null}
							</div>
						</section>

						<section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
							<Card className="border-border/70 bg-gradient-to-b from-background/90 to-background/70 shadow-[0_16px_40px_-30px_rgba(245,158,11,0.65)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_22px_52px_-30px_rgba(245,158,11,0.72)]">
								<CardHeader className="pb-2">
									<CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-[0.02em] text-muted-foreground">
										<WalletCards className="h-4 w-4 text-primary" /> Wallet
									</CardTitle>
								</CardHeader>
								<CardContent className="text-sm text-muted-foreground">
									{shortAddress(address)}
								</CardContent>
							</Card>
							<Card className="border-border/70 bg-gradient-to-b from-background/90 to-background/70 shadow-[0_16px_40px_-30px_rgba(245,158,11,0.65)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_22px_52px_-30px_rgba(245,158,11,0.72)]">
								<CardHeader className="pb-2">
									<CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-[0.02em] text-muted-foreground">
										<FileText className="h-4 w-4 text-primary" /> Posts
									</CardTitle>
								</CardHeader>
								<CardContent className="text-2xl font-semibold">
									{stats.postsCount}
								</CardContent>
							</Card>
							<Card className="border-border/70 bg-gradient-to-b from-background/90 to-background/70 shadow-[0_16px_40px_-30px_rgba(245,158,11,0.65)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_22px_52px_-30px_rgba(245,158,11,0.72)]">
								<CardHeader className="pb-2">
									<CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-[0.02em] text-muted-foreground">
										<BarChart3 className="h-4 w-4 text-primary" /> Total Likes
									</CardTitle>
								</CardHeader>
								<CardContent className="text-2xl font-semibold">
									{totalLikes}
								</CardContent>
							</Card>
							<Card className="border-border/70 bg-gradient-to-b from-background/90 to-background/70 shadow-[0_16px_40px_-30px_rgba(245,158,11,0.65)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_22px_52px_-30px_rgba(245,158,11,0.72)]">
								<CardHeader className="pb-2">
									<CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-[0.02em] text-muted-foreground">
										<Gift className="h-4 w-4 text-primary" /> Rewards Rows
									</CardTitle>
								</CardHeader>
								<CardContent className="text-lg font-medium">
									{stats.rewardRows}
								</CardContent>
							</Card>
						</section>

						{renderSectionContent()}
					</div>
				</main>
			</div>
		</motion.div>
	);
}
