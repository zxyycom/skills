### Case DECISION-TRANSACTION-WRITE-RECOVERY-001: 决策事务在写失败后恢复全部 Markdown 与索引

Entry:
- `tools/decision-records/tests/transaction-recovery.test.ts > decision transaction restores every changed Markdown file and index after a write failure`
- `bun test --test-name-pattern="^decision transaction restores every changed Markdown file and index after a write failure$" ./tools/decision-records/tests/run.ts`

Contract:
- 多文件事务替换索引后失败时恢复全部受影响 Markdown 和索引。

Proves:
- 模拟索引替换后失败，两个正文和索引均恢复。
