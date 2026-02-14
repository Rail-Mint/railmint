import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import {
	ArrowLeft,
	CheckCircle2,
	Copy,
	ExternalLink,
	Eye,
	EyeOff,
	Heart,
	LoaderCircle,
	Share2,
	Shield,
	Sparkles,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAccount } from "wagmi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { XIcon } from "@/components/ui/x-icon";
import { useToast } from "@/hooks/use-toast";
import { useContractStatus } from "@/hooks/useContractStatus";
import { supabase } from "@/integrations/supabase/client";
import {
	computeContentHash,
	computeMetaHash,
	computePromptHash,
	getExplorerUrl,
} from "@/lib/mock-contract";

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
	prompt_hash: string;
	content_hash: string;
	meta_hash: string;
	commit_tx_hash: string | null;
	is_fallback: boolean;
	created_at: string;
	creator: Creator | null;
}

interface VerificationState {
	promptMatch: boolean | null;
	contentMatch: boolean | null;
	metaMatch: boolean | null;
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
	const { toast } = useToast();
	const { mode: contractMode } = useContractStatus();
	const [post, setPost] = useState<PostDetailData | null>(null);
	const [creator, setCreator] = useState<Creator | null>(null);
	const [likeCount, setLikeCount] = useState(0);
	const [liked, setLiked] = useState(false);
	const [loading, setLoading] = useState(true);
	const [verification, setVerification] = useState<VerificationState>({
		promptMatch: null,
		contentMatch: null,
		metaMatch: null,
	});
	const [replayStep, setReplayStep] = useState(0);
	const [replayRunning, setReplayRunning] = useState(false);
	const [activeTab, setActiveTab] = useState<"overview" | "proof" | "replay">(
		"overview",
	);
	const [readerMode, setReaderMode] = useState(true);
	const [proofBehaviorCount, setProofBehaviorCount] = useState(0);
	const [showOnboardingTip, setShowOnboardingTip] = useState(false);

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
			.select("*, creator:creators(*)")
			.eq("id", id)
			.single();
		if (!postData) {
			setLoading(false);
			return;
		}

		const normalizedPost = postData as unknown as PostDetailData;

		setPost(normalizedPost);
		setCreator(normalizedPost.creator);

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
				.eq("wallet_address", address)
				.maybeSingle();
			setLiked(!!likeData);
		}

		const cr = normalizedPost.creator;
		if (cr) {
			const recomputedPrompt = computePromptHash(
				normalizedPost.id,
				cr.id,
				normalizedPost.prompt_text,
			);
			const recomputedContent = computeContentHash(
				normalizedPost.id,
				normalizedPost.content_text,
			);
			// Model version must match generate-post edge function
			const recomputedMeta = computeMetaHash(
				"google/gemini-2.5-flash",
				normalizedPost.created_at,
				cr.wallet_address,
			);

			setVerification({
				promptMatch: recomputedPrompt === normalizedPost.prompt_hash,
				contentMatch: recomputedContent === normalizedPost.content_hash,
				metaMatch: recomputedMeta === normalizedPost.meta_hash,
			});
		}

		setLoading(false);
	}

	async function toggleLike() {
		if (!address) {
			toast({ title: "Connect wallet to like", variant: "destructive" });
			return;
		}

		if (liked) {
			await supabase
				.from("likes")
				.delete()
				.eq("post_id", id)
				.eq("wallet_address", address);
			setLiked(false);
			setLikeCount((count) => Math.max(0, count - 1));
		} else {
			const { error } = await supabase
				.from("likes")
				.insert({ post_id: id, wallet_address: address });
			if (error) return;
			setLiked(true);
			setLikeCount((count) => count + 1);
		}
	}

	function copyHash(hash: string) {
		navigator.clipboard.writeText(hash);
		toast({ title: "Copied", description: "Hash copied to clipboard." });
	}

	function shareToX() {
		const text = `Check out this AI-generated BNB content on RailMintAI! 🚀`;
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
	if (!post) {
		return (
			<div className="container py-12 text-center text-muted-foreground">
				Post not found.
			</div>
		);
	}

	const createdAtLabel = formatDistanceToNow(new Date(post.created_at), {
		addSuffix: true,
	});

	const verificationScore = [
		verification.promptMatch,
		verification.contentMatch,
		verification.metaMatch,
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
		verification.metaMatch,
	].includes(false);
	const preferVerification = proofBehaviorCount >= 3;
	const confidencePercent = Math.round((verificationScore / 3) * 100);
	const primaryProofCtaLabel = preferVerification
		? "Inspect Proof Details"
		: "Open Proof Details";
	const primaryProofCtaHint = preferVerification
		? "Behavior signal: you inspect proof often, so verification actions are prioritized."
		: "Behavior signal: you usually engage first, so proof tools stay one tap away.";
	const snapshotFrameClass = hasMismatch
		? "border-destructive/45 bg-destructive/5"
		: verificationScore === 3
			? "border-primary/45 bg-primary/10"
			: "border-amber-400/40 bg-amber-500/5";

	const snapshotTitleClass = hasMismatch
		? "text-destructive"
		: verificationScore === 3
			? "text-primary"
			: "text-amber-500";

	const ctaClass = hasMismatch
		? "border-destructive/45 text-destructive hover:bg-destructive/10"
		: verificationScore === 3
			? "border-primary/40 text-primary hover:bg-primary/10"
			: "border-amber-400/45 text-amber-500 hover:bg-amber-500/10";

	const proofPill =
		verificationScore === 3
			? "Fully verified"
			: hasMismatch
				? "Needs review"
				: verificationScore > 0
					? `${verificationScore}/3 checks passed`
					: "Awaiting verification checks";

	const checks = [
		{ label: "Prompt", value: verification.promptMatch },
		{ label: "Content", value: verification.contentMatch },
		{ label: "Meta", value: verification.metaMatch },
	];

	const mismatchHints: Record<"Prompt" | "Content" | "Meta", string[]> = {
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
		Meta: [
			"Timestamp, model id, or wallet address used for hash has changed.",
			"Wallet address format differs (checksum/casing mismatch).",
			"Metadata source fields are out of sync with stored record.",
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
				<Badge className="bg-primary/85 text-primary-foreground">Pass</Badge>
			);
		return <Badge variant="destructive">Mismatch</Badge>;
	};

	return (
		<div className="container py-8 md:py-10">
			<section className="relative mb-6 overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-background/95 via-background/88 to-amber-50/40 p-5 shadow-[0_18px_70px_-34px_rgba(245,158,11,0.55)] md:p-6">
				<div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-[radial-gradient(circle,_rgba(245,158,11,0.24),_transparent_70%)] blur-xl" />
				<div className="pointer-events-none absolute -left-10 bottom-3 h-24 w-24 rounded-full bg-[radial-gradient(circle,_rgba(251,191,36,0.18),_transparent_75%)] blur-xl" />

				<div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
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
						<p className="mb-2 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
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

						<Badge
							variant="outline"
							className="border-primary/30 bg-primary/10 text-primary"
						>
							{proofPill}
						</Badge>
						{post.is_fallback ? (
							<Badge variant="secondary">Fallback source</Badge>
						) : null}
					</div>
				</div>
			</section>

			<div
				className={
					readerMode
						? "grid gap-6"
						: "grid items-stretch gap-6 lg:grid-cols-[1.2fr_0.8fr]"
				}
			>
				<motion.div
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3 }}
					className="h-full"
				>
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
									<Badge
										variant="outline"
										className="gap-1 border-primary/35 bg-primary/10 text-primary"
									>
										<Shield className="h-3 w-3" /> Verified
									</Badge>
								) : (
									<Badge variant="outline">Uncommitted</Badge>
								)}
							</div>
						</CardHeader>

						<CardContent className="flex h-full flex-col">
							<div className="rounded-2xl border border-border/70 bg-background/70 p-4">
								<div className="mb-3 flex flex-wrap items-center gap-2">
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
												className={inlineChipClass(check.value)}
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
				</motion.div>

				{!readerMode ? (
					<motion.div
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.3, delay: 0.03 }}
						className="h-full"
					>
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

								<div className="rounded-xl border border-border/70 bg-background/70 p-3">
									<p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
										Proof timeline
									</p>
									<div className="flex items-center">
										{proofTimelineSteps.map((step, index) => (
											<div
												key={step.label}
												className="flex min-w-0 flex-1 items-center"
											>
												<div className="flex min-w-0 flex-col items-center">
													<span
														className={`h-2.5 w-2.5 rounded-full ${step.done ? "bg-primary" : "bg-secondary"}`}
													/>
													<span className="mt-1 text-[11px] text-muted-foreground">
														{step.label}
													</span>
												</div>
												{index < proofTimelineSteps.length - 1 ? (
													<div
														className={`mx-2 h-[2px] flex-1 rounded-full ${proofTimelineSteps[index + 1]?.done && step.done ? "bg-primary/60" : "bg-secondary"}`}
													/>
												) : null}
											</div>
										))}
									</div>
								</div>

								<div className="grid grid-cols-3 gap-2">
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
											: verificationScore === 3
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
					</motion.div>
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
								<CardTitle className="text-lg">How to use this page</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3 text-sm text-muted-foreground">
								<p>
									1. Read the content and decide if it is valuable for your
									audience.
								</p>
								<p>
									2. Like or share if useful, then open proof details only when
									verification is important.
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
								<CardTitle className="text-lg">
									Technical Proof Details
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<HashRow
									label="Prompt Hash"
									hash={post.prompt_hash}
									match={verification.promptMatch}
									onCopy={copyHash}
								/>
								<HashRow
									label="Content Hash"
									hash={post.content_hash}
									match={verification.contentMatch}
									onCopy={copyHash}
								/>
								<HashRow
									label="Meta Hash"
									hash={post.meta_hash}
									match={verification.metaMatch}
									onCopy={copyHash}
								/>

								{post.commit_tx_hash ? (
									<div className="rounded-xl border border-primary/30 bg-primary/10 p-3">
										<div className="mb-1 flex items-center gap-2">
											<p className="text-sm font-medium text-foreground">
												Onchain transaction
											</p>
											{contractMode === "mock" && (
												<Badge variant="outline" className="text-[10px] border-amber-400/40 bg-amber-500/10 text-amber-600">
													Mock TX
												</Badge>
											)}
										</div>
										<a
											href={getExplorerUrl(post.commit_tx_hash)}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
										>
											{post.commit_tx_hash.slice(0, 20)}...
											{post.commit_tx_hash.slice(-8)}
											<ExternalLink className="h-3 w-3" />
										</a>
										{contractMode === "mock" && (
											<p className="mt-1 text-[11px] text-muted-foreground">
												This is a simulated hash. Real on-chain commits will be available when contracts are deployed.
											</p>
										)}
									</div>
								) : (
									<p className="rounded-xl border border-dashed border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
										No onchain commit yet. This post is still valid in-app while
										commit proof is pending.
									</p>
								)}
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="replay" className="mt-4">
						<Card className="border-border/70 bg-background/75">
							<CardHeader>
								<div className="flex items-center justify-between gap-3">
									<CardTitle className="text-lg">Proof Replay Panel</CardTitle>
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
			)}
		</div>
	);
}
