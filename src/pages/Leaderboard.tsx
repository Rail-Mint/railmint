import { useState, useEffect } from 'react';
import { Trophy, Medal, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface RankedCreator {
  creator_id: string;
  clone_name: string;
  wallet_address: string;
  like_count: number;
}

export default function Leaderboard() {
  const [epochs, setEpochs] = useState<any[]>([]);
  const [selectedEpoch, setSelectedEpoch] = useState<string>('');
  const [rankings, setRankings] = useState<RankedCreator[]>([]);
  const [currentEpoch, setCurrentEpoch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEpochs();
  }, []);

  useEffect(() => {
    if (selectedEpoch) loadRankings(Number(selectedEpoch));
  }, [selectedEpoch]);

  async function loadEpochs() {
    const { data } = await supabase.from('epochs').select('*').order('id', { ascending: false });
    const ep = data || [];
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

    if (!posts || posts.length === 0) { setRankings([]); return; }

    const postIds = posts.map(p => p.id);
    const { data: likes } = await supabase.from('likes').select('post_id').in('post_id', postIds);
    const likesArr = likes || [];

    // Aggregate likes per creator
    const creatorLikes: Record<string, { clone_name: string; wallet_address: string; count: number }> = {};
    for (const p of posts) {
      const cr = p.creator as any;
      if (!cr) continue;
      const key = p.creator_id;
      if (!creatorLikes[key]) {
        creatorLikes[key] = { clone_name: cr.clone_name, wallet_address: cr.wallet_address, count: 0 };
      }
      creatorLikes[key].count += likesArr.filter(l => l.post_id === p.id).length;
    }

    const ranked = Object.entries(creatorLikes)
      .map(([creator_id, v]) => ({ creator_id, clone_name: v.clone_name, wallet_address: v.wallet_address, like_count: v.count }))
      .sort((a, b) => b.like_count - a.like_count);

    setRankings(ranked);
  }

  const rankIcon = (i: number) => {
    if (i === 0) return <Trophy className="h-5 w-5 text-primary" />;
    if (i === 1) return <Medal className="h-5 w-5 text-muted-foreground" />;
    if (i === 2) return <Medal className="h-5 w-5 text-muted-foreground/60" />;
    return <span className="w-5 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>;
  };

  if (loading) return <div className="container py-12 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="container py-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        {epochs.length > 0 && (
          <Select value={selectedEpoch} onValueChange={setSelectedEpoch}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {epochs.map(e => (
                <SelectItem key={e.id} value={String(e.id)}>Epoch {e.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {currentEpoch && (
        <Card className="mb-6">
          <CardContent className="pt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={currentEpoch.status === 'open' ? 'default' : 'secondary'}>{currentEpoch.status}</Badge>
              <span className="text-sm text-muted-foreground">Epoch {currentEpoch.id}</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Pool: {Number(currentEpoch.reward_pool).toFixed(2)} BNB</span>
              {currentEpoch.status === 'open' && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Ends {formatDistanceToNow(new Date(currentEpoch.end_at), { addSuffix: true })}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {rankings.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">No rankings yet for this epoch.</p>
      ) : (
        <div className="space-y-2">
          {rankings.map((r, i) => (
            <Card key={r.creator_id}>
              <CardContent className="py-3 flex items-center gap-4">
                {rankIcon(i)}
                <div className="flex-1">
                  <p className="font-semibold text-sm">{r.clone_name}</p>
                  <p className="text-xs text-muted-foreground">{r.wallet_address.slice(0, 6)}…{r.wallet_address.slice(-4)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{r.like_count}</p>
                  <p className="text-xs text-muted-foreground">likes</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
