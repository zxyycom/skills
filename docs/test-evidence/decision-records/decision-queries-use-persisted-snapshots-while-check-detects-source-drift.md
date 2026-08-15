### Case DECISION-QUERY-INDEX-MEMBERSHIP-001: 查询读取持久快照且 Check 检测来源漂移

Entry:
- `tools/decision-records/tests/queries.test.ts > decision queries use persisted snapshots while check detects source drift`
- `bun test --test-name-pattern="^decision queries use persisted snapshots while check detects source drift$" ./tools/decision-records/tests/run.ts`

Contract:
- list/trace 读取持久索引快照，show 读取正文，严格 check 检测来源漂移。

Proves:
- 删除正文后 list/trace 仍从快照返回，show/check 失败。
