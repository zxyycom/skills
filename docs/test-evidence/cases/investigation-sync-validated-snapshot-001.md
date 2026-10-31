### Case INVESTIGATION-SYNC-VALIDATED-SNAPSHOT-001: full synchronization rejects an empty report collection

Tests:
- `test:5b8c93bcf4f602244b902cbd0f04a809d7f9fa70efa4dc91a46839bd78a4aee9`

Tags:
- `investigation-report`

Contract:
- 公共完整 index 同步要求集合至少有一份报告，拒绝时不写派生 index。

Proves:
- 空集合调用 `synchronizeInvestigationIndex` 返回集合诊断，且目标 index 不存在。
