### Case INDEX-RUNTIME-STAGING-PROJECTION-001: 完整重投影后拒绝非法选择目标

Tests:
- `test:b62e1b93eb98da58e362b9217bcd6fdd478a4ca15e09aa1de7bb5344b5c0159f`

Tags:
- `index-runtime`

Contract:
- 按 ID 组合出的目标必须重新执行完整投影与领域级索引验证，且不能回读领域源。

Proves:
- 单独合法的 revision 与工作区索引合成非法跨条目结果时返回 `target-invalid`。
- 领域验证回调观察到完整的选择目标并以 `state-index.index-validation-failed` 拒绝。
- 失败前不调用领域 `read` 或 `readRevision`，也不改变 pending。
