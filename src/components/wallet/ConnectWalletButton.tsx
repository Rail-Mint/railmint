import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ChevronDown, Copy, LogOut, Sparkles, Wallet, Zap } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useDisconnect } from 'wagmi';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatTokenBalance, normalizeTokenUnit } from '@/lib/format-number';

interface ConnectWalletButtonProps {
  className?: string;
  label?: string;
  compact?: boolean;
}

export function ConnectWalletButton({ className, label = 'Connect Wallet', compact = false }: ConnectWalletButtonProps) {
  const { toast } = useToast();
  const { disconnect } = useDisconnect();

  const copyAddress = async (address?: string) => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      toast({ title: 'Address copied', description: 'Wallet address is now on your clipboard.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Could not copy address right now.', variant: 'destructive' });
    }
  };

  return (
    <ConnectButton.Custom>
      {({ account, chain, openChainModal, openConnectModal, authenticationStatus, mounted }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected =
          ready &&
          !!account &&
          !!chain &&
          (!authenticationStatus || authenticationStatus === 'authenticated');

        if (!connected) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className={cn(
                buttonVariants({ size: compact ? 'sm' : 'lg' }),
                'rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 text-black shadow-[0_12px_30px_-18px_rgba(245,158,11,0.9)] hover:from-amber-400 hover:to-orange-400',
                className,
              )}
            >
              {label}
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className={cn(buttonVariants({ variant: 'destructive', size: compact ? 'sm' : 'default' }), 'rounded-xl', className)}
            >
              Wrong network
            </button>
          );
        }

        const nativeSymbol = normalizeTokenUnit((chain as any).nativeCurrency?.symbol ?? 'tBNB');
        const displayAddress = account.address ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}` : account.displayName;
        const displayBalance = formatTokenBalance(account.displayBalance, nativeSymbol, 4);
        const walletIdentity = account.address ? account.address.slice(-4).toUpperCase() : 'CR';

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  buttonVariants({ variant: 'outline', size: compact ? 'sm' : 'default' }),
                  'group rounded-xl border-primary/35 bg-background/80 text-foreground shadow-[0_10px_24px_-18px_rgba(245,158,11,0.8)] hover:border-primary/50 hover:bg-amber-50/60 dark:hover:bg-amber-500/10',
                  className,
                )}
              >
                <span className="inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border border-primary/30 bg-primary/10 text-[10px] font-semibold text-primary">
                  {chain.hasIcon && chain.iconUrl ? (
                    <img alt={chain.name ?? 'Chain icon'} src={chain.iconUrl} className="h-full w-full" />
                  ) : (
                    <Wallet className="h-3.5 w-3.5" />
                  )}
                </span>

                {compact ? (
                  <span className="max-w-[6.5rem] truncate text-xs font-semibold tracking-tight">{displayAddress}</span>
                ) : (
                  <span className="flex max-w-[14rem] flex-col items-start leading-tight">
                    <span className="max-w-[14rem] truncate text-sm font-semibold tracking-tight">{displayAddress}</span>
                    <span className="max-w-[14rem] truncate text-xs text-muted-foreground">{displayBalance}</span>
                  </span>
                )}

                <ChevronDown className="ml-1.5 h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={10}
              className="w-[330px] overflow-hidden rounded-2xl border border-border/70 bg-background/95 p-0 shadow-[0_22px_55px_-30px_rgba(15,23,42,0.75)] backdrop-blur-xl"
            >
              <div className="relative p-4">
                <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[radial-gradient(circle,_rgba(245,158,11,0.3),_transparent_70%)]" />
                <div className="pointer-events-none absolute -left-8 bottom-4 h-24 w-24 rounded-full bg-[radial-gradient(circle,_rgba(251,191,36,0.18),_transparent_70%)]" />

                <div className="mb-3 rounded-xl border border-primary/30 bg-gradient-to-br from-amber-50/70 via-background to-background p-3 dark:from-amber-500/10">
                  <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                    <Sparkles className="h-3 w-3" /> Wallet
                  </div>

                  <div className="mb-2 flex items-center gap-2.5">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/35 bg-gradient-to-br from-amber-200 via-amber-300 to-orange-400 text-sm font-black text-zinc-950 shadow-[0_10px_24px_-16px_rgba(245,158,11,0.8)]">
                      {walletIdentity}
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold tracking-tight text-foreground">{account.displayName}</p>
                      <p className="text-xs text-muted-foreground">{displayAddress}</p>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={openChainModal}
                      className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-primary transition-colors hover:bg-primary/15"
                    >
                      {chain.name}
                    </button>
                    <span className="inline-flex items-center gap-1 font-medium text-muted-foreground">
                      <Zap className="h-3.5 w-3.5 text-primary" />
                      {displayBalance}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => copyAddress(account.address)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-secondary/50 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </button>

                  <button
                    type="button"
                    onClick={() => disconnect()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/15"
                  >
                    <LogOut className="h-4 w-4" />
                    Disconnect
                  </button>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }}
    </ConnectButton.Custom>
  );
}
