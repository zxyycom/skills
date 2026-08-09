### Case DECISION-TRANSACTION-WRITE-RECOVERY-001: 决策事务在写失败后恢复全部 Markdown 与索引
Entry:
- `tools/decision-records/tests/transaction-recovery.test.ts > decision transaction restores every changed Markdown file and index after a write failure`
- `bun test --test-name-pattern="^decision transaction restores every changed Markdown file and index after a write failure$" ./tools/decision-records/tests/run.ts`
Contract:
- 多文件决策事务遇到可处理的写入失败时，必须报告原始失败并尽力恢复命令前的全部受影响 Markdown 与 decision-index.json。
Proves:
- 第二个 Markdown 写入被故障注入拒绝后，事务返回原始写失败诊断。
- 先前已改写的 Markdown、失败目标和 decision-index.json 均逐字节恢复到事务前内容。
