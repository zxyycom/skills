### Case DECISION-TRANSACTION-CLEANUP-003: 已回滚事务在锁清理失败时保留 rolled-back

Entry:
- `tools/decision-records/tests/transaction-recovery.test.ts > decision transaction retains rolled-back when lock release fails after recovery`
- `bun test --test-name-pattern="^decision transaction retains rolled-back when lock release fails after recovery$" ./tools/decision-records/tests/run.ts`

Contract:
- Decision transaction 已完成恢复时，即使 collection lock 释放随后失败，也必须保留 owner 已证明的 `rolled-back`，不得升级为提交或未知写入结果。

Proves:
- 注入 index 写入失败触发恢复、再注入 lock remove 失败后，事务结果为 `rolled-back`。
- lock cleanup 诊断同样使用 `rolled-back`，且 Markdown 来源已恢复原字节。
