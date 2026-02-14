# Smart Contracts Frontend Integration Guide

## Overview

This guide provides examples for integrating the AI Agent Creator Clones smart contracts with the React/TypeScript frontend using wagmi and viem.

## Setup

### 1. Install Dependencies

Already installed:
```json
{
  "wagmi": "^2.19.5",
  "viem": "^2.45.3",
  "@rainbow-me/rainbowkit": "^2.2.10",
  "@tanstack/react-query": "^5.90.21"
}
```

### 2. Configure Contract ABIs

Create `src/contracts/abis.ts`:

```typescript
import CreatorRegistryArtifact from '../../artifacts/contracts/CreatorRegistry.sol/CreatorRegistry.json';
import ContentManagerArtifact from '../../artifacts/contracts/ContentManager.sol/ContentManager.json';
import RewardDistributorArtifact from '../../artifacts/contracts/RewardDistributor.sol/RewardDistributor.json';

export const CreatorRegistryABI = CreatorRegistryArtifact.abi;
export const ContentManagerABI = ContentManagerArtifact.abi;
export const RewardDistributorABI = RewardDistributorArtifact.abi;
```

### 3. Configure Contract Addresses

Create `src/contracts/addresses.ts`:

```typescript
export const CONTRACTS = {
  opbnbTestnet: {
    creatorRegistry: import.meta.env.VITE_CREATOR_REGISTRY_ADDRESS as `0x${string}`,
    contentManager: import.meta.env.VITE_CONTENT_PUBLISHING_ADDRESS as `0x${string}`,
    rewardDistributor: import.meta.env.VITE_REWARD_DISTRIBUTOR_ADDRESS as `0x${string}`,
  },
  bscTestnet: {
    creatorRegistry: import.meta.env.VITE_CREATOR_REGISTRY_ADDRESS as `0x${string}`,
    contentManager: import.meta.env.VITE_CONTENT_PUBLISHING_ADDRESS as `0x${string}`,
    rewardDistributor: import.meta.env.VITE_REWARD_DISTRIBUTOR_ADDRESS as `0x${string}`,
  },
} as const;

export function getContracts(chainId: number) {
  if (chainId === 5611) return CONTRACTS.opbnbTestnet;
  if (chainId === 97) return CONTRACTS.bscTestnet;
  throw new Error(`Unsupported chain: ${chainId}`);
}
```

## Contract Interactions

### CreatorRegistry Contract

#### 1. Register Creator

```typescript
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { keccak256, toUtf8Bytes } from 'viem';
import { CreatorRegistryABI } from '@/contracts/abis';
import { getContracts } from '@/contracts/addresses';

function RegisterCreatorButton({ xHandle, profileData }: Props) {
  const { chainId } = useChainId();
  const { writeContract, data: hash } = useWriteContract();
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleRegister = async () => {
    const contracts = getContracts(chainId);
    const profileHash = keccak256(toUtf8Bytes(JSON.stringify(profileData)));

    writeContract({
      address: contracts.creatorRegistry,
      abi: CreatorRegistryABI,
      functionName: 'registerCreator',
      args: [xHandle, profileHash],
    });
  };

  return (
    <button onClick={handleRegister} disabled={isLoading}>
      {isLoading ? 'Registering...' : 'Register as Creator'}
    </button>
  );
}
```

#### 2. Get Creator Info

```typescript
import { useReadContract } from 'wagmi';

function CreatorProfile({ creatorId }: { creatorId: bigint }) {
  const { chainId } = useChainId();
  const contracts = getContracts(chainId);

  const { data: creator, isLoading } = useReadContract({
    address: contracts.creatorRegistry,
    abi: CreatorRegistryABI,
    functionName: 'getCreator',
    args: [creatorId],
  });

  if (isLoading) return <div>Loading...</div>;

  const [id, wallet, xHandle, profileHash, registeredAt, isActive] = creator || [];

  return (
    <div>
      <h3>@{xHandle}</h3>
      <p>Wallet: {wallet}</p>
      <p>Registered: {new Date(Number(registeredAt) * 1000).toLocaleDateString()}</p>
      <p>Status: {isActive ? 'Active' : 'Inactive'}</p>
    </div>
  );
}
```

#### 3. Get Creator ID by Wallet

```typescript
import { useReadContract } from 'wagmi';
import { useAccount } from 'wagmi';

function MyCreatorId() {
  const { address } = useAccount();
  const { chainId } = useChainId();
  const contracts = getContracts(chainId);

  const { data: creatorId } = useReadContract({
    address: contracts.creatorRegistry,
    abi: CreatorRegistryABI,
    functionName: 'getCreatorIdByWallet',
    args: [address],
    enabled: !!address,
  });

  return <div>Your Creator ID: {creatorId?.toString() || 'Not registered'}</div>;
}
```

### ContentManager Contract

#### 1. Publish Content

```typescript
import { useWriteContract } from 'wagmi';
import { keccak256, toUtf8Bytes } from 'viem';

function PublishContentButton({ creatorId, content, ipfsUri }: Props) {
  const { chainId } = useChainId();
  const { writeContract, data: hash } = useWriteContract();
  const { isLoading } = useWaitForTransactionReceipt({ hash });

  const handlePublish = () => {
    const contracts = getContracts(chainId);
    const contentHash = keccak256(toUtf8Bytes(content));

    writeContract({
      address: contracts.contentManager,
      abi: ContentManagerABI,
      functionName: 'publishContent',
      args: [creatorId, contentHash, ipfsUri],
    });
  };

  return (
    <button onClick={handlePublish} disabled={isLoading}>
      {isLoading ? 'Publishing...' : 'Publish Content'}
    </button>
  );
}
```

#### 2. Like Content

```typescript
function LikeButton({ contentId }: { contentId: bigint }) {
  const { chainId } = useChainId();
  const { writeContract, data: hash } = useWriteContract();
  const { isLoading } = useWaitForTransactionReceipt({ hash });

  const handleLike = () => {
    const contracts = getContracts(chainId);

    writeContract({
      address: contracts.contentManager,
      abi: ContentManagerABI,
      functionName: 'likeContent',
      args: [contentId],
    });
  };

  return (
    <button onClick={handleLike} disabled={isLoading}>
      {isLoading ? 'Liking...' : '👍 Like'}
    </button>
  );
}
```

#### 3. Get Content Info

```typescript
function ContentCard({ contentId }: { contentId: bigint }) {
  const { chainId } = useChainId();
  const contracts = getContracts(chainId);

  const { data: content } = useReadContract({
    address: contracts.contentManager,
    abi: ContentManagerABI,
    functionName: 'getContent',
    args: [contentId],
  });

  if (!content) return null;

  const [id, creatorId, contentHash, ipfsUri, likeCount, publishedAt, isActive] = content;

  return (
    <div className="content-card">
      <p>Creator ID: {creatorId.toString()}</p>
      <p>Likes: {likeCount.toString()}</p>
      <p>Published: {new Date(Number(publishedAt) * 1000).toLocaleDateString()}</p>
      <a href={ipfsUri} target="_blank" rel="noopener noreferrer">
        View on IPFS
      </a>
    </div>
  );
}
```

#### 4. Check if User Liked Content

```typescript
function LikeStatus({ contentId }: { contentId: bigint }) {
  const { address } = useAccount();
  const { chainId } = useChainId();
  const contracts = getContracts(chainId);

  const { data: hasLiked } = useReadContract({
    address: contracts.contentManager,
    abi: ContentManagerABI,
    functionName: 'hasLiked',
    args: [contentId, address],
    enabled: !!address,
  });

  return <div>{hasLiked ? '✅ You liked this' : '❌ Not liked'}</div>;
}
```

### RewardDistributor Contract

#### 1. Create Reward Epoch (Owner Only)

```typescript
function CreateEpochButton({ startTime, endTime, rewardAmount }: Props) {
  const { chainId } = useChainId();
  const { writeContract, data: hash } = useWriteContract();
  const { isLoading } = useWaitForTransactionReceipt({ hash });

  const handleCreate = () => {
    const contracts = getContracts(chainId);

    writeContract({
      address: contracts.rewardDistributor,
      abi: RewardDistributorABI,
      functionName: 'createEpoch',
      args: [BigInt(startTime), BigInt(endTime)],
      value: parseEther(rewardAmount.toString()),
    });
  };

  return (
    <button onClick={handleCreate} disabled={isLoading}>
      {isLoading ? 'Creating...' : 'Create Epoch'}
    </button>
  );
}
```

#### 2. Get Pending Rewards

```typescript
function PendingRewards({ creatorId }: { creatorId: bigint }) {
  const { chainId } = useChainId();
  const contracts = getContracts(chainId);

  const { data: amount } = useReadContract({
    address: contracts.rewardDistributor,
    abi: RewardDistributorABI,
    functionName: 'getPendingReward',
    args: [creatorId],
  });

  return (
    <div>
      Pending Rewards: {amount ? formatEther(amount) : '0'} BNB
    </div>
  );
}
```

#### 3. Claim Rewards

```typescript
function ClaimRewardsButton({ creatorId }: { creatorId: bigint }) {
  const { chainId } = useChainId();
  const { writeContract, data: hash } = useWriteContract();
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleClaim = () => {
    const contracts = getContracts(chainId);

    writeContract({
      address: contracts.rewardDistributor,
      abi: RewardDistributorABI,
      functionName: 'claimReward',
      args: [creatorId],
    });
  };

  return (
    <button onClick={handleClaim} disabled={isLoading}>
      {isLoading ? 'Claiming...' : 'Claim Rewards'}
    </button>
  );
}
```

#### 4. Get Epoch Info

```typescript
function EpochInfo({ epochId }: { epochId: bigint }) {
  const { chainId } = useChainId();
  const contracts = getContracts(chainId);

  const { data: epoch } = useReadContract({
    address: contracts.rewardDistributor,
    abi: RewardDistributorABI,
    functionName: 'getEpoch',
    args: [epochId],
  });

  if (!epoch) return null;

  const [id, startTime, endTime, totalRewards, distributedRewards, isActive] = epoch;

  return (
    <div className="epoch-card">
      <h3>Epoch #{id.toString()}</h3>
      <p>Start: {new Date(Number(startTime) * 1000).toLocaleDateString()}</p>
      <p>End: {new Date(Number(endTime) * 1000).toLocaleDateString()}</p>
      <p>Total Rewards: {formatEther(totalRewards)} BNB</p>
      <p>Distributed: {formatEther(distributedRewards)} BNB</p>
      <p>Status: {isActive ? 'Active' : 'Completed'}</p>
    </div>
  );
}
```

## Event Listening

### Listen to Contract Events

```typescript
import { useWatchContractEvent } from 'wagmi';

function CreatorRegisteredListener() {
  const { chainId } = useChainId();
  const contracts = getContracts(chainId);

  useWatchContractEvent({
    address: contracts.creatorRegistry,
    abi: CreatorRegistryABI,
    eventName: 'CreatorRegistered',
    onLogs(logs) {
      logs.forEach((log) => {
        const { creatorId, wallet, xHandle } = log.args;
        console.log(`New creator registered: @${xHandle} (ID: ${creatorId})`);
        // Update UI, show notification, etc.
      });
    },
  });

  return null;
}
```

### Listen to Multiple Events

```typescript
function ContentEventsListener() {
  const { chainId } = useChainId();
  const contracts = getContracts(chainId);

  useWatchContractEvent({
    address: contracts.contentManager,
    abi: ContentManagerABI,
    eventName: 'ContentPublished',
    onLogs(logs) {
      logs.forEach((log) => {
        const { contentId, creatorId, ipfsUri } = log.args;
        // Handle new content
      });
    },
  });

  useWatchContractEvent({
    address: contracts.contentManager,
    abi: ContentManagerABI,
    eventName: 'ContentLiked',
    onLogs(logs) {
      logs.forEach((log) => {
        const { contentId, voter } = log.args;
        // Update like count
      });
    },
  });

  return null;
}
```

## Error Handling

```typescript
function RegisterWithErrorHandling({ xHandle, profileData }: Props) {
  const [error, setError] = useState<string | null>(null);
  const { writeContract } = useWriteContract({
    mutation: {
      onError: (error) => {
        if (error.message.includes('Creator already registered')) {
          setError('You are already registered as a creator');
        } else if (error.message.includes('Invalid X handle')) {
          setError('X handle must be 1-20 characters');
        } else {
          setError('Failed to register. Please try again.');
        }
      },
      onSuccess: () => {
        setError(null);
        // Handle success
      },
    },
  });

  // ... rest of component
}
```

## Wagmi Configuration

Update `src/config/wagmi.ts`:

```typescript
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { opBNBTestnet, bscTestnet } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'AI Agent Creator Clones',
  projectId: 'YOUR_WALLETCONNECT_PROJECT_ID',
  chains: [opBNBTestnet, bscTestnet],
  ssr: false,
});
```

## Best Practices

1. **Always check transaction status** - Use `useWaitForTransactionReceipt`
2. **Handle errors gracefully** - Show user-friendly error messages
3. **Validate inputs** - Check data before sending transactions
4. **Show loading states** - Provide feedback during transactions
5. **Use React Query** - Automatically refetch data after mutations
6. **Cache contract reads** - wagmi handles this automatically
7. **Test on testnet first** - Always test thoroughly before mainnet

## Common Issues

### "User rejected transaction"
- User cancelled in wallet - this is expected behavior

### "Insufficient funds"
- User doesn't have enough BNB for gas
- Show clear error message with link to faucet

### "Execution reverted"
- Contract validation failed
- Check error message for specific reason
- Common: "Creator already registered", "Content not found", etc.

### "Wrong network"
- User connected to wrong chain
- Prompt to switch network using wagmi's `useSwitchChain`

## Testing

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { WagmiProvider } from 'wagmi';
import { config } from '@/config/wagmi';

describe('RegisterCreatorButton', () => {
  it('registers creator successfully', async () => {
    render(
      <WagmiProvider config={config}>
        <RegisterCreatorButton xHandle="testuser" profileData={{}} />
      </WagmiProvider>
    );

    const button = screen.getByText('Register as Creator');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Registering...')).toBeInTheDocument();
    });
  });
});
```

## Next Steps

1. Implement contract interactions in UI components
2. Add transaction notifications
3. Create admin dashboard for contract management
4. Add transaction history
5. Implement event listeners for real-time updates
6. Add loading and error states
7. Test all interactions on testnet
