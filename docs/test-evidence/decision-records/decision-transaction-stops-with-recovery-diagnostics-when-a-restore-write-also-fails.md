### Case DECISION-TRANSACTION-INCOMPLETE-RECOVERY-001: 决策事务报告恢复写入失败

Entry:
- `tools/decision-records/tests/transaction-recovery.test.ts > decision transaction stops with recovery diagnostics when a restore write also fails`
- `bun test --test-name-pattern="^decision transaction stops with recovery diagnostics when a restore write also fails$" ./tools/decision-records/tests/run.ts`

Contract:
- 恢复步骤再次失败时必须报告原始写入失败和定位的恢复诊断。

Proves:
- 模拟更新与恢复写入各失败一次，断言两个诊断及残留状态。
