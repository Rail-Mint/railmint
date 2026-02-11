import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ShieldAlert, Play, DollarSign, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function Admin() {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [epochs, setEpochs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadEpochs();
  }, []);

  async function loadEpochs() {
    setLoading(true);
    const { data } = await supabase.from('epochs').select('*').order('id', { ascending: false });
    setEpochs(data || []);
    setLoading(false);
  }

  async function closeEpoch(epochId: number) {
    setActionLoading(`close-${epochId}`);
    try {
      const { error } = await supabase.functions.invoke('close-epoch', {
        body: { epoch_id: epochId, wallet_address: address },
      });
      if (error) throw error;
      toast({ title: 'Epoch closed', description: `Epoch ${epochId} has been closed and rankings computed.` });
      await loadEpochs();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  }

  async function triggerPayout(epochId: number) {
    setActionLoading(`payout-${epochId}`);
    try {
      const { error } = await supabase.functions.invoke('trigger-payout', {
        body: { epoch_id: epochId, wallet_address: address },
      });
      if (error) throw error;
      toast({ title: 'Payout triggered', description: `Epoch ${epochId} rewards have been distributed (mocked).` });
      await loadEpochs();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  }

  async function generateContent() {
    setActionLoading('generate');
    try {
      const { error } = await supabase.functions.invoke('generate-post', {
        body: { wallet_address: address },
      });
      if (error) throw error;
      toast({ title: 'Content generated', description: 'New post has been created.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  }

  if (!isConnected) {
    return (
      <div className="container py-20 text-center">
        <ShieldAlert className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
        <h1 className="text-3xl font-bold mb-4">Admin Panel</h1>
        <p className="text-muted-foreground mb-8">Connect your wallet to access admin functions.</p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <Button variant="outline" size="sm" onClick={loadEpochs}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Quick actions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2 flex-wrap">
          <Button onClick={generateContent} disabled={actionLoading === 'generate'}>
            {actionLoading === 'generate' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
            Generate Content
          </Button>
        </CardContent>
      </Card>

      {/* Epochs */}
      <h2 className="font-semibold mb-4">Epochs</h2>
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : epochs.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No epochs found.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {epochs.map(epoch => (
            <Card key={epoch.id}>
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">Epoch {epoch.id}</span>
                    <Badge variant={epoch.status === 'open' ? 'default' : epoch.status === 'closed' ? 'secondary' : 'outline'}>
                      {epoch.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Pool: {Number(epoch.reward_pool).toFixed(2)} BNB</p>
                </div>
                <div className="flex gap-2">
                  {epoch.status === 'open' && (
                    <Button size="sm" variant="outline" onClick={() => closeEpoch(epoch.id)} disabled={actionLoading === `close-${epoch.id}`}>
                      {actionLoading === `close-${epoch.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Close'}
                    </Button>
                  )}
                  {epoch.status === 'closed' && (
                    <Button size="sm" onClick={() => triggerPayout(epoch.id)} disabled={actionLoading === `payout-${epoch.id}`}>
                      {actionLoading === `payout-${epoch.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <><DollarSign className="h-4 w-4 mr-1" /> Payout</>}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
