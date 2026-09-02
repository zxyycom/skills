### Case DECISION-TRANSACTION-CLEANUP-002: 预检无写入时锁清理失败仍报告 no-change

Entry:
- `tools/decision-records/tests/transaction-recovery.test.ts > decision transaction retains no-change when lock release fails after preflight`
- `bun test --test-name-pattern="^decision transaction retains no-change when lock release fails after preflight$" ./tools/decision-records/tests/run.ts`

Contract:
- Decision transaction 在预检拒绝且 collection lock 随后释放失败时，事务 owner 只能声明 `no-change`，不得因回调已返回错误结果而伪称提交。

Proves:
- 并发来源变更使预检失败后，返回结果保留 transaction failure 和 `decision-records.collection-lock-release-failed`。
- lock cleanup 诊断的 outcome 为 `no-change`，且遗留 lock 可在故障注入撤销后清理。
