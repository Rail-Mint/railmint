import { cn } from "@/lib/utils";

interface BrandMarkProps {
	compact?: boolean;
	className?: string;
	showTagline?: boolean;
	markOnly?: boolean;
}

export function BrandMark({
	compact = false,
	className,
	showTagline = false,
	markOnly = false,
}: BrandMarkProps) {
	const box = compact ? "h-11 w-11" : "h-12 w-12";

	return (
		<div
			className={cn("inline-flex items-center gap-2.5", className)}
			aria-label="RailMintAI"
		>
			<div
				className={cn(
					"grid place-items-center transition-transform duration-200 hover:scale-[1.02]",
					box,
				)}
			>
				<img
					src="/brand/railmindai-mark-master.png"
					alt="RailMintAI logo"
					className="h-full w-full object-contain"
					loading="eager"
					decoding="async"
				/>
			</div>

			{markOnly ? null : (
				<div className="leading-none">
					<div className="flex items-center gap-1.5">
						<span
							className={cn(
								"font-semibold tracking-tight text-foreground",
								compact ? "text-[15px]" : "text-base",
							)}
						>
							RailMint
						</span>
						<span className="rounded-full border border-amber-400/45 bg-amber-300/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-600 dark:text-amber-400">
							AI
						</span>
					</div>
					{!compact && showTagline ? (
						<p className="mt-1 hidden text-[11px] font-medium tracking-[0.04em] text-muted-foreground md:block">
							Creator intelligence with proof-first rewards
						</p>
					) : null}
				</div>
			)}
		</div>
	);
}
