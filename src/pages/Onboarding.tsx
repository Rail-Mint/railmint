import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bot, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton';

const schema = z.object({
  x_handle: z.string().min(1, 'X handle is required').regex(/^@?[\w]+$/, 'Invalid handle'),
  clone_name: z.string().min(2, 'Clone name must be at least 2 characters'),
  persona_text: z.string().min(20, 'Describe your persona in at least 20 characters'),
  prompt_template: z.string().min(10, 'Prompt template must be at least 10 characters'),
});

type FormValues = z.infer<typeof schema>;

export default function Onboarding() {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [step, setStep] = useState<'form' | 'preview' | 'done'>('form');
  const [savedData, setSavedData] = useState<FormValues | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      x_handle: '',
      clone_name: '',
      persona_text: '',
      prompt_template: 'Write a 200-word post about {{topic}} in the BNB ecosystem. Be informative and engaging.',
    },
  });

  if (!isConnected) {
    return (
      <div className="container py-20 text-center">
        <Bot className="h-16 w-16 mx-auto mb-6 text-primary" />
        <h1 className="text-3xl font-bold mb-4">Create Your AI Clone</h1>
        <p className="text-muted-foreground mb-8">Connect your wallet to get started.</p>
        <ConnectWalletButton />
      </div>
    );
  }

  const onSubmit = (data: FormValues) => {
    setSavedData(data);
    setStep('preview');
  };

  const handleSave = async () => {
    if (!savedData || !address) return;
    setLoading(true);
    try {
      const handle = savedData.x_handle.startsWith('@') ? savedData.x_handle : `@${savedData.x_handle}`;
      const { error } = await supabase.from('creators').upsert(
        {
          wallet_address: address,
          x_handle: handle,
          clone_name: savedData.clone_name,
          persona_text: savedData.persona_text,
          prompt_template: savedData.prompt_template,
        },
        { onConflict: 'wallet_address' }
      );
      if (error) throw error;
      setStep('done');
      toast({ title: 'Clone created!', description: 'Your AI clone is ready to generate content.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="container py-20 text-center">
        <CheckCircle2 className="h-16 w-16 mx-auto mb-6 text-success" />
        <h1 className="text-3xl font-bold mb-4">Clone Ready!</h1>
        <p className="text-muted-foreground mb-2">Your AI clone <strong>{savedData?.clone_name}</strong> is set up.</p>
        <p className="text-sm text-muted-foreground">Head to the feed to see generated content.</p>
      </div>
    );
  }

  if (step === 'preview' && savedData) {
    return (
      <div className="container py-12 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-6">Preview Your Clone</h1>
        <Card>
          <CardHeader>
            <CardTitle>{savedData.clone_name}</CardTitle>
            <CardDescription>{savedData.x_handle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">Persona</p>
              <p className="text-sm text-muted-foreground">{savedData.persona_text}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Prompt Template</p>
              <p className="text-sm text-muted-foreground font-mono bg-secondary p-2 rounded">{savedData.prompt_template}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('form')}>Edit</Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? 'Saving…' : 'Confirm & Save'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-12 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create Your AI Clone</h1>
      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="x_handle" render={({ field }) => (
                <FormItem>
                  <FormLabel>X Handle</FormLabel>
                  <FormControl><Input placeholder="@yourhandle" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="clone_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Clone Name</FormLabel>
                  <FormControl><Input placeholder="BNB Sage" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="persona_text" render={({ field }) => (
                <FormItem>
                  <FormLabel>Persona & Style</FormLabel>
                  <FormControl><Textarea placeholder="Describe your clone's personality, writing style, and areas of expertise…" rows={4} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="prompt_template" render={({ field }) => (
                <FormItem>
                  <FormLabel>Prompt Template</FormLabel>
                  <FormControl><Textarea placeholder="Use {{topic}} as a placeholder for the content topic" rows={3} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full">Preview Clone</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
