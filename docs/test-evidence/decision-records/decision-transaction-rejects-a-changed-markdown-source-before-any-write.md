### Case DECISION-TRANSACTION-MARKDOWN-PREFLIGHT-001: 决策事务在写入前拒绝已变化的 Markdown
Entry:
- `tools/decision-records/tests/transaction-recovery.test.ts > decision transaction rejects a changed Markdown source before any write`
- `bun test --test-name-pattern="^decision transaction rejects a changed Markdown source before any write$" ./tools/decision-records/tests/run.ts`
Contract:
- 决策事务写入前必须核对每个 Markdown 的已验证快照；来源发生并发变化时应停止并要求重新运行，而不能覆盖新内容或继续其他计划写入。
Proves:
- 当前决策在扫描后被并发修改时，事务返回包含目标路径、changed after validation 与 re-run 的诊断。
- 并发 Markdown 保持新内容，另一项计划 Markdown 更新未执行，索引保持事务前内容。
