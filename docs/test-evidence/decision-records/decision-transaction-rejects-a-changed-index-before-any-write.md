### Case DECISION-TRANSACTION-INDEX-PREFLIGHT-001: 决策事务拒绝并发变化的索引

Entry:
- `tools/decision-records/tests/transaction-recovery.test.ts > decision transaction rejects a changed index before any write`
- `bun test --test-name-pattern="^decision transaction rejects a changed index before any write$" ./tools/decision-records/tests/run.ts`

Contract:
- 事务预检拒绝验证后变化的索引，保留并发索引文本。

Proves:
- 在 scan 后改写 index，断言不写 Markdown 且 index 保持并发版本。
