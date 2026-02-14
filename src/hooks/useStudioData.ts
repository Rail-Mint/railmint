import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CreatorProfile = {
  id: string;
  clone_name: string;
  x_handle: string | null;
  persona_text: string;
  prompt_template: string;
  wallet_address: string;
  x_verified: boolean;
  x_verified_at: string | null;
} | null;

export type PostPreview = {
  id: string;
  content_text: string;
  created_at: string;
  epoch_id: number;
  commit_tx_hash: string | null;
  like_count: number;
};

export type RewardRow = {
  id: string;
  epoch_id: number;
  rank: number;
  like_count: number;
  reward_amount: number | string;
  epoch?: {
    id: number;
    status: string;
    end_at: string;
    reward_pool: number;
    payout_tx_hash: string | null;
  } | null;
  creator?: {
    clone_name: string;
    wallet_address: string;
  } | null;
};

export type EpochInfo = {
  id: number;
  status: string;
  end_at: string;
  reward_pool: number;
  payout_tx_hash: string | null;
} | null;

export type StudioStats = {
  postsCount: number;
  rewardRows: number;
};

export function useStudioData(address: string | undefined) {
  const [profile, setProfile] = useState<CreatorProfile>(null);
  const [stats, setStats] = useState<StudioStats>({ postsCount: 0, rewardRows: 0 });
  const [recentPosts, setRecentPosts] = useState<PostPreview[]>([]);
  const [rewardHistory, setRewardHistory] = useState<RewardRow[]>([]);
  const [topOpenRows, setTopOpenRows] = useState<RewardRow[]>([]);
  const [openEpoch, setOpenEpoch] = useState<EpochInfo>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!address) {
      setProfile(null);
      setStats({ postsCount: 0, rewardRows: 0 });
      setRecentPosts([]);
      setRewardHistory([]);
      setTopOpenRows([]);
      setOpenEpoch(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [creatorResult, openEpochResult] = await Promise.all([
        supabase
          .from("creators")
          .select("id, clone_name, x_handle, persona_text, prompt_template, wallet_address")
          .ilike("wallet_address", address)
          .maybeSingle(),
        supabase
          .from("epochs")
          .select("id, status, end_at, reward_pool, payout_tx_hash")
          .eq("status", "open")
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const creator = creatorResult.data;
      // Manually add x_verified fields since types haven't regenerated yet
      const creatorWithVerification = creator
        ? {
            ...creator,
            x_verified: (creator as any).x_verified ?? false,
            x_verified_at: (creator as any).x_verified_at ?? null,
          }
        : null;
      setProfile(creatorWithVerification);
      setOpenEpoch(openEpochResult.data ?? null);

      if (!creator?.id) {
        setStats({ postsCount: 0, rewardRows: 0 });
        setRecentPosts([]);
        setRewardHistory([]);
        setTopOpenRows([]);
        setLoading(false);
        return;
      }

      const [postCountResult, rewardCountResult, postsResult, rewardsResult] =
        await Promise.all([
          supabase
            .from("posts")
            .select("id", { count: "exact", head: true })
            .eq("creator_id", creator.id),
          supabase
            .from("epoch_rewards")
            .select("id", { count: "exact", head: true })
            .eq("creator_id", creator.id),
          supabase
            .from("posts")
            .select("id, content_text, created_at, epoch_id, commit_tx_hash")
            .eq("creator_id", creator.id)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("epoch_rewards")
            .select(
              "id, epoch_id, rank, like_count, reward_amount, epoch:epochs(id, status, end_at, reward_pool, payout_tx_hash)",
            )
            .eq("creator_id", creator.id)
            .order("epoch_id", { ascending: false })
            .limit(16),
        ]);

      const rawPosts = (postsResult.data as Omit<PostPreview, "like_count">[] | null) ?? [];
      const likesResult = rawPosts.length
        ? await supabase
            .from("likes")
            .select("post_id")
            .in("post_id", rawPosts.map((p) => p.id))
        : { data: [] as { post_id: string }[] };

      const likeCountMap = new Map<string, number>();
      for (const row of likesResult.data ?? []) {
        likeCountMap.set(row.post_id, (likeCountMap.get(row.post_id) ?? 0) + 1);
      }

      setRecentPosts(rawPosts.map((p) => ({ ...p, like_count: likeCountMap.get(p.id) ?? 0 })));
      setRewardHistory((rewardsResult.data as RewardRow[] | null) ?? []);
      setStats({
        postsCount: postCountResult.count ?? 0,
        rewardRows: rewardCountResult.count ?? 0,
      });

      if (openEpochResult.data?.id) {
        const openTopResult = await supabase
          .from("epoch_rewards")
          .select(
            "id, epoch_id, rank, like_count, reward_amount, creator:creators(clone_name, wallet_address)",
          )
          .eq("epoch_id", openEpochResult.data.id)
          .order("rank", { ascending: true })
          .limit(5);
        setTopOpenRows((openTopResult.data as RewardRow[] | null) ?? []);
      } else {
        setTopOpenRows([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load studio data.");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const recentPostsLast7Days = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return recentPosts.filter((p) => new Date(p.created_at).getTime() >= cutoff).length;
  }, [recentPosts]);

  const totalLikes = useMemo(
    () => recentPosts.reduce((sum, p) => sum + p.like_count, 0),
    [recentPosts],
  );

  const averageLikes = useMemo(() => {
    if (!recentPosts.length) return 0;
    return totalLikes / recentPosts.length;
  }, [recentPosts, totalLikes]);

  const bestPost = useMemo(() => {
    if (!recentPosts.length) return null;
    return [...recentPosts].sort((a, b) => b.like_count - a.like_count)[0];
  }, [recentPosts]);

  const profileCompletion = useMemo(() => {
    const checks = [
      Boolean(profile?.clone_name?.trim()),
      Boolean(profile?.x_handle?.trim()),
      Boolean(profile?.persona_text?.trim()),
      Boolean(profile?.prompt_template?.trim()),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [profile]);

  return {
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
    refetch: fetchData,
    recentPostsLast7Days,
    totalLikes,
    averageLikes,
    bestPost,
    profileCompletion,
  };
}
