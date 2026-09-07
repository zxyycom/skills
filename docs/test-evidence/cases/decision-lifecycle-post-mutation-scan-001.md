### Case DECISION-LIFECYCLE-POST-MUTATION-SCAN-001: 生命周期写后索引检查失败不得伪报成功

Tests:
- `test:aa3322652acc2d72c651bf4b4ad5e9d8fca90640c9119d89d41de5f37ad3d703`

Tags:
- `decision-records`

Contract:
- Decision lifecycle 的写后 index 检查失败时必须恢复事务；CLI 不能输出成功文本或以 0 退出，并且只报告该事务 owner 可证明的 `rolled-back` 范围。

Proves:
- 在 index 写入后的来源检查注入读取失败时，CLI 退出 1 且 stdout 为空。
- stderr 输出 `decision-records.transaction-failed` 和 `rolled-back`，而非 lifecycle 成功消息。
