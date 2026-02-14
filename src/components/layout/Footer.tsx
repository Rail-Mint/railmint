import { Circle } from "lucide-react";
import { useAccount, useChainId } from "wagmi";
import { BrandMark } from "@/components/branding/BrandMark";
import { useContractStatus } from "@/hooks/useContractStatus";

export function Footer() {
	const { isConnected } = useAccount();
	const chainId = useChainId();
	const { mode, networkLabel, isDeployed } = useContractStatus();

	const chainName = isConnected ? `Chain ${chainId}` : "Not connected";

	return (
		<footer className="border-t border-border/70 bg-gradient-to-b from-secondary/20 to-secondary/35">
			<div className="container flex flex-col items-center justify-between gap-4 py-8 text-center text-sm text-muted-foreground md:flex-row md:text-left">
				<BrandMark showTagline className="justify-center md:justify-start" />

				<div className="flex items-center gap-4 text-xs">
					{/* Wallet / chain */}
					<span className="flex items-center gap-1.5">
						<Circle
							className={`h-2 w-2 fill-current ${
								isConnected
									? "text-emerald-500"
									: "text-muted-foreground/50"
							}`}
						/>
						{isConnected ? chainName : "Wallet disconnected"}
					</span>

					<span className="text-border">|</span>

					{/* Contract mode */}
					<span className="flex items-center gap-1.5">
						<Circle
							className={`h-2 w-2 fill-current ${
								mode === "live"
									? "text-emerald-500"
									: "text-amber-500"
							}`}
						/>
						{networkLabel}
						{isDeployed && (
							<span className="text-emerald-600 dark:text-emerald-400">
								· Contracts live
							</span>
						)}
					</span>
				</div>

				<p>RailMintAI · Built on BNB Chain</p>
			</div>
		</footer>
	);
}
