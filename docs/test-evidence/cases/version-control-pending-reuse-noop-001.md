### Case VERSION-CONTROL-PENDING-REUSE-NOOP-001: 复用已验证 pending entry 并跳过无变化发布

Tests:
- `test:e3964c01e74aac2ccbdeddfd6faa3478a2ae4c59de8ed52a9eb8c10e0d618ae3`

Tags:
- `version-control`

Contract:
- `replacePendingFiles` 只在锁内已验证的同路径普通非可执行同字节 entry 可复用；完整目标与当前范围一致时不得发布 pending index，实际变化仍走写入路径。

Proves:
- 无变化替换返回原有路径且不发布 pending 写入。
- 修改目标字节后发布一次替换，并读回新的 pending 文件内容。
