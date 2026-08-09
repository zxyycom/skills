### Case INDEX-RUNTIME-STAGING-PENDING-WRITE-001: Pending 替换失败时给出下一步并保留索引

Entry:
- `tools/index-runtime/tests/staging.test.ts > reports an actionable pending replacement failure and preserves the index`
- `bun test --test-name-pattern="^reports an actionable pending replacement failure and preserves the index$" ./tools/index-runtime/tests/run.ts`

Contract:
- 可完整恢复的 pending 替换失败必须报告可执行的失败诊断，并保留写入前的 pending 范围。

Proves:
- 损坏的 pending 快照返回 `pending-write-failed` 和 `state-index.pending-write-failed`。
- 诊断要求检查目标 pending 与仓库访问后重试。
- pending 快照与工作区索引都保持不变。
