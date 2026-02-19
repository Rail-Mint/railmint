import { useConnectModal } from "@rainbow-me/rainbowkit";
import { formatDistanceToNow } from "date-fns";
import {
	ArrowLeft,
	Calendar,
	CheckCircle2,
	Copy,
	ExternalLink,
	Eye,
	EyeOff,
	FileText,
	Globe,
	Hash,
	Heart,
	Link2,
	LoaderCircle,
	MessageSquare,
	Shield,
	Sparkles,
	User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAccount } from "wagmi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { PageLoader } from "@/components/ui/page-loader";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { XIcon } from "@/components/ui/x-icon";
import { useToast } from "@/hooks/use-toast";
import { useSignedAction } from "@/hooks/useSignedAction";
import { supabase } from "@/integrations/supabase/client";
import { getExplorerTxUrl } from "@/lib/explorer";
import {
	computeContentHash,
	computeMetaHash,
	computePromptHash,
} from "@/lib/proof-hashes";

interface Creator {
	id: string;
	clone_name: string;
	x_handle: string | null;
	wallet_address: string;
}

interface PostDetailData {
	id: string;
	prompt_text: string;
	content_text: string;
	content_html: string | null;
	prompt_hash: string;
	content_hash: string;
	meta_hash: string;
	commit_tx_hash: string | null;
	created_at: string;
	creator: Creator | null;
	creator_id: string;
}

interface VerificationState {
	promptMatch: boolean | null;
	contentMatch: boolean | null;
}

interface HashRowProps {
	label: string;
	hash: string;
	match: boolean | null;
}

interface ReplayStep {
	id: string;
	title: string;
	detail: string;
	value: string;
}

function shortAddress(address?: string | null) {
	if (!address) return "-";
	return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function HashRow({
	label,
	hash,
	match,
	onCopy,
}: HashRowProps & { onCopy: (value: string) => void }) {
	return (
		<div className="rounded-xl border border-border/70 bg-background/70 p-3">
			<div className="mb-1 flex items-center gap-2">
				<p className="text-sm font-medium">{label}</p>
				{match !== null ? (
					match ? (
						<CheckCircle2 className="h-4 w-4 text-primary" />
					) : (
						<span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-destructive">
							Mismatch
						</span>
					)
				) : null}
			</div>

			<div className="flex items-center gap-2">
				<code className="min-w-0 flex-1 truncate rounded-lg bg-secondary/70 px-2 py-1.5 text-xs">
					{hash}
				</code>
				<Button
					variant="ghost"
					size="icon"
					className="h-7 w-7"
					onClick={() => onCopy(hash)}
				>
					<Copy className="h-3 w-3" />
				</Button>
			</div>
		</div>
	);
}

export default function PostDetail() {
	const PROOF_BEHAVIOR_KEY = "railmindai.proof-behavior-count";
	const ONBOARDING_TIP_KEY = "railmindai.post-onboarding-dismissed";

	const { id } = useParams<{ id: string }>();
	const { address } = useAccount();
	const { openConnectModal } = useConnectModal();
	const { toast } = useToast();
	const { invokeWithSignature } = useSignedAction();
	const [post, setPost] = useState<PostDetailData | null>(null);
	const [creator, setCreator] = useState<Creator | null>(null);
	const [likeCount, setLikeCount] = useState(0);
	const [liked, setLiked] = useState(false);
	const [loading, setLoading] = useState(true);
	const [verification, setVerification] = useState<VerificationState>({
		promptMatch: null,
		contentMatch: null,
	});
	const [replayStep, setReplayStep] = useState(0);
	const [replayRunning, setReplayRunning] = useState(false);
	const [activeTab, setActiveTab] = useState<"overview" | "proof" | "replay">(
		"overview",
	);
	const [readerMode, setReaderMode] = useState(true);
	const [proofBehaviorCount, setProofBehaviorCount] = useState(0);
	const [showOnboardingTip, setShowOnboardingTip] = useState(false);
	const [showAuthDialog, setShowAuthDialog] = useState(false);

	const tabSessionKey = id ? `railmindai.post-tab.${id}` : null;

	useEffect(() => {
		const stored = Number(window.localStorage.getItem(PROOF_BEHAVIOR_KEY));
		if (Number.isFinite(stored) && stored > 0) {
			setProofBehaviorCount(stored);
		}

		const dismissedTip = window.localStorage.getItem(ONBOARDING_TIP_KEY);
		if (!dismissedTip) {
			setShowOnboardingTip(true);
		}
	}, []);

	useEffect(() => {
		if (!tabSessionKey) return;

		const storedTab = window.sessionStorage.getItem(tabSessionKey);
		if (
			storedTab === "overview" ||
			storedTab === "proof" ||
			storedTab === "replay"
		) {
			setActiveTab(storedTab);
		}
	}, [tabSessionKey]);

	useEffect(() => {
		if (id) {
			void loadPost();
		}
	}, [id, address]);

	async function loadPost() {
		setLoading(true);

		const { data: postData } = await supabase
			.from("posts")
			.select("*")
			.eq("id", id)
			.single();
		if (!postData) {
			setLoading(false);
			return;
		}

		const normalizedPost = postData as unknown as PostDetailData;

		setPost(normalizedPost);

		const creatorId = (postData as any).creator_id;
		if (creatorId) {
			const { data: creatorData } = await supabase
				.from("creators")
				.select("*")
				.eq("id", creatorId)
				.single();
			setCreator(creatorData as unknown as Creator);

			// Verify hashes immediately using creatorData (not state - it's async)
			const cr = creatorData as any;
			if (cr && normalizedPost.prompt_text) {
				// Use wallet as-is from DB (case-sensitive for hash matching)
				const normalizedWallet = cr.wallet_address || "";

				const recomputedPrompt = computePromptHash(
					normalizedPost.id,
					cr.id,
					normalizedPost.prompt_text,
				);
				// Use EXACT timestamp from database - no transformation
				// This ensures hash computation matches backend exactly
				const timestampForHash = normalizedPost.created_at || "";

				const recomputedContent = computeContentHash(
					normalizedPost.id,
					normalizedPost.content_text,
				);

				setVerification({
					promptMatch: recomputedPrompt === normalizedPost.prompt_hash,
					contentMatch: recomputedContent === normalizedPost.content_hash,
				});
			}
		}

		const { count } = await supabase
			.from("likes")
			.select("*", { count: "exact", head: true })
			.eq("post_id", id);
		setLikeCount(count || 0);

		if (address) {
			const { data: likeData } = await supabase
				.from("likes")
				.select("id")
				.eq("post_id", id)
				.eq("wallet_address", address.toLowerCase())
				.maybeSingle();
			setLiked(!!likeData);
		}

		setLoading(false);
	}

	async function toggleLike() {
		if (!address) {
			setShowAuthDialog(true);
			return;
		}

		try {
			if (liked) {
				await invokeWithSignature(
					"toggle-like",
					{ post_id: id, action: "unlike" },
					address,
				);
				setLiked(false);
				setLikeCount((count) => Math.max(0, count - 1));
			} else {
				await invokeWithSignature(
					"toggle-like",
					{ post_id: id, action: "like" },
					address,
				);
				setLiked(true);
				setLikeCount((count) => count + 1);
			}
		} catch (err) {
			toast({
				title: "Like failed",
				description: err instanceof Error ? err.message : "Failed",
				variant: "destructive",
			});
		}
	}

	function copyHash(hash: string) {
		navigator.clipboard.writeText(hash);
		toast({ title: "Copied", description: "Hash copied to clipboard." });
	}

	function shareToX() {
		const text = `Check out this AI-generated BNB content on RailMintAI!`;
		const url = window.location.href;
		window.open(
			`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
			"_blank",
		);
	}

	if (loading)
		return (
			<PageLoader
				message="Verifying post proofs and metadata..."
				className="py-12"
			/>
		);

	const createdAtLabel = formatDistanceToNow(new Date(post.created_at), {
		addSuffix: true,
	});

	const verificationScore = [
		verification.promptMatch,
		verification.contentMatch,
	].filter(Boolean).length;

	const replaySteps: ReplayStep[] = [];

	if (post && creator) {
		const promptValue = computePromptHash(
			post.id,
			creator.id,
			post.prompt_text,
		);
		const contentValue = computeContentHash(post.id, post.content_text);
		const metaValue = computeMetaHash(
			"google/gemini-2.5-flash",
			post.created_at,
			creator.wallet_address,
		);

		replaySteps.push(
			{
				id: "seed",
				title: "Seed Input Context",
				detail:
					"Initialize replay with post id, creator id, timestamp, and content payload.",
				value: `${post.id.slice(0, 10)}...`,
			},
			{
				id: "prompt",
				title: "Recompute Prompt Hash",
				detail:
					"Hash post id + creator id + prompt text and compare to stored prompt hash.",
				value: `${promptValue.slice(0, 16)}...`,
			},
			{
				id: "content",
				title: "Recompute Content Hash",
				detail:
					"Hash post id + content text and compare to stored content hash.",
				value: `${contentValue.slice(0, 16)}...`,
			},
			{
				id: "meta",
				title: "Recompute Meta Hash",
				detail:
					"Hash model id + post timestamp + wallet address and compare to stored meta hash.",
				value: `${metaValue.slice(0, 16)}...`,
			},
		);
	}

	async function runReplay() {
		if (!replaySteps.length || replayRunning) return;

		setReaderMode(false);
		setTab("replay", { bump: true });
		setReplayRunning(true);
		setReplayStep(0);

		for (let step = 1; step <= replaySteps.length; step += 1) {
			// eslint-disable-next-line no-await-in-loop
			await new Promise((resolve) => setTimeout(resolve, 430));
			setReplayStep(step);
		}

		setReplayRunning(false);
	}

	function bumpProofBehavior() {
		setProofBehaviorCount((current) => {
			const next = current + 1;
			window.localStorage.setItem(PROOF_BEHAVIOR_KEY, String(next));
			return next;
		});
	}

	function persistTab(tab: "overview" | "proof" | "replay") {
		if (!tabSessionKey) return;
		window.sessionStorage.setItem(tabSessionKey, tab);
	}

	function setTab(
		tab: "overview" | "proof" | "replay",
		options?: { bump?: boolean },
	) {
		setActiveTab(tab);
		persistTab(tab);
		if (options?.bump) {
			bumpProofBehavior();
		}
	}

	function openProofDetails() {
		setReaderMode(false);
		setTab("proof", { bump: true });
	}

	function openOverviewFromReader() {
		setReaderMode(false);
		setTab("overview");
	}

	function handleTabChange(value: string) {
		const tab = value as "overview" | "proof" | "replay";
		setReaderMode(false);
		setTab(tab, { bump: tab !== "overview" });
	}

	function dismissOnboardingTip() {
		window.localStorage.setItem(ONBOARDING_TIP_KEY, "1");
		setShowOnboardingTip(false);
	}

	const hasMismatch = [
		verification.promptMatch,
		verification.contentMatch,
	].includes(false);

	const checks = [
		{ label: "Prompt", value: verification.promptMatch },
		{ label: "Content", value: verification.contentMatch },
	];

	const preferVerification = proofBehaviorCount >= 3;
	const confidencePercent = Math.round(
		(verificationScore / checks.length) * 100,
	);
	const primaryProofCtaLabel = preferVerification
		? "Inspect Proof Details"
		: "Open Proof Details";
	const primaryProofCtaHint = preferVerification
		? "Behavior signal: you inspect proof often, so verification actions are prioritized."
		: "Behavior signal: you usually engage first, so proof tools stay one tap away.";
	const snapshotFrameClass = hasMismatch
		? "border-destructive/45 bg-destructive/5"
		: verificationScore === checks.length
			? "border-primary/45 bg-primary/10"
			: "border-amber-400/40 bg-amber-500/5";

	const snapshotTitleClass = hasMismatch
		? "text-destructive"
		: verificationScore === checks.length
			? "text-primary"
			: "text-amber-500";

	const ctaClass = hasMismatch
		? "border-destructive/45 text-destructive hover:bg-destructive/10"
		: verificationScore === checks.length
			? "border-primary/40 text-primary hover:bg-primary/10"
			: "border-amber-400/45 text-amber-500 hover:bg-amber-500/10";

	const mismatchHints: Record<"Prompt" | "Content", string[]> = {
		Prompt: [
			"Prompt text was edited after generation.",
			"Creator id or post id no longer matches original hash input.",
			"Client or backend used a different hash serialization order.",
		],
		Content: [
			"Post body changed after hash creation.",
			"Whitespace/newline normalization differs between systems.",
			"Content hash was generated with a different post id context.",
		],
	};

	const proofTimelineSteps = [
		{ label: "Generated", done: true },
		{ label: "Hashed", done: verificationScore > 0 },
		{ label: "Committed", done: Boolean(post.commit_tx_hash) },
	];

	const inlineChipClass = (value: boolean | null) => {
		if (value === true) return "border-primary/35 bg-primary/10 text-primary";
		if (value === false)
			return "border-destructive/40 bg-destructive/10 text-destructive";
		return "border-amber-400/40 bg-amber-500/10 text-amber-500";
	};

	const VerificationBadge = ({ value }: { value: boolean | null }) => {
		if (value === null) return <Badge variant="outline">Pending</Badge>;
		if (value)
			return (
				<Badge className="bg-green-600 hover:bg-green-700 text-white">
					Pass
				</Badge>
			);
		return <Badge variant="destructive">Mismatch</Badge>;
	};

	return (
		<div className="container mx-auto max-w-8xl py-6 md:py-10 pr-4 md:pr-6">
			<Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Connect to like posts</DialogTitle>
						<DialogDescription>
							Guests need to connect a wallet to like content. It only takes a
							moment.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							onClick={() => {
								setShowAuthDialog(false);
								openConnectModal?.();
							}}
							disabled={!openConnectModal}
						>
							Connect wallet
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<section className="relative mb-6 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-background/95 via-background/90 to-amber-50/30 p-4 shadow-lg md:p-6">
				<div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-[radial-gradient(circle,_rgba(245,158,11,0.24),_transparent_70%)] blur-xl" />
				<div className="pointer-events-none absolute -left-10 bottom-3 h-24 w-24 rounded-full bg-[radial-gradient(circle,_rgba(251,191,36,0.18),_transparent_75%)] blur-xl" />

				<div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<Button
							variant="ghost"
							size="sm"
							asChild
							className="mb-2 px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
						>
							<Link to="/feed">
								<ArrowLeft className="mr-1 h-4 w-4" /> Back to Feed
							</Link>
						</Button>
						<p className="mb-2 w-fit flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
							<Sparkles className="h-3 w-3" /> Post Detail
						</p>
						<h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
							Read first, verify when needed
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							Published {createdAtLabel} by{" "}
							{creator?.clone_name || "Unknown creator"}
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<Popover
							open={showOnboardingTip}
							onOpenChange={(open) => {
								if (!open && showOnboardingTip) {
									dismissOnboardingTip();
								}
							}}
						>
							<PopoverTrigger asChild>
								<Button
									variant={readerMode ? "default" : "outline"}
									size="sm"
									className="border-primary/30"
									onClick={() => {
										const next = !readerMode;
										setReaderMode(next);
										if (!next) {
											openOverviewFromReader();
										}
									}}
								>
									{readerMode ? (
										<Eye className="mr-1 h-4 w-4" />
									) : (
										<EyeOff className="mr-1 h-4 w-4" />
									)}
									{readerMode ? "Reader Mode On" : "Reader Mode Off"}
								</Button>
							</PopoverTrigger>
							<PopoverContent
								align="end"
								className="w-[min(92vw,300px)] rounded-xl border-primary/25 bg-background/95 p-3"
							>
								<p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
									Quick Start
								</p>
								<p className="mt-1 text-sm font-medium text-foreground">
									Read → Engage → Verify
								</p>
								<p className="mt-1 text-xs text-muted-foreground">
									Reader Mode keeps focus on content first. Turn it off when you
									want proof tabs and replay tools.
								</p>
								<div className="mt-3 flex justify-end">
									<Button
										size="sm"
										variant="outline"
										className="h-7"
										onClick={dismissOnboardingTip}
									>
										Got it
									</Button>
								</div>
							</PopoverContent>
						</Popover>
					</div>
				</div>
			</section>
			<div
				className={
					readerMode
						? "grid gap-5"
						: "grid items-stretch gap-5 sm:grid-cols-[1fr_360px] xl:grid-cols-[1fr_420px]"
				}
			>
				<div>
					<Card className="h-full border-border/70 bg-background/75">
						<CardHeader>
							<div className="flex items-start justify-between gap-4">
								<div>
									<CardTitle className="text-xl tracking-tight">
										{creator?.clone_name || "Unknown creator"}
									</CardTitle>
									<p className="text-sm text-muted-foreground">
										{creator?.x_handle || shortAddress(creator?.wallet_address)}
									</p>
								</div>
								{post.commit_tx_hash ? (
									<Badge className="gap-1 border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400">
										<Shield className="h-3 w-3" /> Verified
									</Badge>
								) : (
									<Badge variant="outline">Uncommitted</Badge>
								)}
							</div>
						</CardHeader>

						<CardContent className="flex h-full flex-col">
							<div className="rounded-2xl border border-border/70 bg-background/70 p-4">
								<div className="mb-3 flex items-center gap-1">
									{checks.map((check) =>
										check.value === false ? (
											<Popover key={`inline-${check.label}`}>
												<PopoverTrigger asChild>
													<button
														type="button"
														className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-destructive/15 ${inlineChipClass(check.value)}`}
													>
														{check.label}: Mismatch
													</button>
												</PopoverTrigger>
												<PopoverContent className="w-[280px] rounded-xl border-destructive/30 bg-background/95 p-3">
													<p className="text-xs font-semibold uppercase tracking-[0.1em] text-destructive">
														Why mismatch?
													</p>
													<ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
														{mismatchHints[
															check.label as "Prompt" | "Content" | "Meta"
														].map((hint) => (
															<li key={`${check.label}-${hint}`}>{hint}</li>
														))}
													</ul>
												</PopoverContent>
											</Popover>
										) : (
											<Badge
												key={`inline-${check.label}`}
												variant="outline"
												className={`${inlineChipClass(check.value)} px-2.5 py-1 text-[11px] font-medium`}
											>
												{check.label}:{" "}
												{check.value === true ? "Pass" : "Pending"}
											</Badge>
										),
									)}
								</div>
								<p className="whitespace-pre-wrap text-foreground/95">
									{post.content_text}
								</p>
							</div>

							<div className="mt-5 flex flex-wrap items-center gap-3">
								<Button
									variant={liked ? "default" : "outline"}
									size="sm"
									onClick={toggleLike}
									className="border-primary/30"
								>
									<Heart
										className={`mr-1 h-4 w-4 ${liked ? "fill-current" : ""}`}
									/>
									{likeCount} {likeCount === 1 ? "Like" : "Likes"}
								</Button>

								<Button
									variant="outline"
									size="sm"
									onClick={shareToX}
									className="border-primary/30"
								>
									<XIcon className="mr-1 h-4 w-4" />
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>

				{!readerMode ? (
					<Card className={`flex h-full flex-col ${snapshotFrameClass}`}>
						<CardHeader>
							<CardTitle
								className={`flex items-center gap-2 text-lg ${snapshotTitleClass}`}
							>
								<Shield className={`h-5 w-5 ${snapshotTitleClass}`} /> Quick
								Trust Snapshot
							</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-1 flex-col space-y-4">
							<div className="rounded-xl border border-border/70 bg-background/70 p-3">
								<div className="mb-2 flex items-center justify-between text-xs">
									<span className="font-medium text-muted-foreground">
										Confidence meter
									</span>
									<span className="font-semibold text-foreground">
										{confidencePercent}%
									</span>
								</div>
								<div className="h-2 overflow-hidden rounded-full bg-secondary/70">
									<div
										className={`h-full rounded-full transition-all duration-300 ${
											hasMismatch
												? "bg-destructive"
												: verificationScore === 3
													? "bg-primary"
													: "bg-amber-500"
										}`}
										style={{ width: `${confidencePercent}%` }}
									/>
								</div>
								<div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
									<span className="inline-flex items-center gap-1">
										<span className="h-2 w-2 rounded-full bg-primary" /> Pass
									</span>
									<span className="inline-flex items-center gap-1">
										<span className="h-2 w-2 rounded-full bg-amber-500" />{" "}
										Pending
									</span>
									<span className="inline-flex items-center gap-1">
										<span className="h-2 w-2 rounded-full bg-destructive" />{" "}
										Mismatch
									</span>
								</div>
							</div>

							<div className="rounded-xl border border-border/70 bg-background/70 p-4">
								<p className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
									Proof Timeline
								</p>
								<div className="flex items-center justify-center">
									<div className="flex items-center gap-2 sm:gap-4">
										<div className="flex flex-col items-center">
											<span
												className={`h-2.5 w-2.5 rounded-full ${proofTimelineSteps[0]?.done ? "bg-primary" : "bg-secondary"}`}
											/>
											<span className="mt-1 text-[11px] text-muted-foreground whitespace-nowrap">
												Generated
											</span>
										</div>
										<div
											className={`mx-1 h-[2px] w-8 sm:w-12 rounded-full ${proofTimelineSteps[1]?.done ? "bg-primary/60" : "bg-secondary"}`}
										/>
										<div className="flex flex-col items-center">
											<span
												className={`h-2.5 w-2.5 rounded-full ${proofTimelineSteps[1]?.done ? "bg-primary" : "bg-secondary"}`}
											/>
											<span className="mt-1 text-[11px] text-muted-foreground whitespace-nowrap">
												Hashed
											</span>
										</div>
										<div
											className={`mx-1 h-[2px] w-8 sm:w-12 rounded-full ${proofTimelineSteps[2]?.done ? "bg-primary/60" : "bg-secondary"}`}
										/>
										<div className="flex flex-col items-center">
											<span
												className={`h-2.5 w-2.5 rounded-full ${proofTimelineSteps[2]?.done ? "bg-primary" : "bg-secondary"}`}
											/>
											<span className="mt-1 text-[11px] text-muted-foreground whitespace-nowrap">
												Committed
											</span>
										</div>
									</div>
								</div>
							</div>

							<div
								className="grid gap-2"
								style={{
									gridTemplateColumns: `repeat(${checks.length}, minmax(0, 1fr))`,
								}}
							>
								{checks.map((check) => (
									<div
										key={check.label}
										className="rounded-xl border border-border/70 bg-background/70 p-2 text-center"
									>
										<p className="mb-1 text-[11px] text-muted-foreground">
											{check.label}
										</p>
										<VerificationBadge value={check.value} />
									</div>
								))}
							</div>

							<div className="rounded-xl border border-border/70 bg-background/70 p-3">
								<p className="text-sm text-muted-foreground">
									{hasMismatch
										? "Some checks are mismatched. Review technical proof details before trusting this artifact."
										: verificationScore === checks.length
											? "All proof checks are passing. This artifact is consistent with stored hashes."
											: "Proof checks are still pending. You can inspect each hash below."}
								</p>
							</div>

							<Button
								variant="outline"
								className={`mt-auto w-full ${ctaClass}`}
								onClick={openProofDetails}
							>
								{primaryProofCtaLabel}
							</Button>

							<p className="text-xs text-muted-foreground">
								{primaryProofCtaHint}
							</p>
						</CardContent>
					</Card>
				) : null}
			</div>

			{readerMode ? (
				<Card className="mt-6 border-border/70 bg-background/75">
					<CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
						<p className="text-sm text-muted-foreground">
							Reader Mode hides proof internals by default for distraction-free
							reading.
						</p>
						<Button
							variant="outline"
							className="border-primary/35"
							onClick={openProofDetails}
						>
							Show Proof Tools
						</Button>
					</CardContent>
				</Card>
			) : (
				<>
					<Tabs
						value={activeTab}
						onValueChange={handleTabChange}
						className="mt-6"
					>
						<TabsList className="grid w-full max-w-full grid-cols-3 sm:max-w-[520px]">
							<TabsTrigger value="overview">Overview</TabsTrigger>
							<TabsTrigger value="proof">Proof Details</TabsTrigger>
							<TabsTrigger value="replay">Replay</TabsTrigger>
						</TabsList>

						<TabsContent value="overview" className="mt-4">
							<Card className="border-border/70 bg-background/75">
								<CardHeader>
									<CardTitle className="text-lg">
										How to use this page
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-3 text-sm text-muted-foreground">
									<p>
										1. Read the content and decide if it is valuable for your
										audience.
									</p>
									<p>
										2. Like or share if useful, then open proof details only
										when verification is important.
									</p>
									<p>
										3. Use replay when you need a step-by-step trace of hash
										recomputation.
									</p>
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent value="proof" className="mt-4">
							<Card className="border-border/70 bg-background/75">
								<CardHeader>
									<CardTitle className="text-lg flex items-center gap-2">
										<Shield className="h-5 w-5 text-primary" />
										Technical Proof Details
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									{post.commit_tx_hash ? (
										<div className="rounded-xl border border-green-500/30 bg-gradient-to-r from-green-500/5 to-primary/5 p-4">
											<div className="mb-3 flex items-center justify-between">
												<div className="flex items-center gap-2">
													<Globe className="h-4 w-4 text-green-500" />
													<p className="text-sm font-semibold text-foreground">
														On-Chain Transaction
													</p>
													<Badge
														variant="outline"
														className="border-green-400/50 bg-green-500/10 text-green-400 text-xs"
													>
														<CheckCircle2 className="mr-1 h-3 w-3" />
														Verified
													</Badge>
												</div>
											</div>
											<a
												href={getExplorerTxUrl(post.commit_tx_hash)}
												target="_blank"
												rel="noopener noreferrer"
												className="group flex items-center justify-between rounded-lg bg-background/80 px-3 py-2.5 hover:bg-background transition-colors"
											>
												<div className="flex items-center gap-2 overflow-hidden">
													<Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
													<code className="font-mono text-xs text-foreground">
														{post.commit_tx_hash.slice(0, 14)}...
														{post.commit_tx_hash.slice(-10)}
													</code>
												</div>
												<ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
											</a>
											<p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
												<Link2 className="h-3 w-3" />
												View transaction on BNB Testnet Explorer
											</p>
										</div>
									) : (
										<p className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
											⏳ On-chain proof pending. This post was created before
											the blockchain integration was configured.
										</p>
									)}

									<div className="rounded-xl border border-border/60 bg-gradient-to-br from-background/60 to-card/50 p-4">
										<div className="mb-4 flex items-center gap-2">
											<FileText className="h-4 w-4 text-primary" />
											<p className="text-sm font-semibold text-foreground">
												Proof Metadata
											</p>
										</div>
										<div className="grid grid-cols-2 gap-2">
											<div className="rounded-lg border border-border/50 bg-background/60 p-3">
												<div className="flex items-center gap-1.5 mb-1.5">
													<Hash className="h-3 w-3 text-muted-foreground" />
													<p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
														Post ID
													</p>
												</div>
												<code className="text-[11px] font-mono text-foreground break-all leading-relaxed">
													{post.id}
												</code>
											</div>
											<div className="rounded-lg border border-border/50 bg-background/60 p-3">
												<div className="flex items-center gap-1.5 mb-1.5">
													<User className="h-3 w-3 text-muted-foreground" />
													<p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
														Creator
													</p>
												</div>
												<code className="text-[11px] font-mono text-foreground">
													{shortAddress(
														creator?.wallet_address ??
															post.creator?.wallet_address,
													)}
												</code>
											</div>
											<div className="rounded-lg border border-border/50 bg-background/60 p-3">
												<div className="flex items-center gap-1.5 mb-1.5">
													<Calendar className="h-3 w-3 text-muted-foreground" />
													<p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
														Created
													</p>
												</div>
												<p className="text-[11px] text-foreground">
													{new Date(post.created_at).toLocaleDateString(
														"en-US",
														{
															year: "numeric",
															month: "short",
															day: "numeric",
															hour: "2-digit",
															minute: "2-digit",
														},
													)}
												</p>
											</div>
											<div className="rounded-lg border border-border/50 bg-background/60 p-3">
												<div className="flex items-center gap-1.5 mb-1.5">
													<Sparkles className="h-3 w-3 text-muted-foreground" />
													<p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
														Model
													</p>
												</div>
												<p className="text-[11px] text-foreground">
													google/gemini-2.5-flash
												</p>
											</div>
										</div>
										<div className="mt-3 rounded-lg border border-border/50 bg-background/60 p-3">
											<div className="flex items-center gap-1.5 mb-2">
												<MessageSquare className="h-3 w-3 text-muted-foreground" />
												<p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
													Prompt
												</p>
											</div>
											<p className="text-xs text-foreground leading-relaxed bg-background/40 rounded-md p-2">
												{post.prompt_text}
											</p>
										</div>
									</div>
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent value="replay" className="mt-4">
							<Card className="border-border/70 bg-background/75">
								<CardHeader>
									<div className="flex items-center justify-between gap-3">
										<CardTitle className="text-lg">
											Proof Replay Panel
										</CardTitle>
										<Button
											size="sm"
											variant="outline"
											className="h-8 border-primary/30"
											onClick={runReplay}
										>
											{replayRunning ? (
												<LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
											) : (
												<Sparkles className="mr-1.5 h-3.5 w-3.5" />
											)}
											Replay
										</Button>
									</div>
								</CardHeader>
								<CardContent className="space-y-2">
									{replaySteps.map((step, index) => {
										const status =
											replayStep > index
												? "done"
												: replayStep === index && replayRunning
													? "active"
													: "idle";

										return (
											<div
												key={step.id}
												className="rounded-lg border border-border/70 bg-background/80 p-3"
											>
												<div className="mb-1 flex items-center gap-2">
													<span
														className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
															status === "done"
																? "bg-primary text-primary-foreground"
																: status === "active"
																	? "bg-primary/20 text-primary"
																	: "bg-secondary text-muted-foreground"
														}`}
													>
														{index + 1}
													</span>
													<p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground">
														{step.title}
													</p>
												</div>
												<p className="text-xs text-muted-foreground">
													{step.detail}
												</p>
												<code className="mt-1.5 inline-flex rounded-md bg-secondary/70 px-1.5 py-0.5 text-[11px]">
													{step.value}
												</code>
											</div>
										);
									})}
								</CardContent>
							</Card>
						</TabsContent>
					</Tabs>
				</>
			)}
		</div>
	);
}
