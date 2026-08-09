### Case DECISION-CANDIDATE-DISCARD-GATES-001: Discard 拒绝已建立决策且不写入
Entry:
- `tools/decision-records/tests/candidate-lifecycle.test.ts > discard rejects established decisions without mutation`
- `bun test --test-name-pattern="^discard rejects established decisions without mutation$" ./tools/decision-records/tests/run.ts`
Contract:
- Discard 只能删除未建立候选；正式索引中的已建立身份不能通过把 Markdown 生命周期字段改写成 candidate 来规避。
Proves:
- 对活动已建立决策执行 discard 返回拒绝诊断，Markdown 与索引逐字节不变。
- 把同一已索引 Markdown 伪装成 candidate 后，严格检查报告该身份只允许完整且未索引的候选，索引仍不变。
