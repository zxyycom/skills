### Case DECISION-RENAME-LOCK-CLEANUP-001: rename 提交后锁清理失败保留提交事实

Tests:
- `test:3975197ac26377ca037ae21d1e7600e818d8c8b0f7e8956cd94e21214d400b0d`

Tags:
- `decision-records`

Contract:
- Decision rename 的文件和索引已提交后，collection lock 清理失败必须报告 `committed-cleanup-pending` 与锁诊断，不能退化为 `no-change`。

Proves:
- CLI 返回非零注意状态并包含锁清理 diagnostic 和 committed outcome。
- 新 sourcePath 与新 ID 索引项仍存在，证明提交结果未被掩盖。
