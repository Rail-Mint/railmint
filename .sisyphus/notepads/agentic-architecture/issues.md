# Issues & Gotchas: Agentic Architecture Enhancement

## [START] Session: ses_38fff062dffejqeCEDOtm5iPB3

### Known Gotchas
- **No live web fetch** during mention processing (cached digests only)
- **Tool-call limit**: ≤ 3 per mention (must not exceed)
- **Prompt injection**: news content must be quoted/isolated as data (not instructions)
- **Schema clashes**: do not alter existing `creators` or `posts` tables
- **Opt-in gating**: must be enforced at read time in DAL

### Open Risks
- pgvector performance at scale (monitor query times)
- Token counting accuracy (need tiktoken or equivalent)
- Context budget enforcement edge cases (multiple sections near limits)

---
