import { motion, useReducedMotion } from "framer-motion";
import {
	ArrowRight,
	Bot,
	ChevronRight,
	Heart,
	Shield,
	Sparkles,
	Star,
	Trophy,
} from "lucide-react";
import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type LandingStats = {
	creators: number;
	posts: number;
	likes: number;
};

const steps = [
	{
		step: "01",
		title: "Create Your Clone",
		description:
			"Connect your wallet, define your persona, and train your creator style in minutes.",
		icon: Bot,
		accent: "from-amber-400/20 to-orange-500/10",
	},
	{
		step: "02",
		title: "Generate Verified Content",
		description:
			"Your clone publishes BNB ecosystem posts with proof and transparent authorship flow.",
		icon: Shield,
		accent: "from-yellow-400/20 to-lime-500/10",
	},
	{
		step: "03",
		title: "Climb & Earn Onchain",
		description:
			"Community engagement drives rankings and each epoch pays top creators automatically.",
		icon: Trophy,
		accent: "from-orange-400/20 to-rose-500/10",
	},
];

export default function LandingPage() {
	const { isConnected } = useAccount();
	const prefersReducedMotion = useReducedMotion();
	const [landingStats] = useState<LandingStats>({
		creators: 100,
		posts: 50,
		likes: 500,
	});

	const stats = [
		{
			label: "Creator Clones",
			value: `${landingStats.creators}+`,
			icon: Bot,
		},
		{
			label: "Posts Generated",
			value: `${landingStats.posts}+`,
			icon: Sparkles,
		},
		{
			label: "Community Likes",
			value: `${landingStats.likes}+`,
			icon: Heart,
		},
	];

	const fadeUp = {
		hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 28 },
		visible: (i: number) => ({
			opacity: 1,
			y: 0,
			transition: {
				delay: prefersReducedMotion ? 0 : i * 0.12,
				duration: prefersReducedMotion ? 0.01 : 0.65,
				ease: [0.21, 1, 0.35, 1] as [number, number, number, number],
			},
		}),
	};

	return (
		<div className="relative overflow-hidden">
			{/* Background blobs */}
			<div className="pointer-events-none absolute inset-0 -z-10">
				<div className="hero-noise h-full w-full" />
				<motion.div
					className="absolute -top-28 left-[-10rem] h-80 w-80 rounded-full bg-[radial-gradient(circle,_rgba(245,158,11,0.26),_transparent_70%)] blur-xl"
					animate={prefersReducedMotion ? {} : { x: [0, 36, 0], y: [0, 20, 0] }}
					transition={
						prefersReducedMotion
							? undefined
							: {
									repeat: Number.POSITIVE_INFINITY,
									duration: 15,
									ease: "easeInOut",
								}
					}
				/>
				<motion.div
					className="absolute right-[-8rem] top-20 h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(250,204,21,0.26),_transparent_68%)] blur-xl"
					animate={
						prefersReducedMotion ? {} : { x: [0, -28, 0], y: [0, -24, 0] }
					}
					transition={
						prefersReducedMotion
							? undefined
							: {
									repeat: Number.POSITIVE_INFINITY,
									duration: 12,
									ease: "easeInOut",
								}
					}
				/>
			</div>

			{/* Hero Section */}
			<section className="container pb-12 pt-12 sm:pt-14 md:pb-20 md:pt-24">
				<motion.div
					initial={
						prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }
					}
					animate={{ opacity: 1, y: 0 }}
					transition={
						prefersReducedMotion
							? { duration: 0.01 }
							: { duration: 0.7, ease: [0.21, 1, 0.35, 1] }
					}
					className="mx-auto max-w-5xl rounded-3xl border border-border/50 bg-gradient-to-br from-background via-background/95 to-amber-50/40 p-5 shadow-[0_24px_80px_-30px_rgba(15,23,42,0.18)] backdrop-blur-sm dark:border-white/30 dark:shadow-[0_24px_80px_-30px_rgba(15,23,42,0.55)] sm:p-6 md:p-10"
				>
					{/* Pills row */}
					<div className="mb-4 flex flex-wrap items-center justify-between gap-4">
						<span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
							<Star className="h-3.5 w-3.5" />
							Creator Clone Arena on BNB Chain
						</span>
						<span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground">
							<Sparkles className="h-3.5 w-3.5 text-primary" />
							Epoch rewards every cycle
						</span>
					</div>

					{/* Gradient divider */}
					<div className="mb-8 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

					<div className="grid items-center gap-10 md:grid-cols-[1.35fr_0.8fr]">
						<div>
							<h1 className="text-balance text-3xl font-bold leading-[1.05] tracking-tight sm:text-4xl md:text-6xl">
								Turn your creator style into a
								<span className="block bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 bg-clip-text text-transparent">
									verified AI revenue engine.
								</span>
							</h1>
							<p className="mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
								Launch an AI clone that publishes BNB ecosystem content in your
								voice, earns trust through transparent proofs, and competes for
								onchain rewards powered by real community votes.
							</p>

							<div className="mt-8 flex flex-wrap items-center gap-3">
								<Button
									size="lg"
									asChild
									className="bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-primary/25 transition-all duration-200 hover:from-amber-600 hover:to-orange-600 hover:shadow-primary/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
								>
									<Link to="/studio">
										{isConnected ? "Go to Studio" : "Open Studio"}
									</Link>
								</Button>
								<Button
									size="lg"
									variant="outline"
									asChild
									className="group border-primary/40 bg-background/70"
								>
									<Link to="/feed">
										Explore Feed
										<ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
									</Link>
								</Button>
							</div>
						</div>

						{/* Stat cards */}
						<motion.div
							className="grid gap-3"
							initial={
								prefersReducedMotion
									? { opacity: 1, x: 0 }
									: { opacity: 0, x: 24 }
							}
							animate={{ opacity: 1, x: 0 }}
							transition={
								prefersReducedMotion
									? { duration: 0.01 }
									: { delay: 0.2, duration: 0.6 }
							}
						>
							{stats.map((stat, i) => (
								<Card
									key={stat.label}
									className="cursor-default border-border/70 bg-background/70 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_18px_42px_-24px_rgba(245,158,11,0.7)]"
								>
									<CardContent className="flex items-center gap-4 p-4">
										<div className="rounded-xl border border-primary/30 bg-primary/10 p-3">
											<stat.icon className="h-5 w-5 text-primary" />
										</div>
										<div>
											<p className="text-2xl font-semibold tabular-nums tracking-tight">
												{stat.value}
											</p>
											<p className="text-sm text-muted-foreground">
												{stat.label}
											</p>
										</div>
										<div
											className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-primary/70 md:block"
											style={{ opacity: 0.45 + i * 0.16 }}
										/>
									</CardContent>
								</Card>
							))}
						</motion.div>
					</div>
				</motion.div>
			</section>

			{/* How It Works Section */}
			<section className="container pb-16 sm:pb-20 md:pb-24">
				<motion.div
					initial={
						prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 26 }
					}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, amount: 0.3 }}
					transition={
						prefersReducedMotion ? { duration: 0.01 } : { duration: 0.6 }
					}
					className="mb-8 flex items-end justify-between gap-5 sm:mb-10"
				>
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
							How It Works
						</p>
						<h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
							From creator setup to transparent payout
						</h2>
					</div>
					<p className="hidden max-w-sm text-sm text-muted-foreground md:block">
						Simple setup, strong proof, and measurable competition loops
						designed for creator growth.
					</p>
				</motion.div>

				{/* Steps grid with connectors on md+ */}
				<div className="grid gap-5 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
					{steps.map((step, i) => (
						<Fragment key={step.step}>
							<motion.div
								custom={i}
								initial="hidden"
								whileInView="visible"
								variants={fadeUp}
								viewport={{ once: true }}
							>
								<Card className="group relative h-full overflow-hidden border-border/70 bg-background/80 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
									<div
										className={`absolute inset-0 bg-gradient-to-br ${step.accent} opacity-60`}
									/>
									<CardContent className="relative flex h-full flex-col p-6">
										<div className="mb-5 flex items-center justify-between">
											<span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 bg-background/70">
												<step.icon className="h-5 w-5 text-primary" />
											</span>
											<span className="text-sm font-bold tracking-[0.22em] text-primary/80">
												STEP {step.step}
											</span>
										</div>
										<h3 className="text-lg font-semibold tracking-tight">
											{step.title}
										</h3>
										<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
											{step.description}
										</p>
										<div className="mt-auto pt-6">
											<div className="h-1 w-14 rounded-full bg-primary/70 transition-all duration-300 group-hover:w-full" />
										</div>
									</CardContent>
								</Card>
							</motion.div>
							{i < steps.length - 1 && (
								<div className="hidden items-center justify-center md:flex">
									<ChevronRight className="h-5 w-5 text-primary/40" />
								</div>
							)}
						</Fragment>
					))}
				</div>

				{/* Bottom CTA */}
				<motion.div
					initial={
						prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }
					}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, amount: 0.5 }}
					transition={
						prefersReducedMotion
							? { duration: 0.01 }
							: { delay: 0.3, duration: 0.5 }
					}
					className="mt-12 text-center"
				>
					<p className="text-sm text-muted-foreground">
						Ready to launch your clone?
					</p>
					<Button
						variant="link"
						size="sm"
						asChild
						className="mt-1 text-primary"
					>
						<Link to="/studio">
							Get started now
							<ArrowRight className="ml-1 h-3.5 w-3.5" />
						</Link>
					</Button>
				</motion.div>
			</section>
		</div>
	);
}
