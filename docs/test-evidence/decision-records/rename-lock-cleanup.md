### Case DECISION-RENAME-LOCK-CLEANUP-001: rename 提交后锁清理失败保留提交事实

Entry:
- `tools/decision-records/tests/rename.test.ts > Decision rename reports committed cleanup when its lock release fails after publication`
- `bun test --test-name-pattern="^Decision rename reports committed cleanup when its lock release fails after publication$" ./tools/decision-records/tests/run.ts`

Contract:
- Decision rename 的文件和索引已提交后，collection lock 清理失败必须报告 `committed-cleanup-pending` 与锁诊断，不能退化为 `no-change`。

Proves:
- CLI 返回非零注意状态并包含锁清理 diagnostic 和 committed outcome。
- 新 sourcePath 与新 ID 索引项仍存在，证明提交结果未被掩盖。
