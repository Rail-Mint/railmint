

# CreatorRail AI — Full MVP Build Plan

## Overview
A fullstack web app where creators set up AI clones that generate BNB ecosystem content, community members vote via likes, and a leaderboard tracks rankings per epoch. Smart contract integration is mocked for now with placeholder functions ready for real contract wiring later.

---

## Design & Style
- Clean modern aesthetic with light/dark toggle
- Minimal, professional UI with clear typography
- Subtle accent colors, card-based layouts
- Responsive for desktop and mobile

---

## Pages & Features

### 1. Landing Page (`/`)
- Hero section explaining CreatorRail AI concept
- CTA buttons: "Connect Wallet" and "Explore Feed"
- Stats section (total creators, posts, likes)
- How-it-works steps

### 2. Creator Onboarding (`/onboarding`)
- Wallet-gated (must connect wallet first via RainbowKit)
- Form: X handle, clone name, persona/style text, prompt template
- Preview of clone profile before saving
- Confirmation screen showing "Clone Ready" state

### 3. Content Feed (`/feed`)
- Grid/list of generated posts for current epoch
- Each post card shows: creator info, content preview, like count, proof badge, timestamp
- Sort by latest or most liked
- Like button (wallet-gated, one like per wallet per post)
- Filter by epoch

### 4. Post Detail (`/post/:id`)
- Full post content with creator info
- Like button
- **Proof Verification Panel**: shows promptHash, contentHash, metaHash
- Client-side hash recomputation and comparison with stored values
- Tx hash link (placeholder for now, will link to explorer when contract is live)
- Share-to-X button via intent URL

### 5. Leaderboard (`/leaderboard`)
- Current epoch rankings by like count
- Creator name, rank indicator, like count, avatar
- Epoch selector to view past epochs
- Epoch status banner with countdown and pool size

### 6. Rewards History (`/rewards`)
- Table of past epoch payouts
- Columns: epoch, rank, creator, likes, reward amount, tx hash
- Filters by epoch and pagination
- Tx hash links (placeholder for now)

### 7. Admin Panel (`/admin`)
- Protected by admin role check
- Close current epoch button
- Trigger payout button (mocked for now)
- View active/past epochs
- Monitor generation job status

---

## Backend (Lovable Cloud / Supabase)

### Database Tables
- **creators** — wallet_address, x_handle, clone_name, persona_text, prompt_template
- **posts** — creator_id, epoch_id, prompt_text, content_text, prompt_hash, content_hash, meta_hash, commit_tx_hash, is_fallback
- **likes** — post_id, wallet_address (unique constraint on pair)
- **epochs** — start_at, end_at, status (open/closed/paid), reward_pool, payout_tx_hash
- **epoch_rewards** — epoch_id, creator_id, rank, like_count, reward_amount
- **user_roles** — user_id, role (admin/user)

### Edge Functions
1. **creator-register** — Save/update creator clone profile
2. **generate-post** — Build prompt from clone profile → call Lovable AI → compute hashes → store post
3. **like-post** — Validate unique wallet+post, insert like
4. **leaderboard** — Aggregate likes per creator for an epoch
5. **close-epoch** — Mark epoch closed, compute rankings, create reward records
6. **trigger-payout** — Mock payout (store placeholder tx hash), mark epoch paid
7. **verify-proof** — Return post proof data for client-side verification

### AI Content Generation
- Uses Lovable AI (Gemini model) via edge function
- Prompt built from creator persona + template + BNB topic seed
- Deterministic fallback template if AI fails (flagged as fallback_generated)
- Output: 150-300 word content about BNB ecosystem

---

## Wallet Integration
- RainbowKit + Wagmi for wallet connection
- Wallet address used as user identity
- Protected actions: like, create clone, admin actions
- opBNB testnet chain configuration ready

## Smart Contract (Mocked)
- Hash computation (keccak256) implemented client-side for verification
- Proof commit and payout functions return mock tx hashes
- Contract interaction code structured so real contract can be wired in later

---

## Authentication & Security
- Wallet-based auth (no email/password)
- Admin role stored in user_roles table with RLS
- One-like-per-wallet enforced by DB unique constraint
- Rate limiting on generation and like endpoints
- Input validation with Zod on all forms and API inputs

---

## Seed Data
- 8-10 pre-generated posts with computed hashes
- 5 sample creator profiles
- 1 completed epoch with reward records
- Sample likes distributed across posts

