import { useConnectModal } from "@rainbow-me/rainbowkit";
import { motion } from "framer-motion";
import { ArrowLeft, UserCog, WalletCards } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useConnect } from "wagmi";
import { BrandMark } from "@/components/branding/BrandMark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
	connectError: string | null;
	onConnect: (connector: any) => void;
}

function resolveWalletLogo(name: string) {
	const n = name.toLowerCase();
	if (n.includes("metamask")) return "/brand/metamask.png";
	if (n.includes("trust")) return "/brand/trust-wallet.png";
	if (n.includes("coinbase") || n.includes("base"))
		return "/brand/coinbase-wallet.png";
	if (n.includes("brave")) return "/brand/brave-wallet.png";
	return "/brand/rainbow.png";
}

export function StudioLogin({ connectError, onConnect }: Props) {
	const navigate = useNavigate();
	const { connectors, status, variables } = useConnect();
	const { openConnectModal } = useConnectModal();

	const topConnectors = useMemo(() => {
		const filtered = connectors.filter(
			(c) =>
				c.id !== "safe" &&
				!c.id.toLowerCase().includes("walletconnect") &&
				!c.id.toLowerCase().includes("injected"),
		);
		const used = new Set<string>();
		const result: typeof filtered = [];
		for (const c of filtered) {
			const key = c.name.toLowerCase();
			if (used.has(key)) continue;
			used.add(key);
			result.push(c);
			if (result.length >= 4) break;
		}
		return result;
	}, [connectors]);

	return (
		<motion.div
			initial={{ opacity: 0, y: 14 }}
			animate={{ opacity: 1, y: 0 }}
			className="grid min-h-screen place-items-center bg-background px-4 sm:px-6"
		>
			<div className="w-full max-w-4xl rounded-3xl border border-border/40 bg-card/90 p-6 shadow-xl sm:p-8">
				<div className="mb-8 flex items-center justify-between border-b border-border/30 pb-5">
					<div className="flex items-center gap-3">
						<BrandMark compact markOnly className="shrink-0" />
						<div>
							<p className="text-xs font-semibold uppercase tracking-wider text-primary">
								RailMint AI
							</p>
							<p className="text-2xl font-semibold tracking-tight">
								Creator Studio
							</p>
						</div>
					</div>
					<Button variant="outline" size="sm" onClick={() => navigate("/")}>
						<ArrowLeft className="mr-2 h-4 w-4" /> Home
					</Button>
				</div>

				<div className="grid gap-6 lg:grid-cols-2">
					<div className="space-y-4">
						<div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
							<UserCog className="h-3.5 w-3.5" /> Sign in
						</div>
						<h1 className="text-3xl font-semibold tracking-tight">
							Welcome to your Creator Workspace.
						</h1>
						<p className="text-sm text-muted-foreground">
							Connect a wallet to access your studio, manage your AI clone, and
							track rewards.
						</p>
					</div>

					<Card className="border-border/40">
						<CardHeader className="pb-3">
							<CardTitle className="flex items-center gap-2 text-base">
								<WalletCards className="h-4 w-4" /> Connect your wallet
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="grid gap-3 md:grid-cols-2">
								{topConnectors.map((c) => (
									<Button
										key={c.id}
										variant="outline"
										className="h-14 justify-start rounded-2xl border-border/40 px-4 text-base hover:border-primary/30"
										disabled={status === "pending"}
										onClick={() => onConnect(c)}
									>
										<img
											src={resolveWalletLogo(c.name)}
											alt={`${c.name} logo`}
											className="mr-3 h-7 w-7 rounded-sm object-contain"
											loading="lazy"
										/>
										<span className="truncate">{c.name}</span>
										{status === "pending" && variables?.connector === c && (
											<span className="ml-auto text-xs text-muted-foreground">
												Connecting...
											</span>
										)}
									</Button>
								))}
								<Button
									variant="outline"
									className="h-14 justify-start rounded-2xl border-border/40 px-4 text-base hover:border-primary/30"
									disabled={status === "pending" || !openConnectModal}
									onClick={() => openConnectModal?.()}
								>
									<WalletCards className="mr-3 h-5 w-5" />
									More wallets
								</Button>
							</div>
							{connectError && (
								<p className="text-sm text-destructive">{connectError}</p>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</motion.div>
	);
}
