### Case DECISION-TRANSACTION-ROLLBACK-001: 决策事务回滚关系验证失败
Entry:
- `tools/decision-records/tests/evolution.test.ts > decision transactions roll back relation validation failures`
- `bun test --test-name-pattern="^decision transactions roll back relation validation failures$" ./tools/decision-records/tests/run.ts`
Contract:
- 多记录决策事务在最终关系验证失败时必须恢复全部 Markdown 和索引。
Proves:
- 删除一个已建立记录并同时修改活动与归档记录，造成关系目标状态非法时返回验证错误。
- 被删除记录、两个被修改记录和 decision-index.json 均恢复到事务前内容。
