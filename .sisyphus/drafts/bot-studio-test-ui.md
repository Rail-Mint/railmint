# Draft: Studio Bot Test UI

## Requirements (confirmed)
- Goal: Add a simple Studio UI to let users test their bot with selected personas and verify responses to prompts.
- Purpose: End-users validate outputs; developer uses it as a system testing tool.
- Placement: New Studio tab.
- Persona selection: Creator profile persona + all saved personas.
- Execution: Call existing bot endpoint.
- Access: Creator only.
- Inputs: Prompt only (minimal UI).
- Run history: None (ephemeral only).
- Response display: Rendered text only.

## Technical Decisions
- Use existing bot endpoint for prompt execution.
- Frontend must call Supabase Edge Functions via signed wallet flow (`useSignedAction` → `supabase.functions.invoke`).
- Studio routing uses `/studio/*` segments with sidebar `navItems` and `sectionTitles` mapping.

## Research Findings
- Studio routing/tab pattern:
  - Add new tab in `src/components/studio/StudioSidebar.tsx` `navItems` and `navHref`.
  - Add matching `sectionTitles` entry in `src/components/studio/StudioLayout.tsx`.
  - Add route segment handler in `src/pages/Studio.tsx` switch.
- Frontend edge-function invocation pattern:
  - `useSignedAction().invokeWithSignature(functionName, body)` builds wallet signature message `RailMintAI Action\nFunction: {name}\nWallet: {wallet}\nTimestamp: {timestamp}` then calls `supabase.functions.invoke` with `wallet_address`, `signature`, `sign_timestamp`.
- Existing bot endpoints:
  - `process-mention` (supabase/functions/process-mention): requires `mention_id` and `text` (unless `process_pending`), uses webhook HMAC unless internal service role. Responds `{success, mention_db_id, intent, result}`. Not directly callable from frontend because service-role auth is required to bypass webhook verification.
  - `generate-post` (supabase/functions/generate-post): signed wallet action, expects `wallet_address`, `signature`, `sign_timestamp` plus `topic`, `tone`, `length`, `model` (and optional `context_pack`). Returns `{success: true, post_id, tx_hash}` and inserts post.
- Persona data sources:
  - No dedicated `personas` table in migrations. Primary persona is `creators.persona_text`.
  - `creator_profiles` stores bio/tags/interests/specialties and agentic prefs; used by `useStudioData` to build profile.

Implications for Bot Tester UI:
- “All saved personas” is not currently represented in data model; only a single persona exists per creator.
- `process-mention` cannot be safely called from the browser; `generate-post` is the only signed endpoint currently accessible to Studio UI.
- `generate-post` has side effects (creates a post), which conflicts with “no history” requirement unless we accept hidden persistence or change endpoint behavior (not allowed by scope).

## Open Questions
- Where should this live in Studio? (New Studio tab)
- How should we reconcile “all saved personas” requirement with current single-persona data model?
- How should we reconcile “no history” requirement with `generate-post` side effects (post insert)?
- If we must use `generate-post`, what fixed defaults should we use for `tone`, `length`, `model` to keep UI prompt-only?
- What does the tester response display if `generate-post` returns only `post_id`? (Likely need to read the post record after invoke.)

## Scope Boundaries
- INCLUDE: Studio UI for prompt testing with persona selection.
- EXCLUDE: Not defined yet.
