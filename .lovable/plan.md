
## Run All Pending Migrations

The database is currently missing several tables, extensions, columns, and functions that exist in the migration files but have never been applied to the live database. Here is a full audit:

### What Currently Exists in the Database
- Core tables: `creators`, `posts`, `likes`, `epochs`, `epoch_rewards`, `mentions`, `donations`, `donation_audit_log`, `wallet_activity_log`, `webhook_nonces`, `user_roles`
- `creators` table is missing the `agentic_context_opt_in` column

### What is Missing (Needs to be Applied)

**Extensions:**
- `vector` (pgvector) — required for semantic search embeddings
- `pg_cron` + `pg_net` — required for the cron job that polls X mentions

**Tables (5 new tables):**
1. `creator_profiles` — stores bio, tags, interests, opt-in settings per creator
2. `creator_post_index` — indexes posts for context retrieval
3. `creator_conversation_summaries` — stores summarized conversation history
4. `creator_news_digests` — stores fetched news digests per topic
5. `creator_embeddings` — stores pgvector embeddings (vector(1536)) for semantic search

**Column on `creators`:**
- `agentic_context_opt_in BOOLEAN NOT NULL DEFAULT false`
- Index: `idx_creators_opt_in`

**Database Function:**
- `match_creator_embeddings(...)` — used by the retrieval system to find semantically similar content via cosine similarity

**Cron Job:**
- `sync-x-mentions-5s-loop` — fires every minute, loops 12x with 5s sleep to poll X mentions via edge function

### Execution Plan

All migrations will be applied in one combined SQL statement in this order:

1. Enable `vector` extension
2. Create `creator_profiles` table + RLS + indexes + trigger
3. Create `creator_post_index` table + RLS + indexes + trigger
4. Create `creator_conversation_summaries` table + RLS + indexes + trigger
5. Create `creator_news_digests` table + RLS + indexes + trigger
6. Create `creator_embeddings` table + RLS + indexes + trigger
7. Create `match_creator_embeddings` function
8. Add `agentic_context_opt_in` column to `creators` + index
9. Enable `pg_cron` + `pg_net` extensions and set up the cron job

All tables will have:
- Row Level Security (RLS) enabled
- Public SELECT policies (creators are public profiles)
- Service-role-only write policies
- `updated_at` auto-update triggers

No existing data will be affected — all operations use `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` patterns.
