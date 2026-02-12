import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { bscTestnet } from 'wagmi/chains';
import { defineChain } from 'viem';

export const opBNBTestnet = defineChain({
  id: 5611,
  name: 'opBNB Testnet',
  nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://opbnb-testnet-rpc.bnbchain.org'] },
  },
  blockExplorers: {
    default: { name: 'opBNBScan', url: 'https://testnet.opbnbscan.com' },
  },
  testnet: true,
});

export const config = getDefaultConfig({
  appName: 'RailMindAI',
  projectId: 'railmindai-demo', // WalletConnect project ID placeholder
  chains: [opBNBTestnet, bscTestnet],
  transports: {
    [opBNBTestnet.id]: http(),
    [bscTestnet.id]: http(),
  },
});
