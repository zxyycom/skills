### Case DECISION-RELATION-SUMMARY-003: New binds a summary after selector resolution

Tests:
- `test:1a51b82d696e81aba4bc53a7b46dc45ba06c1a77b70f56ce2e865692df3f2517`

Tags:
- `decision-records`

Contract:
- `new --relation-summary <target-selector=summary>` uses the same ID-first target resolution as `--relation`, then writes only the trimmed summary on that relation.

Proves:
- A candidate created from a direct predecessor selector persists `type`, `target`, and the text after the first `=` in canonical relation field order.
