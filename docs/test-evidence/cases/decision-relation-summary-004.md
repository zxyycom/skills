### Case DECISION-RELATION-SUMMARY-004: Candidate API normalizes direct relation summaries

Tests:
- `test:1945f1e59917744fa43912c7144e4ee837c0f7ee03847dbe2d4ed133e940f8d2`

Tags:
- `decision-records`

Contract:
- The programmatic candidate API accepts direct `{ type, target, summary? }` relation objects without CLI parser fields, persists normalized summaries, and rejects invalid summary values at its boundary.

Proves:
- A direct API relation summary is trimmed before Markdown serialization.
- An over-limit direct API summary returns a validation failure rather than a truncated candidate.
