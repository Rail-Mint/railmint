# Smart Contracts Deployment Guide

## Overview

This guide covers the deployment of the AI Agent Creator Clones smart contracts to opBNB Testnet and BSC Testnet.

## Contracts

1. **CreatorRegistry** - Manages creator registration and profiles
2. **ContentManager** - Handles content publishing and voting
3. **RewardDistributor** - Manages reward distribution to creators

## Prerequisites

### 1. Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required variables:
```env
PRIVATE_KEY=your_wallet_private_key_here
OPBNB_RPC_URL=https://opbnb-testnet-rpc.bnbchain.org
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
OPBNB_SCAN_API_KEY=your_opbnb_api_key
BSC_SCAN_API_KEY=your_bscscan_api_key
```

### 2. Get Testnet Funds

#### opBNB Testnet
- Faucet: https://opbnb-testnet-bridge.bnbchain.org/deposit
- Chain ID: 5611

#### BSC Testnet
- Faucet: https://testnet.bnbchain.org/faucet-smart
- Chain ID: 97

### 3. Get API Keys

- **opBNB**: Register at https://testnet.opbnbscan.com/
- **BSC**: Register at https://testnet.bscscan.com/

## Compilation

Compile contracts:
```bash
npm run hardhat:compile
# or
npx hardhat compile
```

Expected output:
```
Compiled 6 Solidity files successfully (evm target: paris).
```

## Deployment

### Deploy to opBNB Testnet

```bash
npm run hardhat:deploy:opbnb
# or
npx hardhat run scripts/deploy.ts --network opbnbTestnet
```

### Deploy to BSC Testnet

```bash
npm run hardhat:deploy:bsc
# or
npx hardhat run scripts/deploy.ts --network bscTestnet
```

### Deployment Output

The script will output:
1. Network information
2. Deployer address
3. Contract addresses for each deployed contract
4. Verification commands

**Save the contract addresses!** You'll need them for:
- Frontend integration
- Contract verification
- `.env` configuration

## Contract Verification

After deployment, verify each contract on the block explorer:

### opBNB Testnet

```bash
npx hardhat verify --network opbnbTestnet <CONTRACT_ADDRESS> [CONSTRUCTOR_ARGS]
```

Example:
```bash
# CreatorRegistry (no constructor args)
npx hardhat verify --network opbnbTestnet 0x...CreatorRegistryAddress...

# ContentManager (requires CreatorRegistry address)
npx hardhat verify --network opbnbTestnet 0x...ContentManagerAddress... 0x...CreatorRegistryAddress...

# RewardDistributor (requires CreatorRegistry address)
npx hardhat verify --network opbnbTestnet 0x...RewardDistributorAddress... 0x...CreatorRegistryAddress...
```

### BSC Testnet

Same commands but use `--network bscTestnet`

## Update Environment Variables

After successful deployment, update `.env` with contract addresses:

```env
VITE_CREATOR_REGISTRY_ADDRESS=0x...
VITE_CONTENT_PUBLISHING_ADDRESS=0x...ContentManager...
VITE_VOTING_SYSTEM_ADDRESS=0x...ContentManager...
VITE_REWARD_DISTRIBUTOR_ADDRESS=0x...
```

**Note**: `VITE_CONTENT_PUBLISHING_ADDRESS` and `VITE_VOTING_SYSTEM_ADDRESS` both reference the same `ContentManager` contract.

## Contract Interactions

### CreatorRegistry

```typescript
// Register a new creator
await creatorRegistry.registerCreator(
  "TwitterHandle",
  ethers.utils.keccak256(ethers.utils.toUtf8Bytes("profile_data"))
);

// Get creator info
const creator = await creatorRegistry.getCreator(creatorId);
```

### ContentManager

```typescript
// Publish content
await contentManager.publishContent(
  creatorId,
  ethers.utils.keccak256(ethers.utils.toUtf8Bytes("content_hash")),
  "ipfs://QmXXX..."
);

// Vote on content
await contentManager.likeContent(contentId);
```

### RewardDistributor

```typescript
// Create reward epoch (owner only)
await rewardDistributor.createEpoch(
  startTime,
  endTime,
  { value: ethers.utils.parseEther("10") }
);

// Distribute rewards (owner only)
await rewardDistributor.distributeRewards(
  epochId,
  [creatorId1, creatorId2],
  [ethers.utils.parseEther("5"), ethers.utils.parseEther("5")]
);

// Claim reward
await rewardDistributor.claimReward(creatorId);
```

## Testing Contracts

Run tests:
```bash
npm run hardhat:test
# or
npx hardhat test
```

## Troubleshooting

### "Insufficient funds for gas"
- Ensure your wallet has testnet BNB
- Get funds from faucets listed above

### "Nonce too high"
- Reset your MetaMask account: Settings > Advanced > Clear activity tab data

### "Contract verification failed"
- Ensure you're using the correct constructor arguments
- Check that the contract is fully deployed (wait ~30 seconds)
- Verify you're using the correct network flag

### "Transaction underpriced"
- Gas price is configured in `hardhat.config.cjs`
- opBNB: 1 gwei
- BSC: 10 gwei

## Network Information

### opBNB Testnet
- **RPC**: https://opbnb-testnet-rpc.bnbchain.org
- **Chain ID**: 5611
- **Explorer**: https://testnet.opbnbscan.com
- **Gas Price**: 1 gwei

### BSC Testnet
- **RPC**: https://data-seed-prebsc-1-s1.binance.org:8545
- **Chain ID**: 97
- **Explorer**: https://testnet.bscscan.com
- **Gas Price**: 10 gwei

## Contract ABIs

ABIs are generated during compilation in `artifacts/contracts/`:
- `artifacts/contracts/CreatorRegistry.sol/CreatorRegistry.json`
- `artifacts/contracts/ContentManager.sol/ContentManager.json`
- `artifacts/contracts/RewardDistributor.sol/RewardDistributor.json`

Import in frontend:
```typescript
import CreatorRegistryABI from './artifacts/contracts/CreatorRegistry.sol/CreatorRegistry.json';
```

## Security Notes

1. **Never commit `.env` file** - It contains your private key
2. **Use testnet only** - These contracts are for testing
3. **Rotate keys** - Generate new keys for mainnet
4. **Audit before mainnet** - Get professional security audit
5. **Test thoroughly** - Test all functions on testnet first

## Next Steps

After deployment:
1. ✅ Save contract addresses
2. ✅ Verify contracts on explorer
3. ✅ Update frontend environment variables
4. ✅ Test contract interactions
5. ✅ Integrate with frontend
6. ✅ Run end-to-end tests
7. ✅ Document any issues

## Support

- **opBNB Docs**: https://docs.bnbchain.org/opbnb-docs/
- **Hardhat Docs**: https://hardhat.org/docs
- **OpenZeppelin**: https://docs.openzeppelin.com/
