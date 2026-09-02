### Case DECISION-LIFECYCLE-POST-MUTATION-SCAN-001: 生命周期写后扫描失败不得伪报成功

Entry:
- `tools/decision-records/tests/transaction-recovery.test.ts > lifecycle does not print success when its post-mutation scan fails`
- `bun test --test-name-pattern="^lifecycle does not print success when its post-mutation scan fails$" ./tools/decision-records/tests/run.ts`

Contract:
- Decision lifecycle 完成 Markdown 与 index 事务后仍必须验证当前集合；写后扫描或验证失败时，CLI 不能输出成功文本或以 0 退出，并且只报告该事务 owner 可证明的 `partial-or-unknown` 范围。

Proves:
- 在 index 写入后的后续 collection scan 注入读取失败时，CLI 退出 1 且 stdout 为空。
- stderr 输出 `decision-records.post-mutation-scan-failed` 和 `partial-or-unknown`，而非 lifecycle 成功消息。
