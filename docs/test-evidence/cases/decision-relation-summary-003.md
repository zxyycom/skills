### Case DECISION-RELATION-SUMMARY-003: New binds a summary after selector resolution

Tests:
- `test:480ebc4eea4130db87e156f314df5222869ae793a6795842030c4341b09c20a7`

Tags:
- `decision-records`

Contract:
- `new --relation-summary <target-selector=summary>` uses the same ID-first target resolution as `--relation`, then writes only the trimmed summary on that relation.

Proves:
- A candidate created from a direct predecessor selector persists `type`, `target`, and the text after the first `=` in canonical relation field order.
