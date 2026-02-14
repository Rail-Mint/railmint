import { motion } from "framer-motion";
import { useCallback, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAccount, useConnect } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStudioData } from "@/hooks/useStudioData";
import { StudioLayout } from "@/components/studio/StudioLayout";
import { StudioLogin } from "@/components/studio/StudioLogin";
import { StudioOnboarding } from "@/components/studio/StudioOnboarding";
import { StudioOverview } from "@/components/studio/StudioOverview";
import { StudioProfile } from "@/components/studio/StudioProfile";
import { StudioContent } from "@/components/studio/StudioContent";
import { StudioAnalytics } from "@/components/studio/StudioAnalytics";
import { StudioLeaderboard } from "@/components/studio/StudioLeaderboard";
import { StudioRewards } from "@/components/studio/StudioRewards";
import { StudioWallet } from "@/components/studio/StudioWallet";
import { StudioSecurity } from "@/components/studio/StudioSecurity";
import { StudioSettings } from "@/components/studio/StudioSettings";

export default function Studio() {
  const { address, isConnected } = useAccount();
  const { connectAsync } = useConnect();
  const location = useLocation();

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

  const handleConnect = useCallback(
    async (connector: any) => {
      setConnectError(null);
      try {
        if (connector.type === "injected") {
          const provider = await connector.getProvider();
          if (!provider) {
            setConnectError(`${connector.name} is not available. Please install it.`);
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
  if (!isConnected) {
    return <StudioLogin connectError={connectError} onConnect={handleConnect} />;
  }

  // Connected but no profile — show onboarding wizard
  if (!loading && !profile && address) {
    return (
      <StudioLayout profileName={null}>
        <StudioOnboarding address={address} onComplete={refetch} />
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

    if (!profile) {
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
            profile={profile}
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
            profile={profile}
            onProfileUpdate={(updated) => setProfile(updated)}
          />
        );
      case "content":
        return (
          <StudioContent
            profile={profile}
            address={address}
            recentPosts={recentPosts}
            onPostsUpdate={setRecentPosts}
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
        return <StudioWallet address={address} profile={profile} stats={stats} />;
      case "security":
        return <StudioSecurity address={address} profile={profile} />;
      case "settings":
        return (
          <StudioSettings
            densityCompact={densityCompact}
            onDensityChange={setDensityCompact}
            profile={profile}
            onProfileUpdate={refetch}
          />
        );
      default:
        return (
          <StudioOverview
            profile={profile}
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
    <StudioLayout profileName={profile?.clone_name}>
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
