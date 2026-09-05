### Case DECISION-RELATION-SUMMARY-003: New binds a summary after selector resolution

Entry:
- `tools/decision-records/tests/candidate-scaffold.test.ts > new binds a relation summary after resolving a direct predecessor selector`
- `bun test --test-name-pattern="^new binds a relation summary after resolving a direct predecessor selector$" ./tools/decision-records/tests/run.ts`

Contract:
- `new --relation-summary <target-selector=summary>` uses the same ID-first target resolution as `--relation`, then writes only the trimmed summary on that relation.

Proves:
- A candidate created from a direct predecessor selector persists `type`, `target`, and the text after the first `=` in canonical relation field order.
