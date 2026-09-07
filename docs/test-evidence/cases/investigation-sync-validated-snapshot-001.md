### Case INVESTIGATION-SYNC-VALIDATED-SNAPSHOT-001: full synchronization rejects an empty report collection

Tests:
- `test:8dd3f8aa8e73af49436460498a2d6bdb30c06735015dc3d836d224bf39333dd0`

Tags:
- `investigation-report`

Contract:
- 公共完整 index 同步要求集合至少有一份报告，拒绝时不写派生 index。

Proves:
- 空集合调用 `synchronizeInvestigationIndex` 返回集合诊断，且目标 index 不存在。
