### Case DECISION-TRACE-EVENT-ADMISSION-001: Decision Trace 原子接纳关系事件

Tests:
- `test:19e4acf783da95bf4a9760d95a0b230e3cb6bc06c8a9ea11542b752d4e2f953f`
- `test:7380352825be7a8e2eb8ceacecea8209b21befb3309872bea3b2e82f945b6087`
- `test:7a57236594c453b8ffdae3c06e3c07e5ce561cb3dc71177a869bd2ca75c145fe`

Tags:
- `decision-records`

Contract:
- Decision Trace 必须把完整拆分、纯归并和稀疏重划事件作为原子接纳单元；未直接跨越的同事件成员只作为 context。

Proves:
- 预算足够时，拆分、纯归并和稀疏重划均保留直接成员，且把非直接成员投影到 contextIds。
- 预算不能容纳完整事件时，只保留 anchor，不部分接纳任何成员，并返回 event kind、完整 recordIds 与最小 requiredMaxRecords。
