### Case INDEX-RUNTIME-STAGING-PENDING-WRITE-001: 注入仓储的 Pending 替换失败时给出下一步并保持工作区

Entry:
- `tools/index-runtime/tests/staging.test.ts > reports an actionable pending replacement failure without changing workspace`
- `bun test --test-name-pattern="^reports an actionable pending replacement failure without changing workspace$" ./tools/index-runtime/tests/run.ts`

Contract:
- 可完整恢复的 pending 替换失败必须报告可执行的失败诊断，且 staging 不得改写工作区索引。

Proves:
- 注入 repository 报告可恢复替换失败时，staging 返回 `pending-write-failed` 和 `state-index.pending-write-failed`。
- 诊断要求检查目标 pending 与仓库访问后重试。
- 失败替换不被注入仓储记录为成功，工作区索引保持不变。
