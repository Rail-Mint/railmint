import { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { getExplorerUrl } from '@/lib/mock-contract';

export default function Rewards() {
  const [rewards, setRewards] = useState<any[]>([]);
  const [epochs, setEpochs] = useState<any[]>([]);
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
    setRewards(rewardsRes.data || []);
    setEpochs(epochsRes.data || []);
    setLoading(false);
  }

  const filtered = rewards.filter(r => epochFilter === 'all' || r.epoch_id === Number(epochFilter));

  if (loading) return <div className="container py-12 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Rewards History</h1>
        <Select value={epochFilter} onValueChange={setEpochFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Filter epoch" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Epochs</SelectItem>
            {epochs.map(e => (
              <SelectItem key={e.id} value={String(e.id)}>Epoch {e.id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No reward records yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Epoch</TableHead>
                  <TableHead>Rank</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead className="text-right">Likes</TableHead>
                  <TableHead className="text-right">Reward</TableHead>
                  <TableHead>Tx</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => {
                  const epoch = r.epoch as any;
                  const creator = r.creator as any;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Badge variant="outline">Epoch {r.epoch_id}</Badge>
                      </TableCell>
                      <TableCell className="font-bold">#{r.rank}</TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">{creator?.clone_name || '—'}</p>
                        <p className="text-xs text-muted-foreground">{creator?.wallet_address?.slice(0, 6)}…{creator?.wallet_address?.slice(-4)}</p>
                      </TableCell>
                      <TableCell className="text-right">{r.like_count}</TableCell>
                      <TableCell className="text-right font-medium">{Number(r.reward_amount).toFixed(4)} BNB</TableCell>
                      <TableCell>
                        {epoch?.payout_tx_hash ? (
                          <a href={getExplorerUrl(epoch.payout_tx_hash)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 text-xs">
                            View <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">Pending</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
