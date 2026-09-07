### Case DECISION-RELATION-SUMMARY-003: New binds a summary after selector resolution

Tests:
- `test:56ff1b877a6691d41e329e90ac95b3dda1fd747d9cd7a02e044d87304f3fa2ec`

Tags:
- `decision-records`

Contract:
- `new --relation-summary <target-selector=summary>` uses the same ID-first target resolution as `--relation`, then writes only the trimmed summary on that relation.

Proves:
- A candidate created from a direct predecessor selector persists `type`, `target`, and the text after the first `=` in canonical relation field order.
