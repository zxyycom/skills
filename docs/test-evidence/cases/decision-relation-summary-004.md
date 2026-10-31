### Case DECISION-RELATION-SUMMARY-004: Candidate API normalizes direct relation summaries

Tests:
- `test:b4d24240d7f2842cf349ea8fbe9cad2404ba7d6ed9b19e245c4edd2f26d14352`

Tags:
- `decision-records`

Contract:
- The programmatic candidate API accepts direct `{ type, target, summary? }` relation objects without CLI parser fields, persists normalized summaries, and rejects invalid summary values at its boundary.

Proves:
- A direct API relation summary is trimmed before Markdown serialization.
- An over-limit direct API summary returns a validation failure rather than a truncated candidate.
