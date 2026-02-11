import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Heart, Shield, Clock, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface Post {
  id: string;
  content_text: string;
  prompt_hash: string;
  content_hash: string;
  commit_tx_hash: string | null;
  is_fallback: boolean;
  created_at: string;
  epoch_id: number;
  creator: { clone_name: string; wallet_address: string; x_handle: string | null };
  like_count: number;
  liked_by_me: boolean;
}

export default function Feed() {
  const { address } = useAccount();
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'latest' | 'popular'>('latest');
  const [epochs, setEpochs] = useState<{ id: number; status: string }[]>([]);
  const [epochFilter, setEpochFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [address]);

  async function loadData() {
    setLoading(true);
    const [postsRes, epochsRes] = await Promise.all([
      supabase.from('posts').select('*, creator:creators(clone_name, wallet_address, x_handle)').order('created_at', { ascending: false }),
      supabase.from('epochs').select('id, status').order('id', { ascending: false }),
    ]);

    const postsData = postsRes.data || [];
    
    // Get like counts
    const postIds = postsData.map(p => p.id);
    const likesRes = await supabase.from('likes').select('post_id, wallet_address').in('post_id', postIds);
    const likes = likesRes.data || [];

    const enriched: Post[] = postsData.map(p => ({
      id: p.id,
      content_text: p.content_text,
      prompt_hash: p.prompt_hash,
      content_hash: p.content_hash,
      commit_tx_hash: p.commit_tx_hash,
      is_fallback: p.is_fallback || false,
      created_at: p.created_at,
      epoch_id: p.epoch_id,
      creator: p.creator as any,
      like_count: likes.filter(l => l.post_id === p.id).length,
      liked_by_me: address ? likes.some(l => l.post_id === p.id && l.wallet_address === address) : false,
    }));

    setPosts(enriched);
    setEpochs(epochsRes.data || []);
    setLoading(false);
  }

  async function toggleLike(postId: string, liked: boolean) {
    if (!address) {
      toast({ title: 'Connect wallet', description: 'You need to connect your wallet to like posts.', variant: 'destructive' });
      return;
    }
    if (liked) {
      await supabase.from('likes').delete().eq('post_id', postId).eq('wallet_address', address);
    } else {
      const { error } = await supabase.from('likes').insert({ post_id: postId, wallet_address: address });
      if (error) {
        toast({ title: 'Already liked', variant: 'destructive' });
        return;
      }
    }
    setPosts(prev => prev.map(p => p.id === postId ? {
      ...p,
      liked_by_me: !liked,
      like_count: liked ? p.like_count - 1 : p.like_count + 1,
    } : p));
  }

  const filtered = posts
    .filter(p => epochFilter === 'all' || p.epoch_id === Number(epochFilter))
    .sort((a, b) => sort === 'popular' ? b.like_count - a.like_count : new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (loading) {
    return <div className="container py-12 text-center text-muted-foreground">Loading feed…</div>;
  }

  return (
    <div className="container py-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold">Content Feed</h1>
        <div className="flex gap-2">
          <Select value={epochFilter} onValueChange={setEpochFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Epoch" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Epochs</SelectItem>
              {epochs.map(e => (
                <SelectItem key={e.id} value={String(e.id)}>Epoch {e.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setSort(s => s === 'latest' ? 'popular' : 'latest')}>
            <ArrowUpDown className="h-4 w-4 mr-1" />
            {sort === 'latest' ? 'Latest' : 'Popular'}
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p>No posts yet. Create a clone and generate content!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(post => (
            <Card key={post.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{post.creator?.clone_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{post.creator?.x_handle}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {post.commit_tx_hash && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Shield className="h-3 w-3" /> Verified
                      </Badge>
                    )}
                    {post.is_fallback && (
                      <Badge variant="secondary" className="text-xs">Fallback</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm line-clamp-4">{post.content_text}</p>
              </CardContent>
              <CardFooter className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={post.liked_by_me ? 'text-destructive' : 'text-muted-foreground'}
                    onClick={() => toggleLike(post.id, post.liked_by_me)}
                  >
                    <Heart className={`h-4 w-4 mr-1 ${post.liked_by_me ? 'fill-current' : ''}`} />
                    {post.like_count}
                  </Button>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  </span>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/post/${post.id}`}>View</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
