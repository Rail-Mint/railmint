import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock3, Medal, Sparkles, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageLoader } from '@/components/ui/page-loader';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { formatFixed } from '@/lib/format-number';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface RankedCreator {
  creator_id: string;
  clone_name: string;
  wallet_address: string;
  like_count: number;
}

interface Epoch {
  id: number;
  status: 'open' | 'closed' | 'paid' | string;
  reward_pool: number | string;
  end_at: string;
}

interface PostRow {
  id: string;
  creator_id: string;
  creator: {
    clone_name: string;
    wallet_address: string;
  } | null;
}

interface LikeRow {
  post_id: string;
}

const revealUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.06,
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

function shortAddress(address: string) {
  if (!address) return '-';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function Leaderboard() {
  const [epochs, setEpochs] = useState<Epoch[]>([]);
  const [selectedEpoch, setSelectedEpoch] = useState<string>('');
  const [rankings, setRankings] = useState<RankedCreator[]>([]);
  const [currentEpoch, setCurrentEpoch] = useState<Epoch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEpochs();
  }, []);

  useEffect(() => {
    if (selectedEpoch) loadRankings(Number(selectedEpoch));
  }, [selectedEpoch]);

  async function loadEpochs() {
    const { data } = await supabase.from('epochs').select('*').order('id', { ascending: false });
    const ep = (data ?? []) as Epoch[];
    setEpochs(ep);
    if (ep.length > 0) {
      setSelectedEpoch(String(ep[0].id));
      setCurrentEpoch(ep[0]);
    }
    setLoading(false);
  }

  async function loadRankings(epochId: number) {
    const epoch = epochs.find(e => e.id === epochId);
    setCurrentEpoch(epoch);

    // Get posts for this epoch with creators
    const { data: posts } = await supabase
      .from('posts')
      .select('id, creator_id, creator:creators(clone_name, wallet_address)')
      .eq('epoch_id', epochId);

    const postsArr = (posts ?? []) as PostRow[];
    if (postsArr.length === 0) {
      setRankings([]);
      return;
    }

    const postIds = postsArr.map((p) => p.id);
    const { data: likes } = await supabase.from('likes').select('post_id').in('post_id', postIds);
    const likesArr = (likes ?? []) as LikeRow[];

    const postLikeCount = likesArr.reduce<Record<string, number>>((acc, item) => {
      acc[item.post_id] = (acc[item.post_id] ?? 0) + 1;
      return acc;
    }, {});

    // Aggregate likes per creator
    const creatorLikes: Record<string, { clone_name: string; wallet_address: string; count: number }> = {};
    for (const p of postsArr) {
      const cr = p.creator;
      if (!cr) continue;
      const key = p.creator_id;
      if (!creatorLikes[key]) {
        creatorLikes[key] = { clone_name: cr.clone_name, wallet_address: cr.wallet_address, count: 0 };
      }
      creatorLikes[key].count += postLikeCount[p.id] ?? 0;
    }

    const ranked = Object.entries(creatorLikes)
      .map(([creator_id, v]) => ({ creator_id, clone_name: v.clone_name, wallet_address: v.wallet_address, like_count: v.count }))
      .sort((a, b) => b.like_count - a.like_count);

    setRankings(ranked);
  }

  const rankIcon = (i: number) => {
    if (i === 0) return <Trophy className="h-5 w-5 text-amber-500" />;
    if (i === 1) return <Medal className="h-5 w-5 text-zinc-500" />;
    if (i === 2) return <Medal className="h-5 w-5 text-orange-400" />;
    return <span className="w-5 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>;
  };

  if (loading) return <PageLoader message="Calculating this epoch rankings..." />;

  return (
    <div className="container py-8 md:py-10">
      <section className="relative mb-8 overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-background/95 via-background/88 to-amber-50/40 p-6 shadow-[0_18px_70px_-34px_rgba(245,158,11,0.55)] md:p-8">
        <div className="pointer-events-none absolute right-[-5rem] top-[-4rem] h-56 w-56 rounded-full bg-[radial-gradient(circle,_rgba(245,158,11,0.25),_transparent_70%)] blur-2xl" />
        <div className="pointer-events-none absolute left-[-3rem] top-16 h-36 w-36 rounded-full bg-[radial-gradient(circle,_rgba(251,191,36,0.16),_transparent_72%)] blur-xl" />

        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Community Ranking
            </p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Leaderboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
              Live ranking by epoch likes. Top creators move into payout slots once the epoch closes.
            </p>
          </div>

          {epochs.length > 0 && (
            <Select value={selectedEpoch} onValueChange={setSelectedEpoch}>
              <SelectTrigger className="h-10 w-[160px] border-primary/25 bg-background/80">
                <SelectValue placeholder="Choose epoch" />
              </SelectTrigger>
              <SelectContent>
                {epochs.map((epoch) => (
                  <SelectItem key={epoch.id} value={String(epoch.id)}>
                    Epoch {epoch.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </section>

      {currentEpoch && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Card className="border-border/70 bg-background/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Epoch Status</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Badge variant={currentEpoch.status === 'open' ? 'default' : 'secondary'} className="capitalize">
                {currentEpoch.status}
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Reward Pool</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-2xl font-semibold tracking-tight">{formatFixed(currentEpoch.reward_pool, 2)} tBNB</p>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/70 sm:col-span-2 lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Epoch Window</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {currentEpoch.status === 'open' ? (
                <p className="flex items-center gap-2 text-sm text-foreground">
                  <Clock3 className="h-4 w-4 text-primary" />
                  Ends {formatDistanceToNow(new Date(currentEpoch.end_at), { addSuffix: true })}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Epoch closed. Rewards are finalized during payout.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {rankings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 py-16 text-center">
          <p className="mb-4 text-muted-foreground">No rankings yet for this epoch. Create posts and collect likes to start climbing.</p>
          <Button asChild variant="outline" className="border-primary/35">
            <Link to="/feed">Explore feed</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rankings.map((ranking, i) => (
            <motion.div key={ranking.creator_id} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={revealUp}>
              <Card className="border-border/70 bg-background/75 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_18px_40px_-22px_rgba(245,158,11,0.6)]">
                <CardContent className="flex items-center gap-4 py-3.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">{rankIcon(i)}</div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold tracking-tight">{ranking.clone_name}</p>
                    <p className="text-xs text-muted-foreground">{shortAddress(ranking.wallet_address)}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-xl font-semibold leading-none tracking-tight">{ranking.like_count}</p>
                    <p className="text-xs text-muted-foreground">likes</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
