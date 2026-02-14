

# Ensure Web3 Features Are Fully Enabled and Integrated per PRD

## Current Web3 Status

The project has a solid Web3 foundation but several features are partially wired or broken. Here is the full audit:

### What Works
- Wallet connection via RainbowKit + Wagmi (MetaMask, Trust, Coinbase, Rainbow, Brave, WalletConnect)
- Smart contracts written in Solidity: `CreatorRegistry`, `ContentManager`, `RewardDistributor`
- Frontend hooks for all 3 contracts (`useCreatorRegistry`, `useContentManager`, `useRewardDistributor`)
- Client-side keccak256 hash verification (prompt, content, meta hashes) in PostDetail
- Hash computation in `generate-post` edge function
- Mock transaction hash generation for `commit_tx_hash` and `payout_tx_hash`
- Explorer URL linking (opBNB testnet)

### What Is Broken or Missing

---

## Gap 1: `close-epoch` queries non-existent columns

The `close-epoch` edge function selects `quality_score`, `moderation_score`, `composite_score` from `posts`, but the database has no such columns. It also inserts these into `epoch_rewards`, which also lacks them. This causes the function to fail silently or error out.

**Fix:** Rewrite `close-epoch` to rank purely by like count (matching the actual schema). Remove all references to `quality_score`, `moderation_score`, `composite_score` from both the SELECT and INSERT. The `epoch_rewards` table only has: `id, epoch_id, creator_id, rank, like_count, reward_amount`.

---

## Gap 2: Contract addresses not configured

The `.env` file has no `VITE_CREATOR_REGISTRY_ADDRESS`, `VITE_CONTENT_PUBLISHING_ADDRESS`, or `VITE_REWARD_DISTRIBUTOR_ADDRESS` set. All contract hook calls will silently fail (undefined address).

**Fix:** Since contracts are not yet deployed to testnet, add graceful fallback handling in all hooks. When the contract address is `undefined`, the hooks should return "not deployed" state instead of silently failing. Add a visible indicator in the UI (e.g., badge on Studio/Feed) showing "Contracts: Testnet" or "Contracts: Mock" so users and judges know the system works with mock tx hashes while being ready for real deployment.

---

## Gap 3: ABI stubs don't match actual Solidity contracts

The inline ABI stubs in `src/lib/contracts.ts` are minimal and don't include all functions from the actual Solidity contracts. For example:
- Missing: `updateProfile`, `deactivateCreator`, `isXHandleAvailable`, `getTotalCreators` (only partially included)
- Missing: `unlikeContent`, `deactivateContent`, `getCreatorContent`, `hasLikedContent`, `getTotalContents`
- Missing: `createEpoch`, `getEpochCreators`, `getPendingWithdrawal`, `getContractBalance`, `withdrawExcess`

The hooks reference functions like `getCreatorIdByWallet`, `getCreatorContent`, `hasLikedContent`, `getPendingWithdrawal` that are NOT in the ABI stubs.

**Fix:** Update `src/lib/contracts.ts` to include the complete ABI surface matching the actual Solidity contracts, so when contracts are deployed, everything works without code changes.

---

## Gap 4: Dual write path (Supabase + on-chain) not consistent

The Feed like flow calls both `likeContent(contentIdBigInt)` (on-chain) AND `supabase.from("likes").insert(...)` simultaneously. However:
- The `contentIdBigInt` is derived from a UUID string via `BigInt()`, which will throw since UUIDs are not valid BigInt values
- The on-chain like always fails silently (no contract deployed), but the Supabase write succeeds, masking the error
- The Onboarding page calls `registerCreator()` on-chain but also writes to Supabase independently

**Fix:**
1. Fix the `BigInt(post.id)` conversion in Feed.tsx -- UUID cannot be BigInt. Use a sequential numeric content ID from the database or skip on-chain call when contracts are not deployed.
2. Make the dual-write explicit: Supabase is the primary data store, on-chain is secondary/optional. Add a helper `isContractDeployed()` check that guards all write calls.
3. Add a `useContractStatus()` hook that checks if contract addresses are configured and returns a status flag.

---

## Gap 5: On-chain registration in Onboarding skips when contract is not deployed

The Onboarding page calls `registerCreator(xHandle, profileHash)` but if the contract isn't deployed, the transaction just fails silently. The user gets saved to Supabase but the on-chain step is skipped without feedback.

**Fix:** Show a clear "On-chain registration" step status in the onboarding success screen. If contracts are deployed, show the tx hash and explorer link. If not, show "On-chain registration will be available when contracts are deployed to opBNB testnet" with a mock tx hash for demo purposes.

---

## Gap 6: Reward claim button has no guard

The Rewards page has `useClaimReward` and `useGetPendingRewards` hooks that call the RewardDistributor contract. Without a deployed contract, these return undefined/error. The claim button should be disabled with explanation when contracts are not live.

**Fix:** Add contract deployment status check to the claim button. Show "Claim (testnet)" when contracts are deployed, or "Claim (mock)" with a simulated success flow for demo/hackathon purposes.

---

## Gap 7: WalletConnect projectId is a placeholder

The wagmi config uses `projectId: "railmindai-demo"` which causes WalletConnect to fail with console errors.

**Fix:** Either get a real WalletConnect Cloud project ID or suppress the error more gracefully by filtering WalletConnect from connectors when no valid projectId is available.

---

## Implementation Plan

### Task 1: Fix `close-epoch` edge function
Remove non-existent column references. Rank by like count only. Insert only columns that exist in `epoch_rewards`.

### Task 2: Complete ABI stubs in `contracts.ts`
Add all functions from the 3 Solidity contracts to the inline ABI stubs so hooks can call them when contracts are deployed.

### Task 3: Add `useContractStatus` utility hook
A simple hook that checks if `VITE_CREATOR_REGISTRY_ADDRESS`, `VITE_CONTENT_PUBLISHING_ADDRESS`, `VITE_REWARD_DISTRIBUTOR_ADDRESS` are set, and returns `{ isDeployed: boolean, mode: 'live' | 'mock' }`.

### Task 4: Fix Feed like flow
- Replace `BigInt(post.id)` with a safe conversion or skip on-chain when contracts are not deployed
- Guard all on-chain write calls with `isDeployed` check
- Keep Supabase as primary data store

### Task 5: Add contract status indicators to UI
- Add a small badge/pill in the Navbar or footer: "opBNB Testnet" / "Mock Mode"
- In PostDetail, show whether the `commit_tx_hash` is a real or mock transaction
- In Rewards page, indicate "Mock Payouts" vs "Live Payouts"

### Task 6: Fix WalletConnect projectId
Handle the placeholder gracefully -- either remove WalletConnect from connectors or add error suppression.

### Task 7: Ensure on-chain registration feedback in Onboarding
Show clear status for the blockchain registration step with appropriate messaging for deployed vs mock mode.

### Technical Details

**Files to modify:**
- `supabase/functions/close-epoch/index.ts` -- remove non-existent column references
- `src/lib/contracts.ts` -- complete ABI stubs
- `src/hooks/useContractStatus.ts` -- new file, contract deployment check
- `src/pages/Feed.tsx` -- fix BigInt conversion, add deployment guard
- `src/pages/Rewards.tsx` -- add claim button guard
- `src/pages/PostDetail.tsx` -- indicate mock vs real tx
- `src/components/layout/Navbar.tsx` -- add network/mode indicator
- `src/lib/wagmi.ts` -- handle WalletConnect projectId gracefully

