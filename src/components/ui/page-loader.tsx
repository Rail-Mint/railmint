import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PageLoaderProps {
	message?: string;
	className?: string;
}

interface InlineLoaderProps {
	label?: string;
	className?: string;
}

export function PageLoader({
	message = "Syncing creator data...",
	className,
}: PageLoaderProps) {
	return (
		<div
			className={cn(
				"flex min-h-screen flex-col items-center justify-center px-4 py-12",
				className,
			)}
		>
			<div className="flex flex-col items-center gap-6 text-center">
				<div className="flex items-center gap-1.5">
					{[0, 1, 2].map((dot) => (
						<motion.span
							key={dot}
							className="h-3 w-3 rounded-full bg-amber-500"
							animate={{
								opacity: [0.3, 1, 0.3],
								scale: [0.85, 1.15, 0.85],
								y: [0, -4, 0],
							}}
							transition={{
								repeat: Number.POSITIVE_INFINITY,
								duration: 1.2,
								delay: dot * 0.15,
								ease: "easeInOut",
							}}
						/>
					))}
				</div>

				<div className="space-y-2">
					<p className="text-lg font-medium text-foreground tracking-tight">
						{message}
					</p>
					<p className="text-sm text-muted-foreground max-w-xs">
						Please wait while we prepare your content
					</p>
				</div>

				<div className="h-0.5 w-32 overflow-hidden rounded-full bg-muted">
					<motion.div
						className="h-full bg-amber-500"
						animate={{ x: ["-100%", "100%"] }}
						transition={{
							repeat: Number.POSITIVE_INFINITY,
							duration: 1.5,
							ease: "easeInOut",
						}}
						style={{ width: "30%" }}
					/>
				</div>
			</div>
		</div>
	);
}

export function InlineLoader({
	label = "Loading...",
	className,
}: InlineLoaderProps) {
	return (
		<div
			className={cn(
				"flex min-h-screen flex-col items-center justify-center gap-4",
				className,
			)}
		>
			<div className="flex items-center gap-2">
				{[0, 1, 2].map((i) => (
					<motion.span
						key={i}
						className="h-2.5 w-2.5 rounded-full bg-amber-500"
						animate={{
							opacity: [0.3, 1, 0.3],
							scale: [0.85, 1.15, 0.85],
						}}
						transition={{
							repeat: Number.POSITIVE_INFINITY,
							duration: 1,
							delay: i * 0.12,
							ease: "easeInOut",
						}}
					/>
				))}
			</div>
			<p className="text-base font-medium text-foreground animate-pulse">
				{label}
			</p>
		</div>
	);
}
