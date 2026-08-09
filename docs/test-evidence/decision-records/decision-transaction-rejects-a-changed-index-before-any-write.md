### Case DECISION-TRANSACTION-INDEX-PREFLIGHT-001: 决策事务在写入前拒绝已变化的索引
Entry:
- `tools/decision-records/tests/transaction-recovery.test.ts > decision transaction rejects a changed index before any write`
- `bun test --test-name-pattern="^decision transaction rejects a changed index before any write$" ./tools/decision-records/tests/run.ts`
Contract:
- 决策事务写入前必须核对 decision-index.json 的已验证快照；索引发生并发变化时应停止且保留并发内容。
Proves:
- 索引在扫描后被并发修改时，事务返回包含索引路径、changed after validation 与 re-run 的诊断。
- 计划 Markdown 更新未执行，其他 Markdown 不变，并发索引内容被完整保留。
