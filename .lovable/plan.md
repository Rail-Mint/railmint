

# Ensure AI Agent Functionalities Work with the Current System

## Summary

After auditing every AI agent touchpoint -- content generation, hash verification, mention processing, epoch closing, and payouts -- several critical bugs prevent the system from working correctly end-to-end.

---

## Issue 1: Hash Mismatch -- `generate-post` uses escaped newlines, `mock-contract.ts` uses real newlines

**Root cause**: In `generate-post/index.ts` (lines 110-118), the keccak256 inputs use `\\n` (escaped literal backslash-n) inside template literals:
```
toBytes(`GOODVIBES_PROMPT_V1\\n${postId}\\n${creatorData.id}\\n${promptText}`)
```
But `mock-contract.ts` uses actual newline characters:
```
`GOODVIBES_PROMPT_V1\n${postId}\n${cloneId}\n${promptText}`
```

These produce different byte sequences, so the hashes stored in the database will **never match** what `PostDetail.tsx` recomputes. All three verification checks (prompt, content, meta) will show "Mismatch".

**Fix**: Change `generate-post/index.ts` to use actual newline characters (`\n`) instead of escaped `\\n`. This is a simple find-and-replace of `\\n` to `\n` in the 6 keccak256 input strings.

---

## Issue 2: Model Version Mismatch in Meta Hash Verification

**Root cause**: `generate-post` sets `modelVersion = "google/gemini-2.5-flash"` and uses it in the meta hash. But `PostDetail.tsx` (line 229) hardcodes `"gemini-3-flash-preview"` for re-verification:
```typescript
const recomputedMeta = computeMetaHash(
    "gemini-3-flash-preview",   // <-- wrong model string
    normalizedPost.created_at,
    cr.wallet_address,
);
```

These will never match because the model strings differ.

**Fix**: Either:
- (A) Store the model version in the `posts` table and read it back, OR
- (B) Use a constant that matches between backend and frontend

Option B is simpler: update `PostDetail.tsx` to use `"google/gemini-2.5-flash"` to match the edge function. Add a comment noting this must stay in sync.

---

## Issue 3: `process-mention` Uses SHA-256 Instead of keccak256

**Root cause**: The `process-mention` function (line 155-165) has its own `sha256Hex()` helper using `crypto.subtle.digest("SHA-256", ...)`. When a post is created via an X mention (`createPostFromMention`, lines 291-302), it uses SHA-256 for `promptHash`, `contentHash`, `metaHash`, and `commitTxHash`. These posts will have hash verification mismatches in PostDetail since the frontend uses keccak256.

**Fix**: Replace the `sha256Hex()` calls in `createPostFromMention` with keccak256 from `viem` (same as `generate-post`). Import `keccak256` and `toBytes` from `https://esm.sh/viem@2.21.0` and update the 4 hash computations.

---

## Issue 4: `process-mention` References Non-Existent Tables

**Root cause**: The `process-mention` function references tables `mentions`, `donations`, `donation_audit_log`, and `webhook_nonces`. None of these exist in the database (current tables: `creators`, `posts`, `likes`, `epochs`, `epoch_rewards`, `user_roles`). Any call to this function will fail with a Postgres error.

**Fix**: Create a database migration adding the required tables:
- `mentions` -- stores ingested X mentions with status tracking
- `donations` -- tracks donation transactions  
- `donation_audit_log` -- audit trail for donations
- `webhook_nonces` -- replay protection for webhook signatures

---

## Issue 5: `trigger-payout` Uses SHA-256 Instead of keccak256

**Root cause**: `trigger-payout` (lines 25-33) generates mock payout tx hashes using `crypto.subtle.digest("SHA-256", ...)`. While this doesn't affect hash verification directly (payout hashes aren't verified in PostDetail), it's inconsistent with the rest of the system which uses keccak256 for all hashes.

**Fix**: Update `trigger-payout` to use keccak256 from viem for consistency. Import and use `keccak256(toBytes(...))` like the other functions.

---

## Issue 6: `sync-x-mentions` Missing Required Secrets

**Root cause**: The `sync-x-mentions` function requires `TWEETIO_API_KEY` and `X_AGENT_USERNAME` (and optionally `UPLOAD_POST_API_KEY`, `UPLOAD_POST_USER`). None are configured. Currently only `LOVABLE_API_KEY` and `OPENROUTER_API_KEY` are available as secrets.

**Fix**: This is a post-hackathon feature. For now, add graceful handling: if `TWEETIO_API_KEY` is missing, return a clear error message explaining the X mention pipeline is not yet configured. No code change needed since it already throws `"Missing TWEETIO_API_KEY"`.

---

## Issue 7: `generate-post` Fallback Content Doesn't Match Creator Persona

**Root cause**: When AI generation fails (lines 101-104), the fallback template is a generic BNB paragraph that ignores the creator's persona entirely. This undermines the "AI clone" concept.

**Fix**: Include a persona-aware prefix in the fallback template using `creatorData.clone_name`. Minor improvement for demo quality.

---

## Technical Implementation Details

### File: `supabase/functions/generate-post/index.ts`
- Replace all `\\n` with `\n` in the 6 keccak256 input strings (lines 110-118, 122-123)
- Improve fallback content to reference creator persona

### File: `supabase/functions/process-mention/index.ts`
- Import `keccak256, toBytes` from `https://esm.sh/viem@2.21.0`
- Replace `sha256Hex()` calls in `createPostFromMention()` with keccak256
- Update hash input strings to use the same `GOODVIBES_*` prefix format as `generate-post`

### File: `supabase/functions/trigger-payout/index.ts`
- Import `keccak256, toBytes` from `https://esm.sh/viem@2.21.0`
- Replace `crypto.subtle.digest("SHA-256", ...)` with `keccak256(toBytes(...))`

### File: `src/pages/PostDetail.tsx`
- Line 229: Change `"gemini-3-flash-preview"` to `"google/gemini-2.5-flash"`

### Database Migration
Create tables needed by `process-mention`:
- `mentions` (id uuid PK, mention_id text unique, platform text, author_handle text, author_wallet text, raw_text text, parsed_intent text, status text default 'received', payload jsonb, attempts int default 0, last_attempt_at timestamptz, error_text text, processed_at timestamptz, created_at timestamptz default now())
- `donations` (id uuid PK, mention_id uuid references mentions, donor_wallet text, recipient_creator_id uuid references creators, recipient_wallet text, amount numeric, asset_symbol text, chain_id int, status text, tx_hash text, failure_reason text, created_at timestamptz default now())
- `donation_audit_log` (id uuid PK, donation_id uuid references donations, event_type text, tx_hash text, error_text text, metadata jsonb, created_at timestamptz default now())
- `webhook_nonces` (nonce text PK, expires_at timestamptz)

Enable RLS on all new tables with service-role-only policies (these are backend-only tables).

### Implementation Order

1. Fix `generate-post` escaped newlines (critical -- all verification is broken)
2. Fix `PostDetail.tsx` model version string (critical -- meta hash never matches)
3. Create missing database tables for mention pipeline
4. Fix `process-mention` to use keccak256
5. Fix `trigger-payout` to use keccak256
6. Deploy all updated edge functions
7. Test hash verification end-to-end

