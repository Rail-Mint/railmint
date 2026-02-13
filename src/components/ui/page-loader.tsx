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
				"flex min-h-[220px] items-center justify-center px-4",
				className,
			)}
		>
			<div className="flex flex-col items-center gap-3 text-center">
				<div className="flex items-center justify-center gap-2">
					{[0, 1, 2].map((dot) => (
						<motion.span
							key={dot}
							className="h-2.5 w-2.5 rounded-full bg-primary"
							animate={{ opacity: [0.35, 1, 0.35], y: [0, -3, 0] }}
							transition={{
								repeat: Number.POSITIVE_INFINITY,
								duration: 0.9,
								delay: dot * 0.14,
							}}
						/>
					))}
				</div>
				<p className="text-sm text-muted-foreground">{message}</p>
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
				"inline-flex items-center gap-2 text-sm text-muted-foreground",
				className,
			)}
		>
			<motion.span
				className="h-2 w-2 rounded-full bg-primary"
				animate={{ scale: [0.85, 1.2, 0.85], opacity: [0.45, 1, 0.45] }}
				transition={{ repeat: Number.POSITIVE_INFINITY, duration: 0.9 }}
			/>
			{label}
		</div>
	);
}
