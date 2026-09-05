### Case DECISION-RELATION-SUMMARY-004: Candidate API normalizes direct relation summaries

Entry:
- `tools/decision-records/tests/candidate-scaffold.test.ts > candidate API normalizes direct relation summaries without CLI-only inputs`
- `bun test --test-name-pattern="^candidate API normalizes direct relation summaries without CLI-only inputs$" ./tools/decision-records/tests/run.ts`

Contract:
- The programmatic candidate API accepts direct `{ type, target, summary? }` relation objects without CLI parser fields, persists normalized summaries, and rejects invalid summary values at its boundary.

Proves:
- A direct API relation summary is trimmed before Markdown serialization.
- An over-limit direct API summary returns a validation failure rather than a truncated candidate.
