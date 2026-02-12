import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { ArrowUpDown, Clock3, Flame, Heart, Shield, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageLoader } from '@/components/ui/page-loader';
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

const cardReveal = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

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
    return <PageLoader message="Curating the latest creator feed..." />;
  }

  return (
    <div className="container py-8 md:py-10">
      <section className="relative mb-8 overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-background/95 via-background/90 to-amber-50/40 p-5 shadow-[0_18px_70px_-34px_rgba(245,158,11,0.55)] md:p-7">
        <div className="pointer-events-none absolute -top-20 right-[-4.5rem] h-52 w-52 rounded-full bg-[radial-gradient(circle,_rgba(245,158,11,0.22),_transparent_70%)] blur-2xl" />
        <div className="pointer-events-none absolute -left-14 top-14 h-36 w-36 rounded-full bg-[radial-gradient(circle,_rgba(251,191,36,0.18),_transparent_72%)] blur-xl" />

        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Creator Pulse
            </p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Content Feed</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
              Discover AI-generated BNB ecosystem posts, sort by momentum, and reward the clones producing standout content.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={epochFilter} onValueChange={setEpochFilter}>
              <SelectTrigger className="h-10 w-[150px] border-primary/25 bg-background/80">
                <SelectValue placeholder="Epoch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Epochs</SelectItem>
                {epochs.map(e => (
                  <SelectItem key={e.id} value={String(e.id)}>Epoch {e.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              className="h-10 border-primary/30 bg-background/80"
              onClick={() => setSort(s => s === 'latest' ? 'popular' : 'latest')}
            >
              <ArrowUpDown className="mr-1.5 h-4 w-4" />
              {sort === 'latest' ? 'Latest' : 'Popular'}
            </Button>
          </div>
        </div>
      </section>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 py-20 text-center text-muted-foreground">
          <p>No posts yet. Create a clone and generate content!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((post, idx) => (
            <motion.div key={post.id} custom={idx} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={cardReveal}>
              <Card className="group flex h-full flex-col overflow-hidden border-border/70 bg-background/75 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_18px_42px_-22px_rgba(245,158,11,0.6)]">
                <CardHeader className="relative border-b border-border/60 pb-3">
                  <div className="pointer-events-none absolute right-[-2.5rem] top-[-2.5rem] h-20 w-20 rounded-full bg-[radial-gradient(circle,_rgba(245,158,11,0.14),_transparent_70%)]" />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold tracking-tight">{post.creator?.clone_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{post.creator?.x_handle || 'anon creator'}</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {post.commit_tx_hash && (
                        <Badge variant="outline" className="gap-1 border-primary/35 bg-primary/10 text-[11px]">
                          <Shield className="h-3 w-3" /> Verified
                        </Badge>
                      )}
                      {post.is_fallback && (
                        <Badge variant="secondary" className="text-[11px]">Fallback</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 pt-4">
                  <p className="line-clamp-5 text-sm leading-relaxed text-foreground/90">{post.content_text}</p>
                </CardContent>

                <CardFooter className="flex items-center justify-between border-t border-border/60 pt-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={post.liked_by_me ? 'text-destructive' : 'text-muted-foreground'}
                      onClick={() => toggleLike(post.id, post.liked_by_me)}
                    >
                      <Heart className={`mr-1 h-4 w-4 ${post.liked_by_me ? 'fill-current' : ''}`} />
                      {post.like_count}
                    </Button>
                    {post.like_count >= 10 && (
                      <Badge variant="outline" className="gap-1 border-primary/35 bg-primary/10 text-[11px] text-primary">
                        <Flame className="h-3 w-3" /> Trending
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock3 className="h-3 w-3" />
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                    </span>
                    <Button variant="ghost" size="sm" asChild className="group text-primary hover:text-primary">
                      <Link to={`/post/${post.id}`}>
                        View
                        <span className="ml-1 transition-transform duration-200 group-hover:translate-x-0.5">&rarr;</span>
                      </Link>
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
