### Case DECISION-TRANSACTION-CLEANUP-001: 已提交事务在锁清理失败时报告 cleanup pending

Tests:
- `test:fceb37d558606cec271ed050209ec3b4b8fd00976be624a3c553c65c96218a30`

Tags:
- `decision-records`

Contract:
- Decision transaction 已完成 Markdown 与派生 index 写入后，collection lock 释放失败不得被吞掉，也不得谎称完整回滚；事务 owner 必须只为自己的范围声明 `committed-cleanup-pending`。

Proves:
- 注入 lock remove 失败后返回 `decision-records.collection-lock-release-failed` 和 `committed-cleanup-pending`。
- 已写入的 Decision Markdown 保持提交结果，供后续维护者检查并清理遗留锁。
