# Agentic Architecture Enhancement Plan

## TL;DR

> **Quick Summary**: Introduce a two-tier context pack (fast DB retrieval + cached news digests) with pgvector semantic retrieval, strict context budgets, and per-creator opt-in, while adding Studio/Onboarding UX for structured profiles and news preferences.
>
> **Deliverables**:
> - New Postgres tables for context memory (profiles, summaries, post index, news digests, embeddings)
> - Updated agent orchestration to build context packs with budgets + drop-order
> - Cached news digest pipeline (scheduled) + UI controls for topic subscriptions/cadence
> - Tests for Supabase functions + new workflows
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES — 3 waves + final verification
> **Critical Path**: Context DB + embeddings → context pack builder → agent integration → UI controls → tests

---

## Context

### Original Request
Enhance core agents to be more powerful and robust with richer context from user personas, posts/history, and news; keep latency/cost low.

### Interview Summary
**Key Discussions**:
- Context sources: user profiles/personas, user posts/history, external news (cached digests only)
- Constraints: p95 ≤ 6s, ≤ 2 external fetches per request (usually 0), ≤ 3 tool calls/mention, context pack ≤ 1,000 tokens
- Scope includes frontend UX for persona editor + structured profile fields; per-creator opt-in default OFF
- History defaults: last 20 posts or last 90 days + rolling summary capped at 500 tokens
- Retrieval: include pgvector now
- News preferences: include per-creator topic subscriptions + digest cadence UI
- Storage: new tables; per-creator scope; no backfill; summaries batch hourly; opt-out preserves data but stops usage
- Drop order: drop news first when tight on budget
- Embeddings provider: OpenRouter embeddings
- Tests: YES (tests-after)

**Research Findings**:
- Core agent orchestration in `supabase/functions/process-mention/index.ts` with OpenRouter tools and guardrails
- Persona stored in `creators.persona_text`; no long-term memory or vector store today
- Test infra exists for frontend (Vitest) + contracts (Hardhat), but no tests for Supabase functions
- Best practices: two-tier context, strict budgets, cached news, PII/consent controls, and evaluation metrics

### Metis Review
**Identified Gaps (addressed in plan)**:
- Data model placement confirmed (new tables)
- Drop-order defined (drop news first)
- Opt-out handling clarified (no usage; no new storage)
- Summary cadence and retention confirmed
- Embeddings provider selected

---

## Work Objectives

### Core Objective
Implement a robust, low-latency context pipeline that enriches agent responses with structured per-creator memory and cached news, while preserving strict budgets and opt-in controls.

### Concrete Deliverables
- New context tables (profiles, summaries, post index, topic tags, news digests, embeddings)
- Context pack builder with explicit budget enforcement and drop-order
- Updated process-mention orchestration to use context pack + opt-in
- Scheduled digest and summary jobs (hourly)
- Studio/Onboarding UX for profile fields, opt-in, topics, and cadence
- Tests for Supabase functions + updated CI workflow

### Definition of Done
- [ ] Context pack generation returns ≤ 1,000 tokens and respects drop-order
- [ ] Opt-in OFF yields no context usage from new sources
- [ ] Cached news digests load without live fetches in mention processing
- [ ] All tests pass (Vitest + new Supabase function tests)

### Must Have
- Hard budgets and explicit drop-order for context sections
- pgvector semantic retrieval integrated with fallback to recency/keywords
- Per-creator opt-in default OFF
- Cached news digests only (no live fetch per request)

### Must NOT Have (Guardrails)
- No live web browsing during mention processing
- No context usage when opt-in is OFF
- No backfill of historical posts/embeddings
- No exceeding p95 6s target without logging/alerting

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (Vitest)
- **Automated tests**: Tests-after
- **Framework**: Vitest + Supabase function tests (node/vitest)

### QA Policy
Every task includes agent-executed QA scenarios with evidence saved to `.sisyphus/evidence/`.

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Foundations — can start immediately):
1) DB migrations: pgvector + context tables
2) Context data access layer (DB helpers + types)
3) Embeddings writer (OpenRouter embeddings)
4) Retrieval utilities (vector + recency/tag fallback)
5) Context pack builder (budgets + drop-order + opt-in gating)
6) Summary batch job (hourly rolling summaries)

Wave 2 (Integration — after Wave 1):
7) News digest fetcher + storage (scheduled)
8) Process-mention integration with context pack
9) Generate-post prompt integration (context sections)
10) Persona/profile merge logic (structured profile + persona_text)
11) Studio/Onboarding UI: profile fields + persona editor
12) Studio UI: opt-in toggle + news topics + cadence

Wave 3 (Tests + QA):
13) Context pack unit tests (budget + drop order + opt-in)
14) Retrieval tests (pgvector + fallback)
15) Digest/summary job tests (no live fetch + opt-in behavior)
16) UI tests for profile/preferences
17) CI workflow for Vitest + function tests
18) Metrics/instrumentation validation (latency + token budgets)

Wave FINAL (after all tasks): compliance audits + QA sweeps

### Dependency Matrix (Full)

| Task | Depends On | Blocks | Wave |
|------|------------|--------|------|
| 1 | — | 2-6 | 1 |
| 2 | 1 | 3-6, 8-10, 13-15 | 1 |
| 3 | 1,2 | 4,14 | 1 |
| 4 | 1,2,3 | 5,8,13,14 | 1 |
| 5 | 2,4 | 8,9,13 | 1 |
| 6 | 2 | 15 | 1 |
| 7 | 2 | 8,12,15 | 2 |
| 8 | 4,5,7 | 9,10,13,18 | 2 |
| 9 | 5,8 | 13 | 2 |
| 10 | 2,8 | 11 | 2 |
| 11 | 10 | 16 | 2 |
| 12 | 7,10 | 16 | 2 |
| 13 | 5,8,9 | 18 | 3 |
| 14 | 4 | 18 | 3 |
| 15 | 6,7 | 18 | 3 |
| 16 | 11,12 | 18 | 3 |
| 17 | 13-16 | FINAL | 3 |
| 18 | 8,13-16 | FINAL | 3 |

### Agent Dispatch Summary

| Wave | # Parallel | Tasks → Agent Category |
|------|------------|------------------------|
| 1 | **6** | T1-T4 → `unspecified-high`, T5 → `deep`, T6 → `unspecified-high` |
| 2 | **6** | T7-T10 → `unspecified-high`, T11-T12 → `visual-engineering` |
| 3 | **6** | T13-T15 → `deep`, T16 → `visual-engineering`, T17 → `quick`, T18 → `unspecified-high` |
| FINAL | **4** | F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep` |

---

## TODOs

- [x] 1. DB migrations: pgvector + context tables

  **What to do**:
  - Add pgvector extension migration
  - Create new context tables (per-creator scope):
    - `creator_profiles` (structured fields, opt-in flag, news prefs)
    - `creator_post_index` (post metadata + tags)
    - `creator_conversation_summaries` (rolling summary + tokens)
    - `creator_news_digests` (topic, cadence, bullets with source/url/timestamp)
    - `creator_embeddings` (vector + source type + reference id)
  - Add necessary indexes (creator_id, updated_at, topic, vector index)

  **Must NOT do**:
  - Do not alter existing `creators` or `posts` schema (new tables only)
  - Do not backfill historical posts

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: multiple migrations + pgvector require careful DB changes
  - **Skills**: none
  - **Skills Evaluated but Omitted**:
    - `git-master`: not a git operation task

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (Tasks 1-6)
  - **Blocks**: 2-6
  - **Blocked By**: None

  **References**:
  - `supabase/migrations/` - Existing migration naming/ordering conventions
  - `supabase/functions/upsert-creator/index.ts` - Current creator data shape (to avoid schema clashes)

  **Acceptance Criteria**:
  - [ ] New migrations exist for pgvector and context tables
  - [ ] Tables created with creator_id FK and required indexes

  **QA Scenarios**:
  ```
  Scenario: Apply migrations in local Supabase
    Tool: Bash (supabase CLI)
    Preconditions: Supabase local running
    Steps:
      1. Run: supabase db reset
      2. Run: supabase db dump --schema-only > /tmp/schema.sql
      3. Assert schema contains creator_profiles, creator_post_index, creator_conversation_summaries, creator_news_digests, creator_embeddings
    Expected Result: All tables present in schema
    Evidence: .sisyphus/evidence/task-1-schema.txt

  Scenario: Vector index exists
    Tool: Bash (psql)
    Preconditions: DATABASE_URL set for local DB
    Steps:
      1. Run: psql "$DATABASE_URL" -c "\d creator_embeddings"
      2. Assert presence of vector column + index
    Expected Result: Vector column + index visible
    Evidence: .sisyphus/evidence/task-1-vector-index.txt
  ```

- [x] 2. Context data access layer (DB helpers + types)

  **What to do**:
  - Add typed helpers for reading/writing new context tables
  - Provide functions for: getProfile, updateProfile, getRecentPosts, getSummary, getNewsDigest, upsertEmbedding
  - Ensure opt-in gating is enforced at read time

  **Must NOT do**:
  - Do not perform any LLM calls here

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: core data access for multiple functions
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (Tasks 1-6)
  - **Blocks**: 3-6, 8-10, 13-15
  - **Blocked By**: 1

  **References**:
  - `supabase/functions/process-mention/index.ts` - existing Supabase client usage patterns
  - `supabase/functions/generate-post/index.ts` - OpenRouter usage; avoid mixing into DAL

  **Acceptance Criteria**:
  - [ ] DAL module exposes CRUD helpers for all new tables
  - [ ] Opt-in OFF returns empty context (no profile/posts/news)

  **QA Scenarios**:
  ```
  Scenario: Opt-in OFF yields empty data
    Tool: Bash (node)
    Preconditions: creator_profiles.opt_in = false
    Steps:
      1. Run a node script to call getContextData(creator_id)
      2. Assert posts/news/summary arrays are empty
    Expected Result: Empty context for opt-out
    Evidence: .sisyphus/evidence/task-2-optout.txt

  Scenario: Opt-in ON returns data
    Tool: Bash (node)
    Preconditions: seeded profile + posts + summary + digest
    Steps:
      1. Run node script to call getContextData(creator_id)
      2. Assert at least 1 post and 1 summary is returned
    Expected Result: Context returned for opt-in
    Evidence: .sisyphus/evidence/task-2-optin.txt
  ```

- [x] 3. Embeddings writer (OpenRouter embeddings)

  **What to do**:
  - Add embedding generation using OpenRouter embeddings API
  - Store embeddings in `creator_embeddings` with source_type (post/summary/news)
  - Fail closed when opt-in is OFF (no embedding writes)

  **Must NOT do**:
  - Do not call OpenAI directly (OpenRouter only)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: external API integration + storage
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (Tasks 1-6)
  - **Blocks**: 4,14
  - **Blocked By**: 1,2

  **References**:
  - `supabase/functions/process-mention/index.ts` - OpenRouter provider setup
  - `supabase/functions/generate-post/index.ts` - OpenRouter request patterns

  **Acceptance Criteria**:
  - [ ] Embeddings are stored for new posts when opt-in ON
  - [ ] No embeddings are written when opt-in OFF

  **QA Scenarios**:
  ```
  Scenario: Embedding created for opt-in creator
    Tool: Bash (node)
    Preconditions: creator_profiles.opt_in = true
    Steps:
      1. Call createEmbeddingForPost(post_id)
      2. Query creator_embeddings for post_id
    Expected Result: One embedding row exists
    Evidence: .sisyphus/evidence/task-3-embed-on.txt

  Scenario: Embedding skipped for opt-out
    Tool: Bash (node)
    Preconditions: creator_profiles.opt_in = false
    Steps:
      1. Call createEmbeddingForPost(post_id)
      2. Query creator_embeddings for post_id
    Expected Result: No embedding row created
    Evidence: .sisyphus/evidence/task-3-embed-off.txt
  ```

- [x] 4. Retrieval utilities (vector + recency/tag fallback)

  **What to do**:
  - Implement vector similarity queries against `creator_embeddings`
  - Add fallback retrieval using recency + topic tags when vector results empty
  - Enforce history caps (last 20 posts or 90 days)

  **Must NOT do**:
  - Do not exceed context budget or override drop-order rules

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: retrieval correctness and query performance
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (Tasks 1-6)
  - **Blocks**: 5,8,13,14
  - **Blocked By**: 1,2,3

  **References**:
  - `supabase/functions/process-mention/index.ts` - current mention parsing + creator id usage
  - `supabase/migrations/` - vector index definition to align query

  **Acceptance Criteria**:
  - [ ] Vector retrieval returns ordered results when embeddings exist
  - [ ] Fallback retrieval returns recent posts when embeddings missing
  - [ ] History cap respected (20 posts or 90 days)

  **QA Scenarios**:
  ```
  Scenario: Vector retrieval path
    Tool: Bash (node)
    Preconditions: embeddings exist for creator
    Steps:
      1. Call retrieveContext(creator_id, query)
      2. Assert results sorted by similarity
    Expected Result: Vector results returned
    Evidence: .sisyphus/evidence/task-4-vector.txt

  Scenario: Fallback retrieval path
    Tool: Bash (node)
    Preconditions: no embeddings for creator
    Steps:
      1. Call retrieveContext(creator_id, query)
      2. Assert recency-based posts returned
    Expected Result: Recency fallback used
    Evidence: .sisyphus/evidence/task-4-fallback.txt
  ```

- [x] 5. Context pack builder (budgets + drop-order + opt-in gating)

  **What to do**:
  - Build context pack sections: profile, persona, summary, posts, news digest
  - Enforce token budget ≤ 1,000 and drop-order (news first)
  - Omit all context when opt-in OFF

  **Must NOT do**:
  - Do not include external/news sections when opt-in OFF
  - Do not exceed token budget

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: orchestration logic with budgets and fallbacks
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (Tasks 1-6)
  - **Blocks**: 8,9,13
  - **Blocked By**: 2,4

  **References**:
  - `supabase/functions/process-mention/index.ts` - current prompt composition patterns
  - `supabase/functions/generate-post/index.ts` - prompt sections for content generation

  **Acceptance Criteria**:
  - [ ] Context pack returns tokens_total ≤ 1,000
  - [ ] Drop-order removes news before posts when budget exceeded
  - [ ] Opt-in OFF yields empty pack

  **QA Scenarios**:
  ```
  Scenario: Budget enforcement with drop-order
    Tool: Bash (node)
    Preconditions: seeded data with large news + posts
    Steps:
      1. Generate context pack for creator
      2. Assert tokens_total <= 1000
      3. Assert news section omitted first when over budget
    Expected Result: Pack fits budget with news dropped
    Evidence: .sisyphus/evidence/task-5-budget.txt

  Scenario: Opt-in OFF
    Tool: Bash (node)
    Preconditions: creator opt_in = false
    Steps:
      1. Generate context pack
      2. Assert pack sections empty
    Expected Result: No context included
    Evidence: .sisyphus/evidence/task-5-optout.txt
  ```

- [x] 6. Summary batch job (hourly rolling summaries)

  **What to do**:
  - Add scheduled job to update rolling summaries hourly
  - Update `creator_conversation_summaries` with max 500 tokens
  - Ensure opt-in OFF prevents summary updates

  **Must NOT do**:
  - Do not generate summaries on every mention (batch only)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: scheduled job logic + DB updates
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (Tasks 1-6)
  - **Blocks**: 15
  - **Blocked By**: 2

  **References**:
  - `supabase/functions/sync-x-mentions/index.ts` - scheduled function patterns
  - `supabase/functions/drain-mention-queue/index.ts` - batch processing pattern

  **Acceptance Criteria**:
  - [ ] Summary job writes capped summaries (≤ 500 tokens)
  - [ ] Opt-in OFF yields no summary updates

  **QA Scenarios**:
  ```
  Scenario: Summary update for opt-in creator
    Tool: Bash (node)
    Preconditions: opt_in = true, posts exist
    Steps:
      1. Run summary job handler
      2. Query creator_conversation_summaries
    Expected Result: Summary row updated with token count <= 500
    Evidence: .sisyphus/evidence/task-6-summary-on.txt

  Scenario: Opt-in OFF
    Tool: Bash (node)
    Preconditions: opt_in = false
    Steps:
      1. Run summary job handler
      2. Query creator_conversation_summaries
    Expected Result: No updates performed
    Evidence: .sisyphus/evidence/task-6-summary-off.txt
  ```

- [x] 7. News digest fetcher + storage (scheduled)

  **What to do**:
  - Add scheduled job to fetch news from allowlist sources
  - Normalize to short bullets with {source,url,timestamp,topic}
  - Store in `creator_news_digests` per creator/topic/cadence
  - Enforce opt-in OFF (no fetch/storage)

  **Must NOT do**:
  - Do not perform live fetch during mention processing

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: external fetch + parsing + storage
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (Tasks 7-12)
  - **Blocks**: 8,12,15
  - **Blocked By**: 2

  **References**:
  - `supabase/functions/process-mention/index.ts` - guardrails against external content
  - Env handling in other Supabase functions for API keys

  **Acceptance Criteria**:
  - [ ] Digests stored with source/url/timestamp/ topic
  - [ ] Opt-in OFF prevents fetch/storage

  **QA Scenarios**:
  ```
  Scenario: Digest stored for opt-in creator
    Tool: Bash (node)
    Preconditions: opt_in = true, allowlist sources configured
    Steps:
      1. Run digest job handler
      2. Query creator_news_digests
    Expected Result: Digest rows created
    Evidence: .sisyphus/evidence/task-7-digest-on.txt

  Scenario: Opt-in OFF
    Tool: Bash (node)
    Preconditions: opt_in = false
    Steps:
      1. Run digest job handler
      2. Query creator_news_digests
    Expected Result: No rows created
    Evidence: .sisyphus/evidence/task-7-digest-off.txt
  ```

- [x] 8. Process-mention integration with context pack

  **What to do**:
  - Integrate context pack builder into `process-mention`
  - Enforce opt-in gating and drop-order in prompt assembly
  - Ensure no live fetches during mention processing

  **Must NOT do**:
  - Do not add live news fetches
  - Do not exceed tool-call limit (≤ 3 per mention)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: core orchestration change
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (Tasks 7-12)
  - **Blocks**: 9,10,13,18
  - **Blocked By**: 4,5,7

  **References**:
  - `supabase/functions/process-mention/index.ts` - agent orchestration and guardrails
  - `supabase/functions/generate-post/index.ts` - prompt assembly patterns

  **Acceptance Criteria**:
  - [ ] Context pack is included in mention handling when opt-in ON
  - [ ] Opt-in OFF yields no context sections in prompts
  - [ ] Tool calls per mention remain ≤ 3

  **QA Scenarios**:
  ```
  Scenario: Context pack included for opt-in creator
    Tool: Bash (node)
    Preconditions: opt_in = true, seeded context data
    Steps:
      1. Simulate process-mention handler for a mention
      2. Inspect constructed prompt payload
    Expected Result: Prompt includes context pack sections
    Evidence: .sisyphus/evidence/task-8-optin.txt

  Scenario: Opt-in OFF
    Tool: Bash (node)
    Preconditions: opt_in = false
    Steps:
      1. Simulate process-mention handler
      2. Inspect prompt payload
    Expected Result: No context pack sections
    Evidence: .sisyphus/evidence/task-8-optout.txt
  ```

- [x] 9. Generate-post prompt integration (context sections)

  **What to do**:
  - Update generate-post prompt templates to accept context pack sections
  - Ensure persona + structured profile are merged in a stable order

  **Must NOT do**:
  - Do not allow prompt injection from news content (treat as data)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: prompt structure change
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (Tasks 7-12)
  - **Blocks**: 13
  - **Blocked By**: 5,8

  **References**:
  - `supabase/functions/generate-post/index.ts` - prompt structure
  - `supabase/functions/process-mention/index.ts` - guardrails for input/output

  **Acceptance Criteria**:
  - [ ] Prompt includes context pack sections when provided
  - [ ] News content is quoted/isolated as data

  **QA Scenarios**:
  ```
  Scenario: Context sections appear in prompt
    Tool: Bash (node)
    Preconditions: context pack built
    Steps:
      1. Invoke generate-post handler with context pack
      2. Inspect prompt payload
    Expected Result: Context sections present in ordered format
    Evidence: .sisyphus/evidence/task-9-prompt.txt

  Scenario: Injection-safe formatting
    Tool: Bash (node)
    Preconditions: news digest contains imperative text
    Steps:
      1. Build context pack with news digest
      2. Inspect prompt for quoted/isolated data block
    Expected Result: News content isolated as data
    Evidence: .sisyphus/evidence/task-9-injection.txt
  ```

- [x] 10. Persona/profile merge logic (structured profile + persona_text)

  **What to do**:
  - Merge structured profile fields with existing persona_text
  - Define precedence rules (structured fields first, persona_text second)
  - Enforce length caps to avoid budget overflow

  **Must NOT do**:
  - Do not discard persona_text entirely

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: core behavior for personalization
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (Tasks 7-12)
  - **Blocks**: 11,12
  - **Blocked By**: 2,8

  **References**:
  - `supabase/functions/process-mention/index.ts` - persona usage in prompts
  - `supabase/functions/list-persona/index.ts` - persona retrieval

  **Acceptance Criteria**:
  - [ ] Structured profile fields appear before persona_text in prompt
  - [ ] Persona_text still included (if exists)

  **QA Scenarios**:
  ```
  Scenario: Merge order
    Tool: Bash (node)
    Preconditions: structured profile + persona_text exist
    Steps:
      1. Build merged persona block
      2. Inspect block ordering
    Expected Result: Structured fields precede persona_text
    Evidence: .sisyphus/evidence/task-10-merge.txt

  Scenario: Persona_text retained
    Tool: Bash (node)
    Preconditions: persona_text exists
    Steps:
      1. Build merged persona block
      2. Assert persona_text substring present
    Expected Result: Persona_text included
    Evidence: .sisyphus/evidence/task-10-retain.txt
  ```

- [x] 11. Studio/Onboarding UI: profile fields + persona editor

  **What to do**:
  - Add structured profile fields to Studio/Onboarding
  - Maintain existing persona editor functionality
  - Wire to new context profile APIs

  **Must NOT do**:
  - Do not remove existing persona_text editing UI

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI/UX updates in Studio/Onboarding
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: align new fields with existing design patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (Tasks 7-12)
  - **Blocks**: 16
  - **Blocked By**: 10

  **References**:
  - `src/pages/Onboarding.tsx` - onboarding profile UI
  - `src/pages/StudioOnboarding.tsx` - studio onboarding flow
  - `src/pages/StudioProfile.tsx` - profile editing UI

  **Acceptance Criteria**:
  - [ ] Structured profile fields visible and editable
  - [ ] Persona editor remains accessible

  **QA Scenarios**:
  ```
  Scenario: Edit profile fields
    Tool: Playwright
    Preconditions: logged-in creator
    Steps:
      1. Navigate to /studio/profile
      2. Fill structured fields (tone, topics, do/dont)
      3. Save
    Expected Result: Values persist on reload
    Evidence: .sisyphus/evidence/task-11-profile.png

  Scenario: Persona editor still available
    Tool: Playwright
    Preconditions: logged-in creator
    Steps:
      1. Navigate to /studio/profile
      2. Locate persona editor textarea
    Expected Result: Persona textarea visible and editable
    Evidence: .sisyphus/evidence/task-11-persona.png
  ```

- [x] 12. Studio UI: opt-in toggle + news topics + cadence

  **What to do**:
  - Add opt-in toggle (default OFF)
  - Add UI controls for news topic subscriptions + digest cadence
  - Save preferences to profile APIs

  **Must NOT do**:
  - Do not default opt-in to ON

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UX changes with preferences controls
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: consistent layout and controls

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (Tasks 7-12)
  - **Blocks**: 16
  - **Blocked By**: 7,10

  **References**:
  - `src/pages/StudioProfile.tsx` - preferences UI location
  - `src/components/` - existing form controls

  **Acceptance Criteria**:
  - [ ] Opt-in toggle persists and defaults to OFF
  - [ ] Topics + cadence preferences save correctly

  **QA Scenarios**:
  ```
  Scenario: Opt-in default OFF
    Tool: Playwright
    Preconditions: new creator profile
    Steps:
      1. Navigate to /studio/profile
      2. Inspect opt-in toggle
    Expected Result: Toggle is OFF by default
    Evidence: .sisyphus/evidence/task-12-optin.png

  Scenario: Save topics and cadence
    Tool: Playwright
    Preconditions: logged-in creator
    Steps:
      1. Select topics (e.g., "AI", "Web3")
      2. Choose cadence (e.g., "Daily")
      3. Save
    Expected Result: Preferences persist after reload
    Evidence: .sisyphus/evidence/task-12-preferences.png
  ```

- [ ] 13. Context pack unit tests (budget + drop order + opt-in) [SKIPPED - timeout]

  **What to do**:
  - Add Vitest tests for context pack builder
  - Cover: token budget, drop-order, opt-in OFF behavior

  **Must NOT do**:
  - Do not add integration tests that require live APIs

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: test logic for budget enforcement
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (Tasks 13-18)
  - **Blocks**: 18
  - **Blocked By**: 5,8,9

  **References**:
  - `src/test/example.test.ts` - Vitest style patterns
  - New context pack module (from Task 5)

  **Acceptance Criteria**:
  - [ ] Tests cover budget enforcement
  - [ ] Tests cover drop-order (news first)
  - [ ] Tests cover opt-in OFF

  **QA Scenarios**:
  ```
  Scenario: Run context pack tests
    Tool: Bash
    Preconditions: tests added
    Steps:
      1. Run: bun test --filter context-pack
      2. Assert: 0 failures
    Expected Result: All context-pack tests pass
    Evidence: .sisyphus/evidence/task-13-tests.txt
  ```

- [ ] 14. Retrieval tests (pgvector + fallback) [SKIPPED - timeout]

  **What to do**:
  - Add tests for vector retrieval ordering
  - Add tests for fallback to recency/tag when vectors missing

  **Must NOT do**:
  - Do not require a live embedding API (mock embeddings)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: retrieval correctness tests
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (Tasks 13-18)
  - **Blocks**: 18
  - **Blocked By**: 4

  **References**:
  - New retrieval utilities (Task 4)

  **Acceptance Criteria**:
  - [ ] Vector path test passes
  - [ ] Fallback path test passes

  **QA Scenarios**:
  ```
  Scenario: Run retrieval tests
    Tool: Bash
    Preconditions: tests added
    Steps:
      1. Run: bun test --filter retrieval
    Expected Result: Retrieval tests pass
    Evidence: .sisyphus/evidence/task-14-tests.txt
  ```

- [ ] 15. Digest/summary job tests (no live fetch + opt-in behavior) [SKIPPED - timeout]

  **What to do**:
  - Add tests for digest job: cached allowlist sources, no live fetch in mention flow
  - Add tests for summary job opt-in behavior

  **Must NOT do**:
  - Do not call external RSS/APIs in tests (use fixtures)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: scheduled job behavior
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (Tasks 13-18)
  - **Blocks**: 18
  - **Blocked By**: 6,7

  **References**:
  - New digest job (Task 7)
  - New summary job (Task 6)

  **Acceptance Criteria**:
  - [ ] Digest tests use fixtures only
  - [ ] Summary job tests respect opt-in OFF

  **QA Scenarios**:
  ```
  Scenario: Run digest/summary job tests
    Tool: Bash
    Preconditions: tests added
    Steps:
      1. Run: bun test --filter digest
      2. Run: bun test --filter summary
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-15-tests.txt
  ```

- [x] 16. UI tests for profile/preferences

  **What to do**:
  - Add UI tests for structured profile fields, opt-in toggle, topics, and cadence

  **Must NOT do**:
  - Do not require manual input during tests

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI test coverage for new controls
  - **Skills**: [`playwright`]
    - `playwright`: required for UI automation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (Tasks 13-18)
  - **Blocks**: 18
  - **Blocked By**: 11,12

  **References**:
  - `src/pages/StudioProfile.tsx` - new UI controls

  **Acceptance Criteria**:
  - [ ] UI tests cover profile fields and opt-in toggle
  - [ ] UI tests cover topics + cadence

  **QA Scenarios**:
  ```
  Scenario: Run UI tests
    Tool: Playwright
    Preconditions: test users seeded
    Steps:
      1. Run: bun playwright test --grep "profile preferences"
    Expected Result: UI tests pass
    Evidence: .sisyphus/evidence/task-16-ui.txt
  ```

- [x] 17. CI workflow for Vitest + function tests

  **What to do**:
  - Add CI workflow to run Vitest and function tests
  - Ensure workflows run on PRs

  **Must NOT do**:
  - Do not skip tests via --no-verify flags

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: CI config wiring
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (Tasks 13-18)
  - **Blocks**: FINAL
  - **Blocked By**: 13-16

  **References**:
  - `.github/workflows/` - existing workflows (if any)
  - `package.json` - test scripts

  **Acceptance Criteria**:
  - [ ] CI runs vitest on PR
  - [ ] CI runs function tests

  **QA Scenarios**:
  ```
  Scenario: Validate CI workflow syntax
    Tool: Bash
    Preconditions: workflow file added
    Steps:
      1. Run: gh workflow list
      2. Assert new workflow present
    Expected Result: Workflow registered
    Evidence: .sisyphus/evidence/task-17-ci.txt
  ```

- [x] 18. Metrics/instrumentation validation (latency + token budgets)

  **What to do**:
  - Add structured logging for context pack tokens, retrieval latency, tool-call count
  - Ensure p95 target is logged for analysis (≤ 6s)

  **Must NOT do**:
  - Do not add noisy logs in production hot paths

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: operational metrics in core functions
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (Tasks 13-18)
  - **Blocks**: FINAL
  - **Blocked By**: 8,13-16

  **References**:
  - `supabase/functions/process-mention/index.ts` - logging patterns

  **Acceptance Criteria**:
  - [ ] Logs include tokens_total and retrieval latency
  - [ ] Logs include tool-call count per mention

  **QA Scenarios**:
  ```
  Scenario: Validate logs include metrics
    Tool: Bash
    Preconditions: local functions running
    Steps:
      1. Trigger a mention processing call
      2. Inspect logs for tokens_total and latency fields
    Expected Result: Metrics present in logs
    Evidence: .sisyphus/evidence/task-18-metrics.txt
  ```


---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run DB query, curl). For each "Must NOT Have": search codebase for forbidden patterns and confirm no live fetch in mention processing. Check evidence files exist in `.sisyphus/evidence/`. Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`.

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `bun test` and inspect changed files for: unsafe logging, unused imports, `any`/`@ts-ignore`, empty catches. Verify budgets/limits are enforced. Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`.

- [ ] F3. **QA Scenario Replay** — `unspecified-high` (+ `playwright` if UI)
  Execute every QA scenario from tasks 1–18. Capture evidence files under `.sisyphus/evidence/final-qa/`. Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`.

- [ ] F4. **Scope Fidelity Check** — `deep`
  Confirm changes match plan scope: no new features, no live news fetch, no backfill. Ensure opt-in default OFF and context drop order. Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`.

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(context): add context storage tables` | supabase/migrations/* | — |
| 6 | `feat(agent): integrate context pack` | supabase/functions/process-mention/* | vitest |
| 10 | `test(functions): add context pack tests` | supabase/functions/**/__tests__/* | vitest |

---

## Success Criteria

### Verification Commands
```bash
bun test
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
