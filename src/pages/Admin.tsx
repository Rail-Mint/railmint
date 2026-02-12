import {
	DollarSign,
	Loader2,
	Play,
	RefreshCw,
	ShieldAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { InlineLoader } from "@/components/ui/page-loader";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatFixed } from "@/lib/format-number";

export default function Admin() {
	const { address, isConnected } = useAccount();
	const { toast } = useToast();
	const [epochs, setEpochs] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [actionLoading, setActionLoading] = useState<string | null>(null);

	useEffect(() => {
		loadEpochs();
	}, []);

	async function loadEpochs() {
		setLoading(true);
		const { data } = await supabase
			.from("epochs")
			.select("*")
			.order("id", { ascending: false });
		setEpochs(data || []);
		setLoading(false);
	}

	async function closeEpoch(epochId: number) {
		setActionLoading(`close-${epochId}`);
		try {
			const { error } = await supabase.functions.invoke("close-epoch", {
				body: { epoch_id: epochId, wallet_address: address },
			});
			if (error) throw error;
			toast({
				title: "Epoch closed",
				description: `Epoch ${epochId} has been closed and rankings computed.`,
			});
			await loadEpochs();
		} catch (err: any) {
			toast({
				title: "Error",
				description: err.message,
				variant: "destructive",
			});
		} finally {
			setActionLoading(null);
		}
	}

	async function triggerPayout(epochId: number) {
		setActionLoading(`payout-${epochId}`);
		try {
			const { error } = await supabase.functions.invoke("trigger-payout", {
				body: { epoch_id: epochId, wallet_address: address },
			});
			if (error) throw error;
			toast({
				title: "Payout triggered",
				description: `Epoch ${epochId} rewards have been distributed (mocked).`,
			});
			await loadEpochs();
		} catch (err: any) {
			toast({
				title: "Error",
				description: err.message,
				variant: "destructive",
			});
		} finally {
			setActionLoading(null);
		}
	}

	async function generateContent() {
		setActionLoading("generate");
		try {
			const { error } = await supabase.functions.invoke("generate-post", {
				body: { wallet_address: address },
			});
			if (error) throw error;
			toast({
				title: "Content generated",
				description: "New post has been created.",
			});
		} catch (err: any) {
			toast({
				title: "Error",
				description: err.message,
				variant: "destructive",
			});
		} finally {
			setActionLoading(null);
		}
	}

	if (!isConnected) {
		return (
			<div className="container px-4 py-14 text-center sm:py-20">
				<ShieldAlert className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
				<h1 className="mb-4 text-2xl font-bold sm:text-3xl">Admin Panel</h1>
				<p className="text-muted-foreground mb-8">
					Connect your wallet to access admin functions.
				</p>
				<ConnectWalletButton />
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-2xl px-4 py-6 sm:py-8">
			<div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
				<h1 className="text-2xl font-bold">Admin Panel</h1>
				<Button
					variant="outline"
					size="sm"
					className="w-full sm:w-auto"
					onClick={loadEpochs}
				>
					<RefreshCw className="h-4 w-4 mr-1" /> Refresh
				</Button>
			</div>

			{/* Quick actions */}
			<Card className="mb-6">
				<CardHeader>
					<CardTitle className="text-lg">Quick Actions</CardTitle>
				</CardHeader>
				<CardContent className="flex gap-2 flex-wrap">
					<Button
						className="w-full sm:w-auto"
						onClick={generateContent}
						disabled={actionLoading === "generate"}
					>
						{actionLoading === "generate" ? (
							<Loader2 className="h-4 w-4 mr-1 animate-spin" />
						) : (
							<Play className="h-4 w-4 mr-1" />
						)}
						Generate Content
					</Button>
				</CardContent>
			</Card>

			{/* Epochs */}
			<h2 className="font-semibold mb-4">Epochs</h2>
			{loading ? (
				<InlineLoader label="Loading epochs..." />
			) : epochs.length === 0 ? (
				<Card>
					<CardContent className="py-8 text-center text-muted-foreground">
						No epochs found.
					</CardContent>
				</Card>
			) : (
				<div className="space-y-3">
					{epochs.map((epoch) => (
						<Card key={epoch.id}>
							<CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<div className="flex items-center gap-2 mb-1">
										<span className="font-semibold">Epoch {epoch.id}</span>
										<Badge
											variant={
												epoch.status === "open"
													? "default"
													: epoch.status === "closed"
														? "secondary"
														: "outline"
											}
										>
											{epoch.status}
										</Badge>
									</div>
									<p className="text-xs text-muted-foreground">
										Pool: {formatFixed(epoch.reward_pool, 2)} tBNB
									</p>
								</div>
								<div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2">
									{epoch.status === "open" && (
										<Button
											className="w-full"
											size="sm"
											variant="outline"
											onClick={() => closeEpoch(epoch.id)}
											disabled={actionLoading === `close-${epoch.id}`}
										>
											{actionLoading === `close-${epoch.id}` ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : (
												"Close"
											)}
										</Button>
									)}
									{epoch.status === "closed" && (
										<Button
											className="w-full"
											size="sm"
											onClick={() => triggerPayout(epoch.id)}
											disabled={actionLoading === `payout-${epoch.id}`}
										>
											{actionLoading === `payout-${epoch.id}` ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : (
												<>
													<DollarSign className="h-4 w-4 mr-1" /> Payout
												</>
											)}
										</Button>
									)}
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
