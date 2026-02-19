// Studio page – creator dashboard
import { motion } from "framer-motion";
import { useCallback, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAccount, useConnect } from "wagmi";
import { StudioAnalytics } from "@/components/studio/StudioAnalytics";
import { StudioBotTester } from "@/components/studio/StudioBotTester";
import { StudioContent } from "@/components/studio/StudioContent";
import { StudioLayout } from "@/components/studio/StudioLayout";
import { StudioLeaderboard } from "@/components/studio/StudioLeaderboard";
import { StudioLogin } from "@/components/studio/StudioLogin";
import { StudioOnboarding } from "@/components/studio/StudioOnboarding";
import { StudioOverview } from "@/components/studio/StudioOverview";
import { StudioProfile } from "@/components/studio/StudioProfile";
import { StudioRewards } from "@/components/studio/StudioRewards";
import { StudioSecurity } from "@/components/studio/StudioSecurity";
import { StudioSettings } from "@/components/studio/StudioSettings";
import { StudioWallet } from "@/components/studio/StudioWallet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CreatorProfile } from "@/hooks/useStudioData";
import { useStudioData } from "@/hooks/useStudioData";
import { isStudioWalletBypassEnabled } from "@/lib/testing";

const TEST_WALLET_ADDRESS = "0x1111111111111111111111111111111111111111";
const TEST_PROFILE: NonNullable<CreatorProfile> = {
	id: "test-bypass-profile",
	clone_name: "Test Creator",
	x_handle: "railmint_test",
	persona_text:
		"This is a test-only profile used to bypass wallet login in Studio.",
	prompt_template: "Generate concise, helpful content in RailMint style.",
	wallet_address: TEST_WALLET_ADDRESS,
	x_verified: false,
	x_verified_at: null,
	is_active: true,
	bio: "Automation profile for Studio testing",
	tags: ["test"],
	interests: ["automation"],
	specialties: ["studio-ui"],
};

export default function Studio() {
	const { address, isConnected } = useAccount();
	const { connectAsync } = useConnect();
	const location = useLocation();
	const bypassWalletLogin = isStudioWalletBypassEnabled();
	const effectiveAddress =
		address ?? (bypassWalletLogin ? TEST_WALLET_ADDRESS : undefined);
	const hasStudioAccess = isConnected || bypassWalletLogin;

	const [connectError, setConnectError] = useState<string | null>(null);
	const [densityCompact, setDensityCompact] = useState(false);

	const {
		profile,
		setProfile,
		stats,
		recentPosts,
		setRecentPosts,
		rewardHistory,
		topOpenRows,
		openEpoch,
		loading,
		error,
		refetch,
		recentPostsLast7Days,
		totalLikes,
		averageLikes,
		bestPost,
		profileCompletion,
	} = useStudioData(address);

	const effectiveProfile = profile ?? (bypassWalletLogin ? TEST_PROFILE : null);

	const handleConnect = useCallback(
		async (connector: any) => {
			setConnectError(null);
			try {
				if (connector.type === "injected") {
					const provider = await connector.getProvider();
					if (!provider) {
						setConnectError(
							`${connector.name} is not available. Please install it.`,
						);
						return;
					}
				}
				await connectAsync({ connector });
			} catch (err) {
				const msg = err instanceof Error ? err.message : "Connection failed";
				setConnectError(msg);
			}
		},
		[connectAsync],
	);

	// Not connected — show login
	if (!hasStudioAccess) {
		return (
			<StudioLogin connectError={connectError} onConnect={handleConnect} />
		);
	}

	// Connected but no profile — show onboarding wizard
	if (!loading && !effectiveProfile && effectiveAddress) {
		return (
			<StudioLayout profileName={null}>
				<StudioOnboarding address={effectiveAddress} onComplete={refetch} />
			</StudioLayout>
		);
	}

	// Resolve active section from URL
	const segment = location.pathname.split("/")[2] || "overview";

	function renderSection() {
		if (loading) {
			return (
				<Card className="border-border/40">
					<CardContent className="py-12 text-center text-sm text-muted-foreground">
						Loading studio data...
					</CardContent>
				</Card>
			);
		}

		if (error) {
			return (
				<Card className="border-destructive/40 bg-destructive/5">
					<CardHeader>
						<CardTitle>Could not load studio data</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3 text-sm text-muted-foreground">
						<p>{error}</p>
						<Button variant="outline" onClick={() => window.location.reload()}>
							Reload
						</Button>
					</CardContent>
				</Card>
			);
		}

		if (!effectiveProfile) {
			return (
				<Card className="border-border/40">
					<CardContent className="py-12 text-center text-sm text-muted-foreground">
						No profile found.
						<Button asChild className="ml-2">
							<Link to="/onboarding">Start Onboarding</Link>
						</Button>
					</CardContent>
				</Card>
			);
		}

		switch (segment) {
			case "overview":
				return (
					<StudioOverview
						profile={effectiveProfile}
						profileCompletion={profileCompletion}
						recentPostsLast7Days={recentPostsLast7Days}
						averageLikes={averageLikes}
						openEpoch={openEpoch}
						rewardHistory={rewardHistory}
					/>
				);
			case "profile":
				return (
					<StudioProfile
						profile={effectiveProfile}
						onProfileUpdate={(updated) => setProfile(updated)}
					/>
				);
			case "content":
				return (
					<StudioContent
						profile={effectiveProfile}
						address={effectiveAddress}
						recentPosts={recentPosts}
						onPostsUpdate={setRecentPosts}
					/>
				);
			case "bot-tester":
				return (
					<StudioBotTester
						profile={effectiveProfile}
						address={effectiveAddress}
					/>
				);
			case "analytics":
				return (
					<StudioAnalytics
						totalLikes={totalLikes}
						averageLikes={averageLikes}
						bestPost={bestPost}
						stats={stats}
						recentPosts={recentPosts}
						rewardHistory={rewardHistory}
					/>
				);
			case "leaderboard":
				return <StudioLeaderboard topOpenRows={topOpenRows} />;
			case "rewards":
				return <StudioRewards rewardHistory={rewardHistory} />;
			case "wallet":
				return (
					<StudioWallet
						address={effectiveAddress}
						profile={effectiveProfile}
						stats={stats}
					/>
				);
			case "security":
				return (
					<StudioSecurity
						address={effectiveAddress}
						profile={effectiveProfile}
					/>
				);
			case "settings":
				return (
					<StudioSettings
						densityCompact={densityCompact}
						onDensityChange={setDensityCompact}
						profile={effectiveProfile}
						onProfileUpdate={refetch}
					/>
				);

			default:
				return (
					<StudioOverview
						profile={effectiveProfile}
						profileCompletion={profileCompletion}
						recentPostsLast7Days={recentPostsLast7Days}
						averageLikes={averageLikes}
						openEpoch={openEpoch}
						rewardHistory={rewardHistory}
					/>
				);
		}
	}

	return (
		<StudioLayout profileName={effectiveProfile?.clone_name}>
			<motion.div
				key={segment}
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.2 }}
			>
				{renderSection()}
			</motion.div>
		</StudioLayout>
	);
}
