import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import {
	ArrowUpDown,
	Clock3,
	Flame,
	Heart,
	Loader2,
	Shield,
	Sparkles,
	Wand2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { PublicJourneyStrip } from "@/components/layout/PublicJourneyStrip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
} from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Post {
	id: string;
	content_text: string;
	content_html: string | null;
	prompt_hash: string;
	content_hash: string;
	commit_tx_hash: string | null;
	is_fallback: boolean;
	created_at: string;
	epoch_id: number;
	creator: {
		clone_name: string;
		wallet_address: string;
		x_handle: string | null;
	};
	like_count: number;
	liked_by_me: boolean;
}

const PAGE_SIZE = 12;

const cardReveal = {
	hidden: { opacity: 0, y: 20 },
	visible: (i: number) => ({
		opacity: 1,
		y: 0,
		transition: {
			delay: i * 0.05,
			duration: 0.45,
			ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
		},
	}),
};

export default function Feed() {
	const { address } = useAccount();
	const { toast } = useToast();
	const navigate = useNavigate();

	const [posts, setPosts] = useState<Post[]>([]);
	const [loading, setLoading] = useState(true);
	const [sort, setSort] = useState<"latest" | "popular">("latest");
	const [trustFirst, setTrustFirst] = useState(true);
	const [epochs, setEpochs] = useState<{ id: number; status: string }[]>([]);
	const [epochFilter, setEpochFilter] = useState<string>("all");
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>(
		{},
	);
	const [likingPostId, setLikingPostId] = useState<string | null>(null);
	const [hasCreatorProfile, setHasCreatorProfile] = useState(false);

	useEffect(() => {
		void loadData();
	}, [address, epochFilter, page]);

	async function loadData() {
		setLoading(true);

		let postQuery = supabase
			.from("posts")
			.select("*, creator:creators(clone_name, wallet_address, x_handle)", {
				count: "exact",
			})
			.order("created_at", { ascending: false })
			.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

		if (epochFilter !== "all") {
			postQuery = postQuery.eq("epoch_id", Number(epochFilter));
		}

		const [postsRes, epochsRes] = await Promise.all([
			postQuery,
			supabase
				.from("epochs")
				.select("id, status")
				.order("id", { ascending: false }),
		]);

		const postsData = postsRes.data || [];
		const totalCount = postsRes.count || 0;
		setTotalPages(Math.max(1, Math.ceil(totalCount / PAGE_SIZE)));

		const postIds = postsData.map((post) => post.id);
		let likes: { post_id: string; wallet_address: string }[] = [];

		if (postIds.length > 0) {
			const likesRes = await supabase
				.from("likes")
				.select("post_id, wallet_address")
				.in("post_id", postIds);
			likes = likesRes.data || [];
		}

		const enriched: Post[] = (
			(postsData as unknown as Array<{
				id: string;
				content_text: string;
				content_html: string | null;
				prompt_hash: string;
				content_hash: string;
				commit_tx_hash: string | null;
				is_fallback: boolean;
				created_at: string;
				epoch_id: number;
				creator: Post["creator"];
			}>) || []
		).map((post) => ({
			id: post.id,
			content_text: post.content_text,
			content_html: post.content_html || null,
			prompt_hash: post.prompt_hash,
			content_hash: post.content_hash,
			commit_tx_hash: post.commit_tx_hash,
			is_fallback: post.is_fallback || false,
			created_at: post.created_at,
			epoch_id: post.epoch_id,
			creator: post.creator as Post["creator"],
			like_count: likes.filter((like) => like.post_id === post.id).length,
			liked_by_me: address
				? likes.some(
						(like) =>
							like.post_id === post.id && like.wallet_address === address,
					)
				: false,
		}));

		// Check if user has a creator profile
		if (address) {
			const { data: creator } = await supabase
				.from("creators")
				.select("id")
				.ilike("wallet_address", address)
				.maybeSingle();
			setHasCreatorProfile(!!creator);
		} else {
			setHasCreatorProfile(false);
		}

		setPosts(enriched);
		setEpochs(epochsRes.data || []);
		setExpandedPosts({});
		setLoading(false);
	}

	async function toggleLike(postId: string, liked: boolean) {
		if (!address) {
			toast({
				title: "Connect wallet",
				description: "You need to connect your wallet to like posts.",
				variant: "destructive",
			});
			return;
		}

		if (likingPostId) {
			toast({
				title: "Like in progress",
				description: "Please wait for the current like to complete.",
				variant: "default",
			});
			return;
		}

		if (liked) {
			// Unlike via edge function
			await supabase.functions.invoke("toggle-like", {
				body: { wallet_address: address, post_id: postId, action: "unlike" },
			});

			setPosts((prev) =>
				prev.map((post) =>
					post.id === postId
						? {
								...post,
								liked_by_me: false,
								like_count: Math.max(0, post.like_count - 1),
							}
						: post,
				),
			);
		} else {
			// Like via edge function
			try {
				const post = posts.find((p) => p.id === postId);
				if (!post) return;

				setLikingPostId(postId);

				await supabase.functions.invoke("toggle-like", {
					body: { wallet_address: address, post_id: postId, action: "like" },
				});

				// On-chain like only if contracts are deployed (UUID cannot be BigInt)
				// Skip on-chain call -- contract addresses are not configured yet
				// When deployed, a numeric content ID mapping will be needed

				setPosts((prev) =>
					prev.map((p) =>
						p.id === postId
							? { ...p, liked_by_me: true, like_count: p.like_count + 1 }
							: p,
					),
				);
				setLikingPostId(null);
			} catch (error: unknown) {
				const errorMessage =
					error instanceof Error ? error.message : "Failed to like content";
				toast({
					title: "Like failed",
					description: errorMessage,
					variant: "destructive",
				});
				setLikingPostId(null);
			}
		}
	}

	function handleCreatePost() {
		if (address && hasCreatorProfile) {
			navigate("/studio/content");
		} else {
			navigate("/studio");
		}
	}

	const sortedPosts = [...posts].sort((a, b) => {
		if (trustFirst) {
			const trustDelta =
				Number(Boolean(b.commit_tx_hash)) - Number(Boolean(a.commit_tx_hash));
			if (trustDelta !== 0) return trustDelta;
		}

		if (sort === "popular") {
			return b.like_count - a.like_count;
		}

		return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
	});

	if (loading) {
		return <PageLoader message="Curating the latest creator feed..." />;
	}

	return (
		<motion.div
			initial={{ opacity: 0, y: 14 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3, ease: "easeOut" }}
			className="container py-6 sm:py-8 md:py-10"
		>
			<section className="relative mb-6 overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-background/95 via-background/90 to-amber-50/40 p-5 shadow-[0_18px_70px_-34px_rgba(245,158,11,0.55)] sm:mb-8 md:p-7">
				<div className="pointer-events-none absolute -top-20 right-[-4.5rem] h-52 w-52 rounded-full bg-[radial-gradient(circle,_rgba(245,158,11,0.22),_transparent_70%)] blur-2xl" />
				<div className="pointer-events-none absolute -left-14 top-14 h-36 w-36 rounded-full bg-[radial-gradient(circle,_rgba(251,191,36,0.18),_transparent_72%)] blur-xl" />

				<div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<p className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
							<Sparkles className="h-3.5 w-3.5" />
							Creator Pulse
						</p>
						<h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
							Content Feed
						</h1>
						<p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
							Discover AI-generated BNB ecosystem posts, sort by momentum, and
							reward the clones producing standout content.
						</p>
						<Button onClick={handleCreatePost} className="mt-3 gap-2" size="sm">
							<Wand2 className="h-4 w-4" />
							{address && hasCreatorProfile
								? "Generate Post"
								: "Start Creating"}
						</Button>
					</div>

					<div className="grid w-full grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:w-auto lg:grid-cols-3 lg:shrink-0">
						<Select
							value={epochFilter}
							onValueChange={(value) => {
								setEpochFilter(value);
								setPage(1);
							}}
						>
							<SelectTrigger className="h-10 w-full border-primary/25 bg-background/80 lg:w-[150px]">
								<SelectValue placeholder="Epoch" />
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

						<Button
							variant="outline"
							size="sm"
							className="h-10 w-full justify-center border-primary/30 bg-background/80 lg:w-auto"
							onClick={() =>
								setSort((current) =>
									current === "latest" ? "popular" : "latest",
								)
							}
						>
							<ArrowUpDown className="mr-1.5 h-4 w-4" />
							{sort === "latest" ? "Latest" : "Popular"}
						</Button>

						<Button
							variant={trustFirst ? "default" : "outline"}
							size="sm"
							className="h-10 w-full justify-center min-[480px]:col-span-2 lg:col-span-1 lg:w-auto"
							onClick={() => setTrustFirst((value) => !value)}
						>
							<Shield className="mr-1.5 h-4 w-4" />
							{trustFirst ? "Trust First" : "Trust Off"}
						</Button>
					</div>
				</div>
			</section>

			{sortedPosts.length === 0 ? (
				<div className="rounded-2xl border border-dashed border-border/70 bg-background/60 py-20 text-center text-muted-foreground">
					<p>No posts yet. Create a clone and generate content!</p>
					<div className="mt-4 flex flex-wrap items-center justify-center gap-2">
						<Button asChild variant="outline" size="sm">
							<Link to="/onboarding">Start Onboarding</Link>
						</Button>
						<Button asChild variant="outline" size="sm">
							<Link to="/leaderboard">View Leaderboard</Link>
						</Button>
					</div>
				</div>
			) : (
				<>
					<div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
						{sortedPosts.map((post, idx) =>
							(() => {
								const isExpanded = Boolean(expandedPosts[post.id]);
								const isLongPost = post.content_text.length > 260;

								return (
									<motion.div
										key={post.id}
										custom={idx}
										initial="hidden"
										whileInView="visible"
										viewport={{ once: true, amount: 0.2 }}
										variants={cardReveal}
									>
										<Card className="group flex h-full flex-col overflow-hidden border-border/70 bg-background/75 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_18px_42px_-22px_rgba(245,158,11,0.6)]">
											<CardHeader className="relative border-b border-border/60 pb-3">
												<div className="pointer-events-none absolute right-[-2.5rem] top-[-2.5rem] h-20 w-20 rounded-full bg-[radial-gradient(circle,_rgba(245,158,11,0.14),_transparent_70%)]" />
												<div className="flex items-start justify-between gap-3">
													<div>
														<p className="text-sm font-semibold tracking-tight">
															{post.creator?.clone_name || "Unknown"}
														</p>
														<p className="text-xs text-muted-foreground">
															{post.creator?.x_handle || "anon creator"}
														</p>
													</div>
													<div className="flex flex-wrap items-center justify-end gap-1.5">
														{post.commit_tx_hash ? (
															<Badge
																variant="outline"
																className="gap-1 border-primary/35 bg-primary/10 text-[11px]"
															>
																<Shield className="h-3 w-3" /> Verified
															</Badge>
														) : null}
														{post.is_fallback ? (
															<Badge
																variant="secondary"
																className="text-[11px]"
															>
																Fallback
															</Badge>
														) : null}
													</div>
												</div>
											</CardHeader>

											<CardContent className="flex-1 pt-4">
												<p
													className={`text-sm leading-relaxed text-foreground/90 ${
														isExpanded ? "" : "line-clamp-5"
													}`}
												>
													{post.content_text}
												</p>
												{isLongPost ? (
													<Button
														type="button"
														variant="link"
														size="sm"
														className="mt-1 h-auto px-0"
														onClick={() =>
															setExpandedPosts((prev) => ({
																...prev,
																[post.id]: !isExpanded,
															}))
														}
													>
														{isExpanded ? "Show less" : "Read more"}
													</Button>
												) : null}
											</CardContent>

											<CardFooter className="flex flex-col items-start gap-3 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
												<div className="flex items-center gap-2">
													<Button
														variant="ghost"
														size="sm"
														className={
															post.liked_by_me
																? "text-destructive"
																: "text-muted-foreground"
														}
														onClick={() =>
															toggleLike(post.id, post.liked_by_me)
														}
														disabled={likingPostId === post.id}
													>
														{likingPostId === post.id ? (
															<Loader2 className="mr-1 h-4 w-4 animate-spin" />
														) : (
															<Heart
																className={`mr-1 h-4 w-4 ${post.liked_by_me ? "fill-current" : ""}`}
															/>
														)}
														{post.like_count}
													</Button>
													{post.like_count >= 10 ? (
														<Badge
															variant="outline"
															className="gap-1 border-primary/35 bg-primary/10 text-[11px] text-primary"
														>
															<Flame className="h-3 w-3" /> Trending
														</Badge>
													) : null}
												</div>

												<div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-3">
													<span className="flex items-center gap-1 text-xs text-muted-foreground">
														<Clock3 className="h-3 w-3" />
														{formatDistanceToNow(new Date(post.created_at), {
															addSuffix: true,
														})}
													</span>
													<Button
														variant="ghost"
														size="sm"
														asChild
														className="group text-primary hover:text-primary"
													>
														<Link to={`/post/${post.id}`}>
															View
															<span className="ml-1 transition-transform duration-200 group-hover:translate-x-0.5">
																&rarr;
															</span>
														</Link>
													</Button>
												</div>
											</CardFooter>
										</Card>
									</motion.div>
								);
							})(),
						)}
					</div>

					<div className="mt-6 flex items-center justify-between gap-3 rounded-xl bg-background/70 px-3 py-2">
						<p className="text-xs text-muted-foreground">
							Page {page} of {totalPages}
						</p>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={page <= 1}
								onClick={() => setPage((current) => Math.max(1, current - 1))}
							>
								Previous
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={page >= totalPages}
								onClick={() =>
									setPage((current) => Math.min(totalPages, current + 1))
								}
							>
								Next
							</Button>
						</div>
					</div>
				</>
			)}

			<PublicJourneyStrip currentPage="feed" className="mt-6 sm:mt-8" />
		</motion.div>
	);
}
