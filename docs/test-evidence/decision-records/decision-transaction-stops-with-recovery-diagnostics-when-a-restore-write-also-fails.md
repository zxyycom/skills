### Case DECISION-TRANSACTION-INCOMPLETE-RECOVERY-001: 决策事务报告恢复不完整并停止
Entry:
- `tools/decision-records/tests/transaction-recovery.test.ts > decision transaction stops with recovery diagnostics when a restore write also fails`
- `bun test --test-name-pattern="^decision transaction stops with recovery diagnostics when a restore write also fails$" ./tools/decision-records/tests/run.ts`
Contract:
- 原始写入失败后的恢复若再次失败，事务必须停止成功路径并同时保留原始失败与可定位的恢复诊断，不能声称已经原子恢复。
Proves:
- 故障注入使第二个更新写入和第一个 Markdown 恢复分别失败，返回结果同时包含原始写失败和 `Failed to restore decision body` 诊断。
- 未能恢复的 Markdown 保留变更后内容，其他 Markdown 与索引恢复到事务前内容，明确暴露需要人工恢复的现场。
