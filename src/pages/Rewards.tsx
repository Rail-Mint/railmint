import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock3, ExternalLink, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getExplorerUrl } from '@/lib/mock-contract';
import { PageLoader } from '@/components/ui/page-loader';
import { formatFixed, toFiniteNumber } from '@/lib/format-number';
import { Link } from 'react-router-dom';

interface RewardEpoch {
  id: number;
  status: 'open' | 'closed' | 'paid' | string;
  payout_tx_hash: string | null;
}

interface RewardCreator {
  clone_name: string | null;
  wallet_address: string | null;
}

interface RewardRow {
  id: string;
  epoch_id: number;
  rank: number;
  like_count: number;
  reward_amount: number | string;
  creator: RewardCreator | null;
  epoch: RewardEpoch | null;
}

interface EpochFilterOption {
  id: number;
  status: 'open' | 'closed' | 'paid' | string;
}

function shortAddress(address?: string | null) {
  if (!address) return '-';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const rowReveal = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.035,
      duration: 0.35,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

export default function Rewards() {
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [epochs, setEpochs] = useState<EpochFilterOption[]>([]);
  const [epochFilter, setEpochFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [rewardsRes, epochsRes] = await Promise.all([
      supabase.from('epoch_rewards').select('*, creator:creators(clone_name, wallet_address), epoch:epochs(id, status, payout_tx_hash)').order('epoch_id', { ascending: false }),
      supabase.from('epochs').select('id, status').order('id', { ascending: false }),
    ]);
    setRewards((rewardsRes.data ?? []) as RewardRow[]);
    setEpochs((epochsRes.data ?? []) as EpochFilterOption[]);
    setLoading(false);
  }

  const filtered = rewards.filter((reward) => epochFilter === 'all' || reward.epoch_id === Number(epochFilter));
  const totalRewardBnb = filtered.reduce((sum, reward) => sum + toFiniteNumber(reward.reward_amount), 0);
  const paidRecords = filtered.filter((reward) => Boolean(reward.epoch?.payout_tx_hash)).length;
  const uniqueCreators = new Set(filtered.map((reward) => reward.creator?.wallet_address).filter(Boolean)).size;

  const paymentStatus = (status: string) => {
    if (status === 'paid') return 'default' as const;
    if (status === 'closed') return 'secondary' as const;
    return 'outline' as const;
  };

  if (loading) return <PageLoader message="Syncing rewards and payout proofs..." />;

  return (
    <div className="container py-8 md:py-10">
      <section className="relative mb-8 overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-background/95 via-background/88 to-amber-50/40 p-6 shadow-[0_18px_70px_-34px_rgba(245,158,11,0.55)] md:p-8">
        <div className="pointer-events-none absolute right-[-5rem] top-[-4rem] h-56 w-56 rounded-full bg-[radial-gradient(circle,_rgba(245,158,11,0.24),_transparent_70%)] blur-2xl" />
        <div className="pointer-events-none absolute left-[-3rem] top-16 h-36 w-36 rounded-full bg-[radial-gradient(circle,_rgba(251,191,36,0.16),_transparent_72%)] blur-xl" />

        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Reward Transparency
            </p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Rewards History</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
              Track creator rewards, payout readiness, and onchain transaction proofs for each epoch.
            </p>
          </div>

          <Select value={epochFilter} onValueChange={setEpochFilter}>
            <SelectTrigger className="h-10 w-[160px] border-primary/25 bg-background/80">
              <SelectValue placeholder="Filter epoch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Epochs</SelectItem>
              {epochs.map((epoch) => (
                <SelectItem key={epoch.id} value={String(epoch.id)}>
                  Epoch {epoch.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <Card className="border-border/70 bg-background/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Distributed Rewards</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold tracking-tight">{formatFixed(totalRewardBnb, 3)} tBNB</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-background/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Payout Proofs</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {paidRecords}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-background/70 sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rewarded Creators</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Wallet className="h-5 w-5 text-primary" />
              {uniqueCreators}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {filtered.length === 0 ? (
        <Card className="border-dashed border-border/70 bg-background/60">
          <CardContent className="py-16 text-center">
            <p className="mb-4 text-muted-foreground">No reward records yet. Winners appear here once an epoch closes and payout runs.</p>
            <Button asChild variant="outline" className="border-primary/35">
              <Link to="/leaderboard">See current leaderboard</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border-border/70 bg-background/75">
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Epoch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rank</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead className="text-right">Likes</TableHead>
                  <TableHead className="text-right">Reward</TableHead>
                  <TableHead>Proof</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((reward, idx) => (
                  <motion.tr
                    key={reward.id}
                    custom={idx}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={rowReveal}
                    className="border-b border-border/60 transition-colors hover:bg-amber-50/30 dark:hover:bg-amber-500/5"
                  >
                    <TableCell>
                      <Badge variant="outline" className="border-primary/30">Epoch {reward.epoch_id}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={paymentStatus(reward.epoch?.status ?? 'open')} className="capitalize">
                        {reward.epoch?.status ?? 'open'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">#{reward.rank}</TableCell>
                    <TableCell>
                      <p className="text-sm font-semibold tracking-tight">{reward.creator?.clone_name || 'Unknown creator'}</p>
                      <p className="text-xs text-muted-foreground">{shortAddress(reward.creator?.wallet_address)}</p>
                    </TableCell>
                    <TableCell className="text-right">{reward.like_count}</TableCell>
                    <TableCell className="text-right font-medium">{formatFixed(reward.reward_amount, 4)} tBNB</TableCell>
                    <TableCell>
                      {reward.epoch?.payout_tx_hash ? (
                        <a
                          href={getExplorerUrl(reward.epoch.payout_tx_hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          Tx Proof
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock3 className="h-3 w-3" /> Pending
                        </span>
                      )}
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
