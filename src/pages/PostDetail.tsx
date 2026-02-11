import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Heart, Shield, ExternalLink, Copy, CheckCircle2, Share2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { computePromptHash, computeContentHash, computeMetaHash, getExplorerUrl } from '@/lib/mock-contract';
import { PageLoader } from '@/components/ui/page-loader';

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const { address } = useAccount();
  const { toast } = useToast();
  const [post, setPost] = useState<any>(null);
  const [creator, setCreator] = useState<any>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verification, setVerification] = useState<{
    promptMatch: boolean | null;
    contentMatch: boolean | null;
    metaMatch: boolean | null;
  }>({ promptMatch: null, contentMatch: null, metaMatch: null });

  useEffect(() => {
    if (id) loadPost();
  }, [id, address]);

  async function loadPost() {
    setLoading(true);
    const { data: postData } = await supabase.from('posts').select('*, creator:creators(*)').eq('id', id).single();
    if (!postData) { setLoading(false); return; }

    setPost(postData);
    setCreator(postData.creator);

    const { count } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', id);
    setLikeCount(count || 0);

    if (address) {
      const { data: likeData } = await supabase.from('likes').select('id').eq('post_id', id).eq('wallet_address', address).maybeSingle();
      setLiked(!!likeData);
    }

    // Verify hashes
    const cr = postData.creator as any;
    if (cr) {
      const recomputedPrompt = computePromptHash(postData.id, cr.id, postData.prompt_text);
      const recomputedContent = computeContentHash(postData.id, postData.content_text);
      const recomputedMeta = computeMetaHash('gemini-3-flash-preview', postData.created_at, cr.wallet_address);
      setVerification({
        promptMatch: recomputedPrompt === postData.prompt_hash,
        contentMatch: recomputedContent === postData.content_hash,
        metaMatch: recomputedMeta === postData.meta_hash,
      });
    }
    setLoading(false);
  }

  async function toggleLike() {
    if (!address) {
      toast({ title: 'Connect wallet to like', variant: 'destructive' });
      return;
    }
    if (liked) {
      await supabase.from('likes').delete().eq('post_id', id).eq('wallet_address', address);
      setLiked(false);
      setLikeCount(c => c - 1);
    } else {
      const { error } = await supabase.from('likes').insert({ post_id: id, wallet_address: address });
      if (error) return;
      setLiked(true);
      setLikeCount(c => c + 1);
    }
  }

  function shareToX() {
    const text = `Check out this AI-generated BNB content on CreatorRail AI! 🚀`;
    const url = window.location.href;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
  }

  if (loading) return <PageLoader message="Verifying post proofs and metadata..." className="py-12" />;
  if (!post) return <div className="container py-12 text-center text-muted-foreground">Post not found.</div>;

  const HashRow = ({ label, hash, match }: { label: string; hash: string; match: boolean | null }) => (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">{label}</p>
        {match !== null && (
          match ? <CheckCircle2 className="h-4 w-4 text-success" /> : <span className="text-xs text-destructive">Mismatch</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <code className="text-xs bg-secondary p-1.5 rounded flex-1 break-all">{hash}</code>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(hash); toast({ title: 'Copied!' }); }}>
          <Copy className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="container py-8 max-w-3xl mx-auto">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/feed"><ArrowLeft className="h-4 w-4 mr-1" /> Back to Feed</Link>
      </Button>

      {/* Post content */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{creator?.clone_name}</CardTitle>
              <p className="text-sm text-muted-foreground">{creator?.x_handle}</p>
            </div>
            <div className="flex items-center gap-2">
              {post.commit_tx_hash && (
                <Badge variant="outline" className="gap-1"><Shield className="h-3 w-3" /> Verified</Badge>
              )}
              {post.is_fallback && <Badge variant="secondary">Fallback</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-foreground whitespace-pre-wrap mb-6">{post.content_text}</p>
          <div className="flex items-center gap-4">
            <Button variant={liked ? 'default' : 'outline'} size="sm" onClick={toggleLike}>
              <Heart className={`h-4 w-4 mr-1 ${liked ? 'fill-current' : ''}`} />
              {likeCount} {likeCount === 1 ? 'Like' : 'Likes'}
            </Button>
            <Button variant="outline" size="sm" onClick={shareToX}>
              <Share2 className="h-4 w-4 mr-1" /> Share to X
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Proof Verification Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Proof Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <HashRow label="Prompt Hash" hash={post.prompt_hash} match={verification.promptMatch} />
          <HashRow label="Content Hash" hash={post.content_hash} match={verification.contentMatch} />
          <HashRow label="Meta Hash" hash={post.meta_hash} match={verification.metaMatch} />
          {post.commit_tx_hash ? (
            <div className="space-y-1">
              <p className="text-sm font-medium">Transaction</p>
              <a href={getExplorerUrl(post.commit_tx_hash)} target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1 hover:underline">
                {post.commit_tx_hash.slice(0, 20)}…{post.commit_tx_hash.slice(-8)}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No onchain commit yet (mocked).</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
