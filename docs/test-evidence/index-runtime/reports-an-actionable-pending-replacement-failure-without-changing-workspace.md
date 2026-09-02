### Case INDEX-RUNTIME-STAGING-PENDING-WRITE-001: 注入权限拒绝的 Pending 替换失败时保留范围

Entry:
- `tools/index-runtime/tests/staging.test.ts > reports an actionable pending replacement failure without changing workspace`
- `bun test --test-name-pattern="^reports an actionable pending replacement failure without changing workspace$" ./tools/index-runtime/tests/run.ts`

Contract:
- 可完整恢复的 pending 替换失败由 staging 作为事务 owner 报告受控 scope 与 `no-change` outcome，且不得改写工作区索引。

Proves:
- 注入 `access-denied` 的 repository 替换失败时，staging 返回 `pending-write-failed`、`state-index.pending-access-denied` 和共享原因事实。
- 结果声明目标索引 pending scope 的 outcome 为 `no-change`；失败替换不被注入仓储记录为成功，工作区索引保持不变。
