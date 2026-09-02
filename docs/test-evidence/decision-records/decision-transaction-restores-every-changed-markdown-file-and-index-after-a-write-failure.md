### Case DECISION-TRANSACTION-WRITE-RECOVERY-001: 决策事务在写失败后恢复全部 Markdown 与索引

Entry:
- `tools/decision-records/tests/transaction-recovery.test.ts > decision transaction restores every changed Markdown file and index after a write failure`
- `bun test --test-name-pattern="^decision transaction restores every changed Markdown file and index after a write failure$" ./tools/decision-records/tests/run.ts`

Contract:
- 多文件事务替换索引后失败时恢复全部受影响 Markdown 和索引。

Proves:
- 在原子索引替换已完成后注入 `EIO`，两个正文和索引均恢复，且事务保留受控失败详情。
- 事务结果声明 `rolled-back`，表明该 owner 已验证完整恢复。
