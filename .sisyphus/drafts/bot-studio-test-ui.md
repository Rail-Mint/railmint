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

## Research Findings
- None yet.

## Open Questions
- Where in Studio should this live (new tab/section vs existing page)?
- Which personas are selectable and how are they sourced?
- What input/output fields are required (prompt, system/context, temperature, max tokens, etc.)?
- Should test runs be saved (history) or ephemeral?
- Should this call existing bot inference endpoint or a new internal test endpoint?
- What auth/permissions apply (creator-only vs admin/dev-only)?
- Should the tester expose model parameters (temperature, max tokens, top_p) or keep minimal?
- Should responses show raw JSON/metadata (tokens, latency) or just rendered text?
- Which endpoint should the tester call (exact route/function), and what request/response shape should we target?
- How do we fetch the list of “all saved personas” (data source + schema)?

## Scope Boundaries
- INCLUDE: Studio UI for prompt testing with persona selection.
- EXCLUDE: Not defined yet.
