### Case INDEX-RUNTIME-STAGING-PENDING-WRITE-001: 注入权限拒绝的 Pending 替换失败时保留范围

Tests:
- `test:b47c131cf256c9b77d8da45d56d225436ff70d7fc0f3e52b51624320cd993ab2`

Tags:
- `index-runtime`

Contract:
- 可完整恢复的 pending 替换失败由 staging 作为事务 owner 报告受控 scope 与 `no-change` outcome，且不得改写工作区索引。

Proves:
- 注入 `access-denied` 的 repository 替换失败时，staging 返回 `pending-write-failed`、`state-index.pending-access-denied` 和共享原因事实。
- 结果声明目标索引 pending scope 的 outcome 为 `no-change`；失败替换不被注入仓储记录为成功，工作区索引保持不变。
