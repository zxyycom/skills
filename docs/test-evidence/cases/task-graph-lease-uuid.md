### Case TASK-GRAPH-LEASE-UUID-001: 索引内 lease UUID 不可重复

Tests:
- `test:44faf2f61d7176537e5b4a995e7a16cdd9f0c5330f8e2977ec65ec71d2850865`

Tags:
- `task-graph`

Contract:
- running lease ID 在全索引中唯一。

Proves:
- 第二任务使用已有 UUID 被 LEASE_CONFLICT 拒绝且 retryable=true，首任务完整状态不变。
