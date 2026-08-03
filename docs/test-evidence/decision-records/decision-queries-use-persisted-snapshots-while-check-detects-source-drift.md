### Case DECISION-QUERY-INDEX-MEMBERSHIP-001: 常规查询读取持久快照且严格检查识别来源漂移
Entry:
- `tools/decision-records/tests/queries.test.ts > decision queries use persisted snapshots while check detects source drift`
- `bun test --test-name-pattern="^decision queries use persisted snapshots while check detects source drift$" ./tools/decision-records/tests/run.ts`
Contract:
- List 与 trace 必须直接使用结构有效的持久索引；show 只读取目标正文；完整来源一致性由严格 check 验证。
Proves:
- 删除已索引 Markdown 后，list 与 trace 仍返回最近快照，show 因目标正文缺失而失败，check 报告来源与索引不一致。
