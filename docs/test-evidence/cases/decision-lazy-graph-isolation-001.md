### Case DECISION-LAZY-GRAPH-ISOLATION-001: 新加载快照隔离变更关系

Tests:
- `test:27c6b073bc772a87f1d5f865f5df87a0ce6d06f153293b3399700c66762cf22d`

Tags:
- `decision-records`

Contract:
- 每次加载独立建立快照图；新快照不得复用旧关系状态，已有稳定快照继续使用自己的图。

Proves:
- 连续读取修改前后索引各构图一次且图引用不同；旧快照仍返回原关系，新快照返回空关系。
- 随后独立公开查询再次构图并观察新状态，而非跨调用缓存旧图。
