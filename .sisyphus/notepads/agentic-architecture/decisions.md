# Architectural Decisions: Agentic Architecture Enhancement

## [START] Session: ses_38fff062dffejqeCEDOtm5iPB3

### Data Model
- **New tables** for context (not extending existing creators/posts)
- **Per-creator scope** (not per-user or workspace)
- **No TTL** (keep until delete)
- **No backfill** (future data only)

### Context Retrieval
- **pgvector** for semantic retrieval
- **Fallback** to recency + topic tags when vectors missing
- **OpenRouter embeddings** (not OpenAI direct)
- **History caps**: last 20 posts OR 90 days (whichever smaller)

### Budget & Drop Order
- **Context pack ≤ 1,000 tokens** (hard limit)
- **Drop order**: news first, then posts, keep persona/profile
- **Summary cap**: 500 tokens max

### Opt-in/Opt-out Behavior
- **Default**: OFF
- **Opt-out**: preserve data but stop using in prompts; no new writes
- **Opt-in required** for all context usage

### News & Summaries
- **News**: scheduled digest jobs only (hourly/daily cadence), cached, no live fetch per request
- **Summaries**: batch job hourly (not per mention)

### Testing
- **Tests-after** (no TDD)
- **Zero human intervention** (all agent-executed QA)
- Evidence saved to `.sisyphus/evidence/`

---
