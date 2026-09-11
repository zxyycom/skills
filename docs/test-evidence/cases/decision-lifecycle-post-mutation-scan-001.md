### Case DECISION-LIFECYCLE-POST-MUTATION-SCAN-001: 生命周期写后索引检查失败不得伪报成功

Tests:
- `test:852026df8bbd5ded7b3004ed339790cfcf477d317ad28a68e767bf68120434b2`

Tags:
- `decision-records`

Contract:
- Decision lifecycle 的写后 index 检查失败时必须恢复事务；CLI 不能输出成功文本或以 0 退出，并且只报告该事务 owner 可证明的 `rolled-back` 范围。

Proves:
- 在 index 写入后的来源检查注入读取失败时，CLI 退出 1 且 stdout 为空。
- stderr 输出 `decision-records.transaction-failed` 和 `rolled-back`，而非 lifecycle 成功消息。
