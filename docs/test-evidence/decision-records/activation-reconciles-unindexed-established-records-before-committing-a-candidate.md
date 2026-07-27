### Case DECISION-CANDIDATE-ACTIVATION-INDEX-001: 激活前收敛未索引的已建立记录
Entry:
- `tools/decision-records/tests/candidate-lifecycle.test.ts > activation reconciles unindexed established records before committing a candidate`
- `bun test --test-name-pattern="^activation reconciles unindexed established records before committing a candidate$" ./tools/decision-records/tests/run.ts`
Contract:
- 激活候选前必须从规范 Markdown 收敛已建立但未索引的记录，不能丢失任一成员。
Proves:
- 索引陈旧时查询拒绝结果，显式同步吸收孤立的已建立记录。
- 随后的候选激活为目标写入建立时间，并让目标和既有记录同时保留在索引。
