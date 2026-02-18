## Task 2: Unverified User Prompt Template

### Decision
Created `UNVERIFIED_USER_PROMPT` constant in `supabase/functions/process-mention/index.ts`

### Template Text
```
To publish and earn rewards, create your persona at railmint.app and verify your account. Quick setup, big potential!
```

### Specifications Met
- **Character count**: 118 characters (well under 280 Twitter limit)
- **railmint.app mentions**: 1 (exact)
- **Tone**: Neutral, action-focused, no explicit "unverified" mention
- **Call-to-action**: Encourages persona creation and verification
- **Placement**: Line 16-17, at top of file with other constants

### Design Rationale
- Concise but motivating messaging
- Avoids stigmatizing "unverified" label
- Clear path: create persona → verify → publish & earn
- URL reference without protocol (plain railmint.app per spec)

## Task 4: Verification-Based Routing Strategy

### Decision: Early Gate Pattern with Verified Path Continuation

Implemented a verification gate early in the main handler flow that routes all requests based on creator verification status.

### Implementation Details

#### 1. Early Verification Gate (Line 772-775)
```typescript
const verificationResult = await lookupVerifiedCreator(
    supabase,
    processingAuthorHandle,
);
```
- Placed immediately after intent parsing (line 769)
- Checks verification status BEFORE intent-specific processing
- Prevents downstream intent handlers from executing for unverified users

#### 2. Unverified Path (Line 778-849)
When `!verificationResult.found || !verificationResult.verified`:
- Creates mention record with `status: "processed"` and `parsed_intent: "unverified_prompt"`
- Returns `UNVERIFIED_USER_PROMPT` immediately if `replyWithAi && replyViaTwitterApiFlag`
- Updates mention payload with reply result (success or error)
- Early return prevents intent handling downstream
- No publish, ask, or donate operations execute

#### 3. Verified Path (Line 851-onwards)
When verification succeeds:
- Stores `creator` object from verification result
- Continues with existing intent parsing and handling (publish, ask, donate)
- ALL reply generation now uses `buildPersonalizedReply()` instead of `buildAiReply()`
- Passes creator persona/prompt_template to personalization builder

#### 4. Personalized Reply Logic (Line 1031-1039)
For verified users, reply generation changed from:
```typescript
// Old: buildAiReply with CTA template
const replyText = await buildAiReply({
    target: { replyToId, authorHandle, mentionText, intent, mentionUrl, contextSummary },
    ctaText: Deno.env.get("X_REPLY_CTA"),
});
```

To:
```typescript
// New: buildPersonalizedReply using creator persona
const replyText = await buildPersonalizedReply({
    creator: creator as {
        clone_name: string;
        persona_text: string | null;
        prompt_template: string | null;
    },
    mentionText: processingText,
    intentContext: contextSummary || undefined,
});
```

### Routing Flowchart

```
POST /process-mention
    ↓
Parse intent (publish/ask/donate/unknown)
    ↓
Call lookupVerifiedCreator()
    ↓
    ├─→ NOT verified → RETURN UNVERIFIED_USER_PROMPT
    │   └─→ Create mention record, send reply if applicable, exit early
    │
    └─→ VERIFIED → Continue with intent handling
        ├─→ If publish: Create post + update reward pool
        ├─→ If donate: Process donation transfer
        ├─→ If ask: Generate knowledge base response
        └─→ For all intents: Use buildPersonalizedReply() for AI responses
            └─→ AI response uses creator's persona_text + prompt_template
```

### Intent Behavior Matrix

| Intent | Verified User | Unverified User |
|--------|---------------|-----------------|
| publish | Creates post, generates AI reply | Returns verification prompt |
| ask | Generates knowledge response with personalized reply | Returns verification prompt |
| donate | Processes donation, updates pool | Returns verification prompt |
| unknown | Ignored (status = "ignored") | Returns verification prompt |

### Safety Properties

1. **No data leakage**: Unverified users cannot see personalized AI responses
2. **No partial processing**: Intent handlers don't execute for unverified users
3. **Audit trail**: All paths create mention records with intent metadata
4. **Consistent error handling**: Both verified and unverified paths handle reply errors gracefully
5. **Early exit**: Unverified path returns before any intent-specific operations

### Dependencies

- Task 1: `lookupVerifiedCreator()` - Returns verified status and creator object
- Task 2: `UNVERIFIED_USER_PROMPT` - Standard response text
- Task 3: `buildPersonalizedReply()` - Generates AI responses with persona context
- Existing: `buildAiReply()` - Kept as fallback, no longer used in main flow

### Testing Strategy

All intents must be validated with both verified and unverified users:
1. Verified publish → Creates post + personalized AI reply
2. Unverified publish → Returns verification prompt, no post created
3. Verified ask → Returns personalized knowledge response
4. Unverified ask → Returns verification prompt
5. Verified donate → Processes donation with personalized confirmation
6. Unverified donate → Returns verification prompt
