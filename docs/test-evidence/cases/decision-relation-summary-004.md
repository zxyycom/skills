### Case DECISION-RELATION-SUMMARY-004: Candidate API normalizes direct relation summaries

Tests:
- `test:a1136073231a39a6259306ef6fce051f812761629140b1757510e21675ffe38e`

Tags:
- `decision-records`

Contract:
- The programmatic candidate API accepts direct `{ type, target, summary? }` relation objects without CLI parser fields, persists normalized summaries, and rejects invalid summary values at its boundary.

Proves:
- A direct API relation summary is trimmed before Markdown serialization.
- An over-limit direct API summary returns a validation failure rather than a truncated candidate.
