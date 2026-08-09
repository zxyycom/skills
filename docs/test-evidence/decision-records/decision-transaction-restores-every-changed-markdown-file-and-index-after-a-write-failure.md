### Case DECISION-TRANSACTION-WRITE-RECOVERY-001: 决策事务在写失败后恢复全部 Markdown 与索引
Entry:
- `tools/decision-records/tests/transaction-recovery.test.ts > decision transaction restores every changed Markdown file and index after a write failure`
- `bun test --test-name-pattern="^decision transaction restores every changed Markdown file and index after a write failure$" ./tools/decision-records/tests/run.ts`
Contract:
- 多文件决策事务在 decision-index.json 已完成替换后发生可处理写入失败时，必须报告原始失败并恢复命令前的全部受影响 Markdown 与索引。
Proves:
- 两个 Markdown 更新完成且新索引已经替换后，故障注入使索引写入路径返回包含原始错误的诊断。
- 两个 Markdown 与 decision-index.json 最终都逐字节恢复到事务前内容。
