import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { usePublishContent } from "@/hooks/useContentManager";
import type { CreatorProfile, PostPreview } from "@/hooks/useStudioData";
import { supabase } from "@/integrations/supabase/client";
import { useSignedAction } from "@/hooks/useSignedAction";
import {
	CheckCircle2,
	ChevronRight,
	Dice5,
	Edit3,
	FileText,
	Filter,
	Gamepad2,
	Link2,
	Loader2,
	Package,
	PenLine,
	Shield,
	Sparkles,
	Sprout,
	Vote,
	Wallet
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const TOPIC_OPTIONS = [
	{ value: "random", label: "Random (AI picks)", icon: Dice5 },
	{
		value: "BNB Chain ecosystem growth and developer adoption",
		label: "Ecosystem Growth",
		icon: Sprout,
	},
	{
		value: "DeFi innovations on BNB Smart Chain",
		label: "DeFi Innovations",
		icon: Wallet,
	},
	{
		value: "BNB Greenfield decentralized storage",
		label: "Greenfield Storage",
		icon: Package,
	},
	{
		value: "Cross-chain interoperability with BNB Chain",
		label: "Cross-chain",
		icon: Link2,
	},
	{
		value: "NFT and gaming ecosystem on BNB Chain",
		label: "NFT & Gaming",
		icon: Gamepad2,
	},
	{
		value: "BNB Chain security and audit best practices",
		label: "Security & Audits",
		icon: Shield,
	},
	{
		value: "BNB Chain governance and community proposals",
		label: "Governance",
		icon: Vote,
	},
	{ value: "custom", label: "Custom topic…", icon: PenLine },
];

const TONE_OPTIONS = [
	{ value: "default", label: "Use clone persona" },
	{ value: "educational", label: "Educational & informative" },
	{ value: "casual", label: "Casual & conversational" },
	{ value: "professional", label: "Professional & formal" },
	{ value: "hype", label: "Excited & bullish" },
];

const LENGTH_OPTIONS = [
	{ value: "short", label: "Short (80–150 words)" },
	{ value: "medium", label: "Medium (150–300 words)" },
	{ value: "long", label: "Long (300–500 words)" },
];

const MODEL_OPTIONS = [
	{ value: "google/gemini-3-pro", label: "Gemini 3 Pro" },
	{ value: "google/gemini-3-flash", label: "Gemini 3 Flash" },
	{ value: "openai/gpt-5.2", label: "GPT-5.2" },
	{ value: "anthropic/claude-4-5-sonnet", label: "Claude 4.5 Sonnet" },
];

interface Props {
	profile: CreatorProfile;
	address: string | undefined;
	recentPosts: PostPreview[];
	onPostsUpdate: (posts: PostPreview[]) => void;
}

type DialogStep = "options" | "review" | "edit";

export function StudioContent({
	profile,
	address,
	recentPosts,
	onPostsUpdate,
}: Props) {
	const { toast } = useToast();
	const { invokeWithSignature } = useSignedAction();
	const {
		publishContent,
		isPending: isTxPending,
		isConfirming: isTxConfirming,
	} = usePublishContent();
	const [generating, setGenerating] = useState(false);
	const [epochFilter, setEpochFilter] = useState<string>("all");

	// Dialog state
	const [dialogOpen, setDialogOpen] = useState(false);
	const [step, setStep] = useState<DialogStep>("options");
	const [selectedTopic, setSelectedTopic] = useState("random");
	const [customTopic, setCustomTopic] = useState("");
	const [selectedTone, setSelectedTone] = useState("default");
	const [selectedLength, setSelectedLength] = useState("medium");
	const [selectedModel, setSelectedModel] = useState("google/gemini-3-pro");
	const [generatedContent, setGeneratedContent] = useState("");

	const epochs = useMemo(() => {
		const set = new Set(recentPosts.map((p) => p.epoch_id));
		return [...set].sort((a, b) => b - a);
	}, [recentPosts]);

	const filteredPosts = useMemo(() => {
		if (epochFilter === "all") return recentPosts;
		return recentPosts.filter((p) => String(p.epoch_id) === epochFilter);
	}, [recentPosts, epochFilter]);

	const totalLikes = recentPosts.reduce((s, p) => s + p.like_count, 0);
	const committedCount = recentPosts.filter((p) => p.commit_tx_hash).length;

	const resolvedTopic =
		selectedTopic === "custom" ? customTopic : selectedTopic;
	const topicLabel =
		selectedTopic === "random"
			? "Random (AI picks)"
			: selectedTopic === "custom"
				? customTopic || "(empty)"
				: (TOPIC_OPTIONS.find((t) => t.value === selectedTopic)?.label ??
					selectedTopic);
	const toneLabel =
		TONE_OPTIONS.find((t) => t.value === selectedTone)?.label ?? selectedTone;
	const lengthLabel =
		LENGTH_OPTIONS.find((l) => l.value === selectedLength)?.label ??
		selectedLength;
	const modelLabel =
		MODEL_OPTIONS.find((m) => m.value === selectedModel)?.label ?? selectedModel;

	function openDialog() {
		setStep("options");
		setDialogOpen(true);
	}

	function goToReview() {
		if (selectedTopic === "custom" && !customTopic.trim()) {
			toast({ title: "Enter a custom topic", variant: "destructive" });
			return;
		}
		setStep("review");
	}

	async function handleGenerate() {
		if (!address || !profile) return;
		setGenerating(true);
		try {
			const data = await invokeWithSignature("generate-post", {
				topic: resolvedTopic === "random" ? undefined : resolvedTopic,
				tone: selectedTone === "default" ? undefined : selectedTone,
				length: selectedLength,
				model: selectedModel,
			}, address);
			if (data?.error) throw new Error(data.error);

			// Fetch the generated post from database
			const { data: postData } = (await supabase
				.from("posts")
				.select("content_text, content_html")
				.eq("id", data.post_id)
				.single()) as any;

			// Use HTML content if available, otherwise fall back to plain text
			const content = postData?.content_html || postData?.content_text || "";
			setGeneratedContent(content);
			setStep("edit");
			toast({
				title: "Content generated!",
				description: "Review and edit before posting.",
			});
		} catch (err: any) {
			toast({
				title: "Generation failed",
				description: err.message || "An error occurred",
				variant: "destructive",
			});
		} finally {
			setGenerating(false);
		}
	}

	async function handlePostContent() {
		if (!address || !profile) {
			toast({
				title: "Wallet not connected",
				description: "Please connect your wallet first.",
				variant: "destructive",
			});
			return;
		}
		if (!generatedContent || !generatedContent.trim()) {
			toast({
				title: "No content",
				description: "Please generate or write some content first.",
				variant: "destructive",
			});
			return;
		}
		setDialogOpen(false);
		setGenerating(true);
		try {
			const isHtmlContent =
				generatedContent.includes("<") && generatedContent.includes(">");
			const plainText = isHtmlContent
				? generatedContent.replace(/<[^>]*>/g, "").trim()
				: generatedContent.trim();

			const data = await invokeWithSignature("create-post", {
				content_text: plainText,
				content_html: isHtmlContent ? generatedContent : "",
			}, address);
			if (data?.error) throw new Error(data.error);

			const { data: posts } = await supabase
				.from("posts")
				.select("id, content_text, created_at, epoch_id, commit_tx_hash")
				.eq("creator_id", profile.id)
				.order("created_at", { ascending: false })
				.limit(20);

			if (posts?.length) {
				onPostsUpdate(posts.map((p) => ({ ...p, like_count: 0 })));
			}

			toast({
				title: "Post published!",
				description: "Your content is now live.",
			});
		} catch (err: any) {
			toast({
				title: "Post failed",
				description: err.message || "An error occurred",
				variant: "destructive",
			});
		} finally {
			setGenerating(false);
			setGeneratedContent("");
			setStep("options");
		}
	}

	return (
		<div className="space-y-6">
			{/* Stats bar */}
			<div className="grid gap-4 sm:grid-cols-3">
				<StatChip
					label="Total Posts"
					value={String(recentPosts.length)}
					icon={<FileText className="h-4 w-4" />}
				/>
				<StatChip
					label="Total Likes"
					value={String(totalLikes)}
					icon={<Sparkles className="h-4 w-4" />}
				/>
				<StatChip
					label="On-chain"
					value={`${committedCount}/${recentPosts.length}`}
					icon={<CheckCircle2 className="h-4 w-4" />}
				/>
			</div>

			{/* Content card */}
			<Card className="border-border/40">
				<CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
					<CardTitle className="flex items-center gap-2 text-lg">
						<FileText className="h-5 w-5 text-primary" />
						Content
					</CardTitle>
					<div className="flex flex-wrap items-center gap-2">
						{epochs.length > 1 && (
							<Select value={epochFilter} onValueChange={setEpochFilter}>
								<SelectTrigger className="h-8 w-[130px] text-xs border-border/40">
									<Filter className="mr-1 h-3 w-3" />
									<SelectValue placeholder="All epochs" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All epochs</SelectItem>
									{epochs.map((e) => (
										<SelectItem key={e} value={String(e)}>
											Epoch {e}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
						<Button
							onClick={openDialog}
							disabled={generating || isTxPending || isTxConfirming || !profile}
							size="sm"
							className="gap-2"
						>
							{generating ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Sparkles className="h-4 w-4" />
							)}
							{generating ? "Generating…" : "Generate Post"}
						</Button>
					</div>
				</CardHeader>
				<CardContent className="space-y-3">
					{filteredPosts.length === 0 ? (
						<div className="rounded-2xl border border-dashed border-border/40 bg-muted/20 p-8 text-center">
							<Sparkles className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
							<p className="text-sm text-muted-foreground">
								{epochFilter !== "all"
									? "No posts in this epoch."
									: 'No content yet. Hit "Generate Post" to create your first AI post.'}
							</p>
						</div>
					) : (
						<div className="grid gap-3 sm:grid-cols-2">
							{filteredPosts.slice(0, 8).map((post) => (
								<Link
									key={post.id}
									to={`/post/${post.id}`}
									className="group rounded-2xl border border-border/40 bg-card/60 p-4 transition-all hover:border-primary/30 hover:shadow-md"
								>
									<p className="line-clamp-3 text-sm">{post.content_text}</p>
									<div className="mt-3 flex items-center justify-between">
										<div className="flex items-center gap-2">
											<span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
												{post.like_count}
											</span>
											<span className="text-xs text-muted-foreground">
												likes
											</span>
										</div>
										<div className="flex items-center gap-2">
											{post.commit_tx_hash && (
												<span className="flex items-center gap-1 text-[10px] text-primary">
													<CheckCircle2 className="h-3 w-3" /> On-chain
												</span>
											)}
											<span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
												Epoch {post.epoch_id}
											</span>
										</div>
									</div>
								</Link>
							))}
						</div>
					)}
					<Button asChild variant="outline" size="sm" className="rounded-xl">
						<Link to="/feed">Open Feed</Link>
					</Button>
				</CardContent>
			</Card>

			{/* Generate Post Dialog */}
			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="max-w-3xl bg-card border-border/40">
					{step === "options" ? (
						<>
							<DialogHeader>
								<DialogTitle className="flex items-center gap-2">
									<Sparkles className="h-5 w-5 text-primary" />
									Generate Post
								</DialogTitle>
							</DialogHeader>

							<div className="space-y-5 py-2">
								{/* Topic */}
								<div className="space-y-2">
									<Label className="text-sm font-medium">Topic</Label>
									<Select
										value={selectedTopic}
										onValueChange={setSelectedTopic}
									>
										<SelectTrigger className="border-border/40">
											<SelectValue />
										</SelectTrigger>
										<SelectContent className="bg-card border-border/40 z-50">
											{TOPIC_OPTIONS.map((t) => {
												const Icon = t.icon;
												return (
													<SelectItem key={t.value} value={t.value}>
														<span className="flex items-center gap-2">
															<Icon className="h-3.5 w-3.5 shrink-0" />
															{t.label}
														</span>
													</SelectItem>
												);
											})}
										</SelectContent>
									</Select>
									{selectedTopic === "custom" && (
										<Textarea
											placeholder="Describe your topic…"
											value={customTopic}
											onChange={(e) => setCustomTopic(e.target.value)}
											className="mt-2 min-h-[72px] border-border/40 text-sm"
										/>
									)}
								</div>

								{/* Tone */}
								<div className="space-y-2">
									<Label className="text-sm font-medium">Tone</Label>
									<Select value={selectedTone} onValueChange={setSelectedTone}>
										<SelectTrigger className="border-border/40">
											<SelectValue />
										</SelectTrigger>
										<SelectContent className="bg-card border-border/40 z-50">
											{TONE_OPTIONS.map((t) => (
												<SelectItem key={t.value} value={t.value}>
													{t.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								{/* Length */}
								<div className="space-y-2">
									<Label className="text-sm font-medium">Length</Label>
									<Select
										value={selectedLength}
										onValueChange={setSelectedLength}
									>
										<SelectTrigger className="border-border/40">
											<SelectValue />
										</SelectTrigger>
										<SelectContent className="bg-card border-border/40 z-50">
											{LENGTH_OPTIONS.map((l) => (
												<SelectItem key={l.value} value={l.value}>
													{l.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								{/* Model */}
								<div className="space-y-2">
									<Label className="text-sm font-medium">LLM Model</Label>
									<Select
										value={selectedModel}
										onValueChange={setSelectedModel}
									>
										<SelectTrigger className="border-border/40">
											<SelectValue />
										</SelectTrigger>
										<SelectContent className="bg-card border-border/40 z-50">
											{MODEL_OPTIONS.map((m) => (
												<SelectItem key={m.value} value={m.value}>
													{m.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>

							<div className="flex justify-end pt-2">
								<Button onClick={goToReview} className="gap-2">
									Review <ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						</>
					) : step === "edit" ? (
						<>
							<DialogHeader>
								<DialogTitle className="flex items-center gap-2">
									<Edit3 className="h-5 w-5 text-primary" />
									Edit Content
								</DialogTitle>
							</DialogHeader>

							<div className="space-y-3 py-2">
								<RichTextEditor
									content={generatedContent}
									onChange={setGeneratedContent}
									placeholder="Edit your generated content..."
								/>
							</div>

							<div className="flex items-center justify-between pt-2">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setStep("review")}
								>
									← Back
								</Button>
								<Button onClick={handlePostContent} className="gap-2">
									<Sparkles className="h-4 w-4" />
									Post Now
								</Button>
							</div>
						</>
					) : (
						<>
							<DialogHeader>
								<DialogTitle className="flex items-center gap-2">
									<CheckCircle2 className="h-5 w-5 text-primary" />
									Review &amp; Generate
								</DialogTitle>
							</DialogHeader>

							<div className="space-y-3 py-2">
								<ReviewRow label="Clone" value={profile.clone_name} />
								<ReviewRow label="Topic" value={topicLabel} />
								<ReviewRow label="Tone" value={toneLabel} />
								<ReviewRow label="Length" value={lengthLabel} />
								<ReviewRow label="Model" value={modelLabel} />
							</div>

							<div className="flex items-center justify-between pt-2">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setStep("options")}
									disabled={generating}
								>
									← Back
								</Button>
								<Button
									onClick={handleGenerate}
									className="gap-2"
									disabled={generating}
								>
									{generating ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Sparkles className="h-4 w-4" />
									)}
									{generating ? "Generating..." : "Generate Now"}
								</Button>
							</div>
						</>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}

function ReviewRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-start justify-between rounded-xl border border-border/30 bg-muted/20 px-4 py-2.5">
			<span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
				{label}
			</span>
			<span className="text-sm font-medium text-right max-w-[60%]">
				{value}
			</span>
		</div>
	);
}

function StatChip({
	label,
	value,
	icon,
}: {
	label: string;
	value: string;
	icon: React.ReactNode;
}) {
	return (
		<Card className="border-border/40">
			<CardContent className="flex items-center gap-3 p-4">
				<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
					{icon}
				</div>
				<div>
					<p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
						{label}
					</p>
					<p className="text-lg font-bold">{value}</p>
				</div>
			</CardContent>
		</Card>
	);
}
