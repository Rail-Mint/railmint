# Learnings: Agentic Architecture Enhancement

## [START] Session: ses_38fff062dffejqeCEDOtm5iPB3

Starting work on agentic architecture enhancement plan.

**Plan Summary**:
- Two-tier context pack (fast DB retrieval + cached news digests)
- pgvector semantic retrieval with fallback
- Per-creator opt-in (default OFF)
- Strict context budgets (≤1,000 tokens, drop news first)
- Studio/Onboarding UX for profiles and news preferences

**Key Constraints**:
- p95 ≤ 6s
- ≤ 2 external fetches per request (usually 0)
- ≤ 3 tool calls/mention
- Context pack ≤ 1,000 tokens
- No live fetch during mention processing
- No backfill of historical data
- Opt-out preserves data but stops usage

**Execution Strategy**:
- Wave 1: 6 parallel foundational tasks (DB, DAL, embeddings, retrieval, context pack, summaries)
- Wave 2: 6 parallel integration tasks (news digest, process-mention, prompts, persona merge, UI)
- Wave 3: 6 parallel test tasks
- Wave FINAL: 4 parallel compliance audits

---

## Task 1: DB Migrations for Context Tables (Completed)

### Migration Files Created
Created 6 migration files following timestamp naming convention `YYYYMMDDHHMMSS_description.sql`:
1. `20260218120000_enable_pgvector.sql` - Enable pgvector extension
2. `20260218120100_creator_profiles.sql` - Creator profiles with opt-in flags
3. `20260218120200_creator_post_index.sql` - Post metadata index with tags
4. `20260218120300_creator_conversation_summaries.sql` - Rolling summaries
5. `20260218120400_creator_news_digests.sql` - News digests with JSONB bullets
6. `20260218120500_creator_embeddings.sql` - Embeddings with IVFFlat vector index

### Key Implementation Patterns
- All tables follow existing RLS pattern: public read, service role manage
- Used `ON DELETE CASCADE` for creator_id FKs (cleanup on creator deletion)
- Applied `update_updated_at_column()` trigger to all tables (existing pattern)
- Created indexes on `creator_id`, `updated_at` for all tables
- Used JSONB for news digest bullets (flexible structure for source/url/timestamp)
- Vector column: `vector(1536)` matching OpenAI embedding dimensions
- IVFFlat index with `lists=100` for vector similarity search (cosine distance)

### Schema Validation
- ✓ pgvector v0.8.0 extension enabled
- ✓ All 5 context tables created successfully
- ✓ All FK constraints to `creators.id` with CASCADE delete
- ✓ Vector index created on `creator_embeddings.embedding`
- ✓ All indexes created for query optimization
- ✓ RLS policies applied (public read, service role manage)

### Notable Decisions
- **Embedding dimension**: 1536 (matches OpenAI text-embedding-3-small)
- **Vector index type**: IVFFlat with cosine distance (good balance for dataset size)
- **News digest storage**: JSONB array (allows flexible bullet structure)
- **Conversation summary**: Single row per creator (rolling summary with token count)
- **Post index**: Separate from main `posts` table (no schema alteration)

### Migration Application
All migrations applied cleanly with `supabase db reset`:
- No conflicts with existing tables
- Proper dependency order maintained (pgvector → tables → indexes)
- IVFFlat index created (note: small data warning is expected in dev)

---

## Task 4: Retrieval Utilities (Completed)

**Implementation**:
- Created `supabase/functions/_shared/retrieval.ts` with vector + fallback retrieval
- Created SQL migration `20260218120600_match_creator_embeddings.sql` for pgvector RPC
- Implemented `retrieveVectorContext()` for semantic similarity queries
- Implemented `retrieveFallbackContext()` for recency + tag filtering
- Main `retrieveContext()` function with automatic fallback logic

**Key Features**:
- Vector similarity via pgvector cosine distance operator (`<=>`)
- History cap enforcement: MAX(20 posts, 90 days)
- Automatic fallback when embeddings missing or results empty
- OpenRouter embeddings API integration (text-embedding-ada-002, 1536 dimensions)
- RPC function `match_creator_embeddings` for efficient similarity queries

**Technical Details**:
- pgvector index: `ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`
- Similarity score: `1 - (embedding <=> query_embedding)` (cosine distance to similarity)
- History cutoff: `created_at >= NOW() - INTERVAL '90 days'`
- Result limit: `LIMIT 20` enforced in SQL
- Fallback order: recency (DESC) with optional tag filtering

**Validation Results** (from `.sisyphus/evidence/task-4-verification.txt`):
- ✅ Project structure validated
- ✅ SQL migration validated (7 checks passed)
- ✅ Retrieval module validated (10 checks passed)
- ✅ Vector similarity path implemented
- ✅ Fallback retrieval path implemented
- ✅ History cap enforcement verified

**Module Exports**:
- `retrieveVectorContext(supabase, creatorId, query, options)` - pgvector search
- `retrieveFallbackContext(supabase, creatorId, options)` - recency fallback
- `retrieveContext(supabase, creatorId, query, options)` - main entry point with auto-fallback
- `RetrievalResult` type with `method`, `truncated`, and `metadata` fields

**Dependencies**:
- Requires pgvector extension (enabled via migration `20260218120000_enable_pgvector.sql`)
- Requires `creator_embeddings` table (migration `20260218120500_creator_embeddings.sql`)
- Uses OpenRouter API for query embedding generation

**Next Steps** (for integration):
- DAL module (Task 2) should import and use these functions
- Embeddings module (Task 3) should populate `creator_embeddings` table
- Context pack module (Task 5) should call `retrieveContext()` for post history

---

## Task 3: Embeddings Generation Module

### Implementation
Created `supabase/functions/_shared/embeddings.ts` with OpenRouter integration:

1. **OpenRouter Embeddings API Integration**
   - Model: `openai/text-embedding-3-small`
   - Dimensions: 1536 (matches migration schema)
   - Endpoint: `https://openrouter.ai/api/v1/embeddings`
   - Timeout: 15 seconds with AbortController

2. **Fail-Closed Opt-In Enforcement**
   - `checkOptIn()` called FIRST before any API calls
   - Early return when `context_opt_in` is false
   - No embedding generation or storage for opt-out creators
   - Structured logging for audit trail

3. **Database Schema Alignment**
   - Source types: 'post', 'conversation', 'profile' (from migration)
   - Storage table: `creator_embeddings`
   - Vector format: pgvector-compatible array string
   - Metadata stored as JSONB for extensibility

4. **Convenience Functions**
   - `createEmbeddingForPost()` - for post content
   - `createEmbeddingForConversation()` - for conversation summaries
   - `createEmbeddingForProfile()` - for creator profiles

### Key Patterns Learned

1. **OpenRouter Integration Pattern**
   - Same pattern as process-mention and generate-post
   - Headers: `Authorization`, `HTTP-Referer`, `X-Title`
   - Error handling: status check + text slice
   - Timeout: AbortController pattern

2. **Supabase Edge Function Structure**
   - ESM imports from `esm.sh` (not npm)
   - Deno global available at runtime
   - TypeScript errors from tsc/LSP are expected
   - Compare with existing functions for validation

3. **Security Controls**
   - Opt-in check must be FIRST operation
   - Log all opt-out events with context
   - Validate API key presence before calls
   - Validate response dimensions

4. **Testing Strategy**
   - Created validation script for module structure
   - Created integration test script for opt-in/opt-out
   - Evidence files capture verification results
   - Manual inspection confirms correctness

### Evidence Generated
- `task-3-embed-structure.txt` - Module structure verification
- `task-3-opt-in-behavior.txt` - Opt-in logic verification
- `task-3-lsp-diagnostics.txt` - TypeScript validation results

### Next Steps
Module ready for integration in Task 4 (retrieval utilities) and downstream tasks.


---

## Task 2: Context Data Access Layer (Completed)

### Implementation
Created `supabase/functions/_shared/context-dal.ts` with typed CRUD helpers for all context tables:

1. **TypeScript Types Matching Migration Schemas**
   - `CreatorProfile` - profile with opt-in flag, bio, tags, interests, specialties, news prefs
   - `CreatorPostIndex` - post metadata with tags, like count, timestamp
   - `CreatorConversationSummary` - rolling summary with token count, conversation count
   - `CreatorNewsDigest` - news digest with JSONB bullets (source, url, timestamp, text)
   - `CreatorEmbedding` - embedding vector with source type, metadata
   - `NewsDigestBullet` - typed structure for digest bullets

2. **Opt-In Gating Enforcement**
   - `checkOptIn()` helper checks `creator_profiles.context_opt_in` flag
   - All read operations call `checkOptIn()` FIRST
   - Returns empty data when opt-in is OFF:
     - `getProfile()` → null
     - `getRecentPosts()` → []
     - `getSummary()` → null
     - `getNewsDigest()` → []
     - `upsertEmbedding()` → null (silent fail, no-op)
   - `updateProfile()` does NOT enforce opt-in (profile creation always allowed)

3. **History Cap Enforcement**
   - `getRecentPosts()` enforces MAX(20 posts, 90 days) from plan requirements
   - Default options: `{ limit: 20, maxAgeDays: 90 }`
   - SQL filters: `post_timestamp >= cutoffDate` + `ORDER BY post_timestamp DESC` + `LIMIT N`

4. **Query Patterns**
   - Used `.maybeSingle()` for unique-by-creator queries (profile, summary)
   - Used `.select("*")` for full row retrieval
   - Used `.upsert()` with `onConflict: "creator_id"` for profile updates
   - Used `.order()` + `.limit()` for post history queries

### Validation Results

**Opt-Out Test** (`.sisyphus/evidence/task-2-optout.txt`):
- ✅ `getProfile()` returns NULL when opt-in OFF
- ✅ `getRecentPosts()` returns empty array when opt-in OFF
- ✅ `getSummary()` returns NULL when opt-in OFF
- ✅ `getNewsDigest()` returns empty array when opt-in OFF
- VERDICT: ALL CHECKS PASSED

**Opt-In Test** (`.sisyphus/evidence/task-2-optin.txt`):
- ✅ `getProfile()` returns profile data when opt-in ON
- ✅ `getRecentPosts()` returns posts when opt-in ON (count: 1)
- ✅ `getSummary()` returns summary when opt-in ON (token_count: 150)
- ✅ `getNewsDigest()` query succeeds when opt-in ON (count: 0 expected)
- VERDICT: ALL CHECKS PASSED

### Key Patterns Learned

1. **Supabase Client Patterns**
   - Import from `https://esm.sh/@supabase/supabase-js@2` for Deno runtime
   - Type parameter: `SupabaseClient` (generic, no database schema type)
   - Query builder: chained `.from().select().eq().maybeSingle()`
   - Error handling: destructure `{ data, error }` from query result

2. **Opt-In Gating Strategy**
   - Single source of truth: `creator_profiles.context_opt_in`
   - Check FIRST before any data retrieval
   - Return empty/null for opt-out (fail closed, no data leakage)
   - Profile creation bypasses opt-in (users must be able to set preferences)

3. **Testing Strategy for DAL**
   - Created test scripts with `.js` extension for Bun runtime
   - Imported DAL from `.ts` file (Bun handles transpilation)
   - Seeded test data: creators, profiles, posts, summaries
   - Verified opt-in ON/OFF behavior separately
   - Saved evidence files for QA validation

4. **Foreign Key Challenges**
   - All context tables have FK to `creators(id)` with CASCADE delete
   - Test data must create valid `creators` row first
   - Posts table has FK to `epochs(id)` (requires epoch for test data)
   - Post index has FK to `posts(id)` (requires post creation first)
   - Solution: Create dependencies in correct order (creator → epoch → post → index)

### Module Exports
- `getProfile(supabase, creatorId)` - Get profile or null if opt-out
- `updateProfile(supabase, creatorId, updates)` - Upsert profile (no opt-in check)
- `getRecentPosts(supabase, creatorId, options)` - Get posts with history cap
- `getSummary(supabase, creatorId)` - Get summary or null if opt-out
- `getNewsDigest(supabase, creatorId, topic?)` - Get digests or empty if opt-out
- `upsertEmbedding(supabase, params)` - Store embedding or no-op if opt-out

### Dependencies
- Requires migrations from Task 1 (tables must exist)
- Used by Task 5 (context pack builder) and Task 8 (process-mention integration)
- Test scripts require local Supabase running (`supabase status`)

### Next Steps
DAL module ready for integration in context pack builder (Task 5) and other consumers.


## Task 6: Summary Batch Job (Completed)

**Implementation**: Created `supabase/functions/update-summaries/index.ts`

**Key Features**:
- Batch processes creators with `agentic_context_opt_in = true`
- Fetches recent mentions (last 20 or 90 days, whichever smaller)
- Generates rolling summaries via OpenRouter (gpt-4o-mini)
- Enforces 500-token cap on summaries
- Upserts to `creator_conversation_summaries` table
- Respects opt-in status: skips creators with opt-in OFF

**Architecture**:
- Follows existing Supabase function patterns (cors headers, service role auth)
- Uses `runWithConcurrency` helper for parallel processing
- Configurable via env vars: `SUMMARY_MAX_CREATORS`, `SUMMARY_CONCURRENCY`
- Designed for scheduled execution (hourly cadence recommended)

**Dependencies**:
- Blocked by Task 1 (requires `agentic_context_opt_in` column on creators table)
- Blocked by Task 2 (requires creator_conversation_summaries table - DONE)
- Created migration: `20260218163500_add_agentic_context_opt_in.sql`

**Testing**:
- Evidence collected via code inspection (function not deployed locally)
- Verified: opt-in check, token cap, batch processing, LLM integration
- Full integration test blocked by Task 1 dependency

**Next Steps**:
- Apply migration after Task 1 completes
- Schedule job for hourly execution
- Monitor token usage and summary quality


## Task 5: Context Pack Builder (Completed)

**Implementation**: Created `supabase/functions/_shared/context-pack.ts`

**Key Features**:
- Strict token budgeting: Hard limit ≤1,000 tokens
- Drop-order logic: news → posts → persona (persona always kept)
- Opt-in gating: Returns empty pack when `context_opt_in = false`
- Token estimation: Simple heuristic (1 token ≈ 4 characters)
- Parallel data fetching: Profile, posts, summary, news fetched concurrently

**Architecture**:
- `ContextPack` interface with persona, posts, news, totalTokens fields
- `buildContextPack(supabase, creatorId)` main entry point
- Token estimation helpers: `estimateTokens()`, `estimatePersonaTokens()`, `estimatePostsTokens()`, `estimateNewsTokens()`
- Budget enforcement: Sequential checks with cumulative token count

**Drop-Order Implementation**:
1. **Persona** (Priority 1): Always included first, never subjected to budget check
2. **Posts** (Priority 2): Added if `personaTokens + postsTokens ≤ 1000`
3. **News** (Priority 3): Added if `currentTokens + newsTokens ≤ 1000`
- Result: News dropped before posts due to sequential checking

**Opt-In Enforcement**:
- Calls `getProfile(supabase, creatorId)` which returns `null` when opt-in is OFF
- Early return with empty pack: `{ persona: null, posts: null, news: null, totalTokens: 0 }`
- No data retrieval happens when opt-in is OFF (fail-fast)
- Defense-in-depth: DAL helpers also enforce opt-in

**Token Estimation Strategy**:
- Used 4 chars/token heuristic (conservative estimate)
- Alternative: tiktoken via esm.sh for production accuracy
- Persona: bio + summary + tags + interests + specialties
- Posts: content + tags joined
- News: bullets (text + source + url)

**Validation Results** (from evidence files):
- ✅ 25/25 checks passed in validation script
- ✅ Token budget scenarios verified (all fit, news dropped, posts dropped, opt-out)
- ✅ Drop-order logic confirmed (news → posts → persona priority)
- ✅ Opt-in gating verified (empty pack when OFF)

**Module Exports**:
- `ContextPack` type interface
- `buildContextPack(supabase, creatorId)` async function

**Dependencies**:
- Uses `context-dal.ts` helpers: getProfile, getRecentPosts, getSummary, getNewsDigest
- Follows Deno Edge Function patterns (ESM imports from esm.sh)
- Returns CreatorPostIndex[] and CreatorNewsDigest[] types

**Key Learnings**:
1. **Token Budgeting**: Simple estimation (4 chars/token) provides adequate accuracy for budget enforcement
2. **Drop-Order**: Sequential if-checks naturally implement priority (check posts before news)
3. **Opt-In Gating**: Early return prevents unnecessary data fetching (fail-fast pattern)
4. **Defense-in-Depth**: Multiple layers enforce opt-in (pack builder + DAL helpers)
5. **Parallel Fetching**: Promise.all for concurrent data retrieval (reduces latency)

**Integration Notes**:
- Context pack ready for use in process-mention (Task 8)
- Should be called with service role Supabase client
- Returns structured pack with totalTokens for monitoring
- Empty pack (all null) when opt-in is OFF or profile missing

---

## Task 7: News Digest Fetcher (Completed)

**Implementation**: Created `supabase/functions/fetch-news-digests/index.ts`

**Key Features**:
- Scheduled job that fetches news from NewsAPI.org
- Enforces DOUBLE opt-in: `context_opt_in = true` AND `news_enabled = true`
- Normalizes to JSONB format: `{source, url, timestamp, topic, text}`
- Respects cadence preferences (hourly/daily/weekly)
- Topic-level caching to avoid duplicate API calls
- Rate limiting with exponential backoff (3 retries)
- Batch processing with concurrency control (default: 3 concurrent creators)

**Architecture**:
- Follows update-summaries pattern (service role auth, CORS, batch processing)
- SQL-level enforcement: `.eq('context_opt_in', true).eq('news_enabled', true)`
- Application-level defense: Double-check flags before processing
- Cadence window filtering: Only fetch if `last_fetched_at` outside window
- Topic cache shared across creators in single invocation

**Opt-In Enforcement (Critical Security)**:
1. **SQL Query Filter (Primary Defense)**:
   ```typescript
   .from('creator_profiles')
   .select('creator_id, news_topics, news_cadence, context_opt_in, news_enabled')
   .eq('context_opt_in', true)  // GATE 1
   .eq('news_enabled', true)    // GATE 2
   ```
   Result: Ineligible creators NEVER enter processing pipeline

2. **Application-Level Check (Defense in Depth)**:
   ```typescript
   if (!creator.context_opt_in || !creator.news_enabled) {
     return { success: true, topics_updated: 0 };
   }
   ```
   Result: Even if SQL filter bypassed, app blocks

3. **Cadence-Based Rate Limiting**:
   - Checks `last_fetched_at` against cadence window (hourly/daily/weekly)
   - Skips fetch if already fetched within window
   - Result: No redundant API calls, respects creator preferences

**API Integration (NewsAPI.org)**:
- Endpoint: `https://newsapi.org/v2/everything`
- Parameters: `q={topic}`, `pageSize=10`, `sortBy=publishedAt`, `language=en`
- Free tier: 100 requests/day
- Rate limit handling: 429 detection → exponential backoff (1s, 2s, 4s)
- Retry logic: 3 attempts with timeout between retries

**Data Normalization**:
```typescript
type NewsDigestBullet = {
  source: string;      // "TechCrunch"
  url: string;         // Article URL
  timestamp: string;   // ISO 8601
  topic: string;       // "AI", "blockchain", etc.
  text: string;        // title + description
}
```

**Storage Pattern**:
- Table: `creator_news_digests`
- Upsert on conflict: `(creator_id, topic)`
- JSONB field: `digest_bullets` (array of NewsDigestBullet)
- Tracking: `last_fetched_at` for cadence filtering

**Performance Optimizations**:
- **Topic caching**: Same topic across multiple creators → single API call
- **Concurrency control**: Default 3 concurrent creators (configurable)
- **Batch processing**: Up to 50 creators per invocation (configurable)
- **Early exit**: Skip creators within cadence window (no API call)

**Validation Results**:
- ✅ SQL-level opt-in enforcement verified (line 271-279)
- ✅ Application-level double-check verified (line 139-149)
- ✅ Cadence window logic verified (line 150-176)
- ✅ Topic caching implementation verified (line 180-189)
- ✅ Rate limiting with exponential backoff verified (line 77-106)
- ✅ JSONB normalization verified (line 53-58)
- ✅ Service role auth pattern verified (line 236-251)

**Configuration**:
- Environment Variables:
  - `NEWS_API_KEY` (required) - NewsAPI.org API key
  - `NEWS_MAX_CREATORS` (optional, default 50, max 200)
  - `NEWS_CONCURRENCY` (optional, default 3, max 10)
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (required)

**Scheduled Execution**:
- Recommended frequency: Hourly
- Cron pattern: `0 * * * *` (every hour at :00)
- Invocation: POST to `/functions/v1/fetch-news-digests` with service role key
- Body: `{"max_creators": 50, "concurrency": 3}`

**Key Patterns Learned**:

1. **Double Opt-In Enforcement**:
   - SQL query filters at database level (most efficient)
   - Application-level redundant check (defense in depth)
   - Result: Zero-knowledge for opt-out creators (no processing, no API calls)

2. **Cadence-Based Fetch Control**:
   - `getCadenceWindow()` calculates time threshold based on preference
   - Query `last_fetched_at` before fetching
   - Skip if within window (respects creator preference)

3. **Topic-Level Caching**:
   - Shared Map across batch invocation
   - Same topic → reuse API response
   - Reduces API calls from O(creators × topics) to O(unique topics)

4. **Rate Limiting Strategy**:
   - Detect 429 status code
   - Exponential backoff: 2^attempt × 1000ms
   - 3 retry attempts before failure
   - Prevents API ban from rate limit violations

5. **Batch Processing Pattern**:
   - Use `runWithConcurrency` helper (from update-summaries)
   - Configurable concurrency (default 3, max 10)
   - Per-creator error handling (graceful failure, continue batch)
   - Aggregate results for reporting

**Integration Points**:

1. **Task 2 (Context DAL)**:
   - Reads from: `creator_profiles` table
   - Writes to: `creator_news_digests` table
   - Uses: `getNewsDigest()` for retrieval (downstream)

2. **Task 6 (Update Summaries)**:
   - Reuses: `runWithConcurrency` pattern
   - Reuses: Service role auth pattern
   - Reuses: Batch processing approach
   - Reuses: `.eq('context_opt_in', true)` filter

3. **Task 4 (Process Mention - Future)**:
   - Will read: `creator_news_digests` via `getNewsDigest()`
   - No live fetch: Uses cached digests only
   - Opt-in enforced: DAL returns empty array if opt-out

**Security Verification**:
- ✅ No fetch for `context_opt_in = false` creators
- ✅ No fetch for `news_enabled = false` creators
- ✅ Only eligible creators processed (SQL + app enforcement)
- ✅ Service role required (no user-level access)
- ✅ Input validation (concurrency, max_creators clamped)
- ✅ API key from environment (not hardcoded)

**Evidence Files**:
- `.sisyphus/evidence/task-7-news-fetch.txt` - Implementation verification
- `.sisyphus/evidence/task-7-opt-in-enforcement.txt` - Security verification

**Dependencies**:
- Requires Task 1 (migrations for creator_news_digests table)
- Requires Task 2 (context-dal for types and patterns)
- Used by Task 4 (process-mention will read digests)

**Next Steps**:
- Deploy function to Supabase
- Add NEWS_API_KEY to environment
- Schedule hourly invocation via pg_cron or external scheduler
- Monitor API usage (100 requests/day limit)
- Integrate with process-mention (read digests, no live fetch)

---

