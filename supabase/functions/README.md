# Supabase Edge Functions

This folder contains runtime edge functions and shared helpers.

## Active Runtime Functions

- `create-post`
- `toggle-like`
- `update-profile`
- `upsert-creator`
- `x-oauth-start`
- `x-verify`
- `generate-post`
- `process-mention`
- `sync-x-mentions`
- `webhook-x-mention`
- `drain-mention-queue`
- `close-epoch`
- `trigger-payout`
- `compile-contract`
- `deploy-contracts`

## Shared Helpers

- `_shared/http.ts`
- `_shared/supabase.ts`
- `_shared/signature.ts`
- `_shared/admin-auth.ts`
- `_shared/rate-limit.ts`
- `_shared/env.ts`

## Removed Unused Functions

- `add-x-monitor`
- `fetch-news-digests`
- `update-summaries`

## New Function Pattern

1. Handle preflight with `handlePreflight`.
2. Parse input with `parseJsonBody<T>`.
3. Validate early and return `errorResponse` for client errors.
4. Enforce auth (`verifyWalletSignature` and/or `requireAdmin`).
5. Use `createServiceRoleClient` for DB operations.
6. Return stable payloads with `jsonResponse`.
