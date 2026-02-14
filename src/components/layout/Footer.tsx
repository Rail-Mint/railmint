import { Circle, ExternalLink } from "lucide-react";
import { useAccount, useChainId } from "wagmi";
import { BrandMark } from "@/components/branding/BrandMark";
import { useContractStatus } from "@/hooks/useContractStatus";
import {
	CONTENT_MANAGER_ADDRESS,
	CREATOR_REGISTRY_ADDRESS,
	REWARD_DISTRIBUTOR_ADDRESS,
} from "@/lib/contracts";

const EXPLORER = "https://testnet.bscscan.com/address";

export function Footer() {
	const { isConnected } = useAccount();
	const chainId = useChainId();
	const { mode, networkLabel, isDeployed } = useContractStatus();

	const chainName = isConnected ? `Chain ${chainId}` : "Not connected";

	const contractLinks = [
		{ label: "Registry", address: CREATOR_REGISTRY_ADDRESS },
		{ label: "Content", address: CONTENT_MANAGER_ADDRESS },
		{ label: "Rewards", address: REWARD_DISTRIBUTOR_ADDRESS },
	];

	return (
		<footer className="border-t border-border/70 bg-gradient-to-b from-secondary/20 to-secondary/35">
			<div className="container flex flex-col items-center justify-between gap-4 py-8 text-center text-sm text-muted-foreground md:flex-row md:text-left">
				<BrandMark showTagline className="justify-center md:justify-start" />

				<p>RailMintAI · Built on BNB Chain</p>

				<div className="flex flex-wrap items-center justify-end gap-4 text-xs">
					{/* Wallet / chain */}
					<span className="flex items-center gap-1.5">
						<Circle
							className={`h-2 w-2 fill-current ${
								isConnected ? "text-emerald-500" : "text-muted-foreground/50"
							}`}
						/>
						{isConnected ? chainName : "Wallet disconnected"}
					</span>

					<span className="text-border">|</span>

					{/* Contract mode */}
					<span className="flex items-center gap-1.5">
						<Circle
							className={`h-2 w-2 fill-current ${
								mode === "live" ? "text-emerald-500" : "text-amber-500"
							}`}
						/>
						{networkLabel}
					</span>

					{isDeployed && (
						<span className="flex items-center gap-2">
							{contractLinks.map((c) => (
								<a
									key={c.label}
									href={`${EXPLORER}/${c.address}`}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-0.5 text-emerald-600 hover:underline dark:text-emerald-400"
								>
									{c.label} <ExternalLink className="h-2.5 w-2.5" />
								</a>
							))}
						</span>
					)}
				</div>
			</div>
		</footer>
	);
}
