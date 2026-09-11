### Case INVESTIGATION-SYNC-VALIDATED-SNAPSHOT-001: full synchronization rejects an empty report collection

Tests:
- `test:d2837eba9617d67ffe50d7e5d785505331ad4452b3d9382be638bdc736334fd7`

Tags:
- `investigation-report`

Contract:
- 公共完整 index 同步要求集合至少有一份报告，拒绝时不写派生 index。

Proves:
- 空集合调用 `synchronizeInvestigationIndex` 返回集合诊断，且目标 index 不存在。
