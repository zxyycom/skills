### Case DECISION-STAGE-SCOPE-INDEX-CONFLICT-001: stage --scope index rejects a pending index that already differs from the revision

Tests:
- `test:dcd1be75a84e408fd4f61b2a3a0ab7bc527cd68dc24e736025a2d5734e52da99`

Tags:
- `decision-records`

Contract:
- index scope 要求 pending 索引与当前 revision 基线一致。

Proves:
- 已有索引 pending 与基线不同时，第二次 index scope 以零写入失败并提示先检查或解决。
