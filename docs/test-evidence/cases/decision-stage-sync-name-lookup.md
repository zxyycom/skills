### Case DECISION-BATCH-NAMES-001: 暂存与选择性同步保留混合名字选择及错误

Tests:
- `test:e1669aaa360c3de1f3e2dd7e700ae3cf890e1edde28ff16cc238ada3b315a913`

Tags:
- `selector`

Contract:
- stage 与 selected sync 通过真实 CLI 按完整 ID 或唯一名字定位，重复选择与缺失目标准确失败且保持既有持久状态。

Proves:
- Git fixture 的混合 ID/name 通过 selected sync 预演与真实 stage index，pending 索引包含全部后继 entry，工作区发布索引字节不变。
- 同一 ID 的双 selector 与标准 ID miss 分别使实际 stage 和 sync-index CLI 退出 1；stage 的 pending tree 与工作区发布索引保持原样。
