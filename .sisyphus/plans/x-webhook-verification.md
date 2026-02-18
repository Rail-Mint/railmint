# X Webhook Verification Feature Plan

## TL;DR
> **Quick Summary**: Add a verification gate to the X mention webhook flow so verified creators get persona-based replies and unverified users receive a registration prompt.
>
> **Deliverables**:
> - Verified-user lookup in mention processing
> - Persona-aware reply builder using creator persona fields
> - Unverified user prompt reply path
>
> **Estimated Effort**: Short
> **Parallel Execution**: YES — 2 waves
> **Critical Path**: Task 1 → Task 3 → Task 5

---

## Context

### Original Request
Investigate X webhook flow where users tag the bot. Add logic so only verified platform users get persona-based replies; otherwise reply with a prompt to register on railmint.app and verify.

### Interview Summary
**Key Decisions**:
- Verified users: reply using their persona_text/prompt_template.
- Unverified users: simple registration prompt.
- Platform URL: railmint.app.
- Apply verification gate to ALL intents (ask/publish/donate/unknown).
- No automated tests requested.

**Research Findings**:
- `process-mention/index.ts` does not check `x_verified`.
- `x-verify/index.ts` sets `x_verified=true` and `x_handle`.
- `creators` table already contains `x_handle`, `x_verified`, `persona_text`, `prompt_template`.
- AI replies currently use a generic “RailMint AI” persona.

### Metis Review (gaps addressed)
**Identified Gaps**:
- Handle normalization rules
- Persona fallback behavior
- Registration prompt copy specificity
- Intent handling behavior for unverified

---

## Work Objectives

### Core Objective
Ensure X mention replies only use persona-based AI when the author is a verified creator; unverified authors receive a registration prompt.

### Concrete Deliverables
- Verified creator lookup in mention processing using `x_handle` + `x_verified`.
- Persona-aware AI reply builder for verified users.
- Unverified registration prompt reply path using railmint.app.

### Definition of Done
- [x] Verified author mention returns a reply using their persona.
- [x] Unverified author mention returns registration prompt containing `railmint.app`.
- [x] No changes to DB schema or verification flow (x-verify remains as-is).

### Must Have
- Apply verification gate to ALL intents before replying.
- Use creator `persona_text`/`prompt_template` when verified.

### Must NOT Have (Guardrails)
- No new database tables/columns.
- No changes to `x-verify` OAuth flow.
- No changes to webhook authentication/ingress behavior.
- No rate limiting or spam control added (out of scope).

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: Edge functions (Deno)
- **Automated tests**: None (per user)
- **Framework**: None

### QA Policy
Every task includes agent-executed QA scenarios (curl-based calls to edge functions). Evidence captured to `.sisyphus/evidence/`.

| Deliverable Type | Verification Tool | Method |
|------------------|-------------------|--------|
| Edge Function | Bash (curl) | POST to function endpoint, assert response content |

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Start Immediately — data + prompts):
├── Task 1: Add handle normalization utility + verified lookup
├── Task 2: Define unverified reply prompt template
├── Task 3: Persona-aware reply builder (uses persona_text/prompt_template)
├── Task 4: Response routing for verified/unverified across intents
└── Task 5: Update QA scripts and verification evidence capture

Wave 2 (After Wave 1 — integration validation):
└── Task 6: End-to-end mention flow validation (verified/unverified)

Critical Path: Task 1 → Task 3 → Task 4 → Task 6

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|------------|--------|------|
| 1 | — | 3,4 | 1 |
| 2 | — | 4 | 1 |
| 3 | 1 | 4 | 1 |
| 4 | 1,2,3 | 6 | 1 |
| 5 | — | 6 | 1 |
| 6 | 4,5 | — | 2 |

### Agent Dispatch Summary

| Wave | # Parallel | Tasks → Agent Category |
|------|------------|------------------------|
| 1 | **5** | T1-T4 → `quick`, T5 → `unspecified-low` |
| 2 | **1** | T6 → `unspecified-high` |

---

## TODOs

- [x] 1. Add handle normalization + verified creator lookup

  **What to do**:
  - Implement a helper that normalizes `author_handle` (trim, lowercase, ensure leading `@`).
  - Query `creators` by `x_handle` and return `x_verified`, `persona_text`, `prompt_template`, `clone_name`.
  - Return a structured result: `{ found, verified, creator }`.

  **Must NOT do**:
  - Do not add new database fields.
  - Do not change `x-verify` or webhook ingestion.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small, localized logic addition in one file.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: Not needed (no UI).

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2,3,4,5)
  - **Blocks**: Tasks 3,4
  - **Blocked By**: None

  **References**:
  - `supabase/functions/process-mention/index.ts` — current mention parsing and DB access patterns.
  - `supabase/functions/x-verify/index.ts` — sets `x_verified` and `x_handle` (source of truth).
  - `supabase/migrations/20260211173618_4ea1ae69-0916-4d0b-bea0-2cd1b7865feb.sql` — creators schema with `x_handle`/`x_verified` fields.

  **Acceptance Criteria**:
  - [ ] Lookup returns `verified=true` only when creator has `x_verified=true`.
  - [ ] Handle normalization ensures `@` prefix and case-insensitive matching.

  **QA Scenarios**:
  ```
  Scenario: Normalize handle and lookup verified creator
    Tool: Bash (curl)
    Preconditions: A creator exists with x_handle='@Example' and x_verified=true
    Steps:
      1. POST to process-mention with author_handle='example'
      2. Inspect response debug/branch (temporary log or response field)
    Expected Result: Verification branch chooses verified path
    Evidence: .sisyphus/evidence/task-1-verified-lookup.txt

  Scenario: Unverified creator not treated as verified
    Tool: Bash (curl)
    Preconditions: A creator exists with x_handle='@Unverified' and x_verified=false
    Steps:
      1. POST to process-mention with author_handle='@Unverified'
    Expected Result: Verification branch chooses unverified path
    Evidence: .sisyphus/evidence/task-1-unverified-lookup.txt
  ```

  **Commit**: NO

- [x] 2. Add unverified user prompt template

  **What to do**:
  - Create a reusable template for unverified users that includes `railmint.app`.
  - Keep copy concise and aligned with requirement.

  **Must NOT do**:
  - No marketing copy expansion.
  - Do not mention “unverified” explicitly if not required; keep neutral.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small text template addition.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1,3,4,5)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `supabase/functions/process-mention/index.ts` — current reply formatting style.

  **Acceptance Criteria**:
  - [ ] Prompt contains `railmint.app` exactly once.
  - [ ] Prompt is ≤ 280 characters.

  **QA Scenarios**:
  ```
  Scenario: Unverified prompt content
    Tool: Bash (curl)
    Preconditions: Unverified author (x_verified=false)
    Steps:
      1. POST to process-mention with unverified handle
      2. Capture reply text
    Expected Result: Reply contains 'railmint.app' and registration CTA
    Evidence: .sisyphus/evidence/task-2-unverified-prompt.txt
  ```

  **Commit**: NO

- [x] 3. Build persona-aware reply using creator persona fields

  **What to do**:
  - Create a reply builder that uses `creator.prompt_template` as system prompt if present.
  - Fallback to: `You are ${clone_name}. ${persona_text}` if prompt_template missing.
  - Use existing OpenRouter call pattern.

  **Must NOT do**:
  - Do not change model selection unless required.
  - Do not alter OpenRouter headers/auth handling.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Localized modifications to AI prompt construction.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1,2,4,5)
  - **Blocks**: Task 4
  - **Blocked By**: Task 1

  **References**:
  - `supabase/functions/process-mention/index.ts` — `buildAiReply()` existing implementation.
  - `supabase/migrations/20260211173618_4ea1ae69-0916-4d0b-bea0-2cd1b7865feb.sql` — persona fields in creators table.

  **Acceptance Criteria**:
  - [x] When verified, system prompt uses `prompt_template` if non-empty.
  - [x] Fallback uses `persona_text` if `prompt_template` missing.

  **QA Scenarios**:
  ```
  Scenario: Verified reply uses creator prompt_template
    Tool: Bash (curl)
    Preconditions: Creator has prompt_template set
    Steps:
      1. POST to process-mention with verified handle and question text
    Expected Result: Reply content reflects creator persona (unique phrasing)
    Evidence: .sisyphus/evidence/task-3-persona-reply.txt

  Scenario: Verified reply falls back to persona_text
    Tool: Bash (curl)
    Preconditions: Creator has empty prompt_template but persona_text present
    Steps:
      1. POST to process-mention with verified handle
    Expected Result: Reply still generated (non-empty) and uses persona_text
    Evidence: .sisyphus/evidence/task-3-persona-fallback.txt
  ```

  **Commit**: NO

- [x] 4. Route replies by verification status for all intents

  **What to do**:
  - Insert verification check early in mention handling (before intent-specific reply).
  - If not verified: return registration prompt and skip intent parsing.
  - If verified: proceed with existing intent handling, but use persona-aware reply builder.

  **Must NOT do**:
  - Do not alter intent parsing logic itself.
  - Do not change reply posting method (`replyViaTweetApi`).

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Control-flow changes within one function.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1,2,3,5)
  - **Blocks**: Task 6
  - **Blocked By**: Tasks 1,2,3

  **References**:
  - `supabase/functions/process-mention/index.ts` — `handleMention()` routing and `buildAskResponse()`.
  - `supabase/functions/webhook-x-mention/index.ts` — payload structure passed to process-mention.

  **Acceptance Criteria**:
  - [x] Unverified authors always receive registration prompt, regardless of intent.
  - [x] Verified authors receive persona-based AI replies.

  **QA Scenarios**:
  ```
  Scenario: Unverified author with ask intent
    Tool: Bash (curl)
    Preconditions: Unverified creator
    Steps:
      1. POST to process-mention with question text
    Expected Result: Prompt reply includes railmint.app
    Evidence: .sisyphus/evidence/task-4-unverified-ask.txt

  Scenario: Verified author with ask intent
    Tool: Bash (curl)
    Preconditions: Verified creator with persona
    Steps:
      1. POST to process-mention with question text
    Expected Result: Reply is generated by persona-aware AI builder
    Evidence: .sisyphus/evidence/task-4-verified-ask.txt
  ```

  **Commit**: NO

- [x] 5. Update QA fixtures / curl commands for local validation

  **What to do**:
  - Add or update local curl commands or fixtures (if present) for verified/unverified cases.
  - Ensure commands use local edge function endpoint.

  **Must NOT do**:
  - Do not add formal test framework.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Small verification script/documentation adjustments.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1,2,3,4)
  - **Blocks**: Task 6
  - **Blocked By**: None

  **References**:
  - `supabase/functions/process-mention/index.ts` — expected request payload.

  **Acceptance Criteria**:
  - [x] A verified and unverified curl example exists and runs locally.

  **QA Scenarios**:
  ```
  Scenario: Verified curl example works
    Tool: Bash (curl)
    Preconditions: Local Supabase running; verified creator exists
    Steps:
      1. Run curl command for verified mention
    Expected Result: Reply JSON includes non-empty reply
    Evidence: .sisyphus/evidence/task-5-verified-curl.txt
  ```

  **Commit**: NO

- [x] 6. End-to-end validation for verified/unverified paths

  **What to do**:
  - Run verified/unverified flows through process-mention endpoint.
  - Confirm reply text matches expected behavior.

  **Must NOT do**:
  - No manual browser testing required.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Integration validation across multiple paths.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: —
  - **Blocked By**: Tasks 4,5

  **References**:
  - `supabase/functions/process-mention/index.ts` — final branching logic.
  - `supabase/functions/webhook-x-mention/index.ts` — payload fields.

  **Acceptance Criteria**:
  - [x] Verified author request returns persona-based reply.
  - [x] Unverified author request returns registration prompt with `railmint.app`.

  **QA Scenarios**:
  ```
  Scenario: Verified end-to-end
    Tool: Bash (curl)
    Preconditions: Verified creator exists; local edge functions running
    Steps:
      1. POST to /functions/v1/process-mention with verified handle
    Expected Result: Reply present and non-empty
    Evidence: .sisyphus/evidence/task-6-verified-e2e.txt

  Scenario: Unverified end-to-end
    Tool: Bash (curl)
    Preconditions: Unverified creator exists
    Steps:
      1. POST to /functions/v1/process-mention with unverified handle
    Expected Result: Reply contains railmint.app
    Evidence: .sisyphus/evidence/task-6-unverified-e2e.txt
  ```

  **Commit**: NO

---

## Final Verification Wave

- [x] F1. **Plan Compliance Audit** — `oracle`
  Verify all "Must Have" items implemented and "Must NOT Have" guardrails respected. Ensure evidence files exist for all QA scenarios.

- [x] F2. **Code Quality Review** — `unspecified-high`
  Ensure no unused imports, no hardcoded credentials added, no unrelated changes.

- [x] F3. **Real Manual QA** — `unspecified-high`
  Execute all QA scenarios using curl; store evidence outputs.

- [x] F4. **Scope Fidelity Check** — `deep`
  Confirm only process-mention changes, no scope creep.

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 4 | `feat(x-webhook): gate replies on verification` | process-mention/index.ts | curl QA scenarios |

---

## Success Criteria

### Verification Commands
```bash
# Verified creator mention
curl -s -X POST http://127.0.0.1:54321/functions/v1/process-mention \
  -H "Content-Type: application/json" \
  -d '{"mention_id":"test1","text":"@bot ask: hello?","author_handle":"@verified","reply_with_ai":true,"reply_via_twitterapi":false,"reply_to_id":"test1"}'

# Unverified creator mention
curl -s -X POST http://127.0.0.1:54321/functions/v1/process-mention \
  -H "Content-Type: application/json" \
  -d '{"mention_id":"test2","text":"@bot ask: hello?","author_handle":"@unverified","reply_with_ai":true,"reply_via_twitterapi":false,"reply_to_id":"test2"}'
```

### Final Checklist
- [x] Verified creators get persona-based replies
- [x] Unverified creators receive registration prompt with railmint.app
- [x] No schema changes and no verification flow changes
