### Case DECISION-REALLOCATION-NODE-001: 分发同进程 trace 保留完整事件与默认预算阻断

Tests:
- `test:09edb1f734fffd9af0da4c2bb343c3f49185a6dc9abdfdb206342e229d2681e0`

Tags:
- `generated-runtime`

Contract:
- 分发 CLI 与领域 trace 共用方向、完整事件、预算阻断与快照来源契约。

Proves:
- 对 52 个成员的真实稀疏事件，分发同进程 CLI 在预算 52 时返回全部成员、空 context 与完整 coverage，source 声明 published-index。
- 省略 max-records 使用默认预算时只返回 anchor，requiredMaxRecords 为 52 且 coverage.complete=false；不启动 Node 子进程。
