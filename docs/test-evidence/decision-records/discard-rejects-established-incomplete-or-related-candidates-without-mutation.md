### Case DECISION-CANDIDATE-DISCARD-GATES-001: 丢弃拒绝已建立、不完整或关系无效的候选
Entry:
- `tools/decision-records/tests/candidate-lifecycle.test.ts > discard rejects established, incomplete, or related candidates without mutation`
- `bun test --test-name-pattern="^discard rejects established, incomplete, or related candidates without mutation$" ./tools/decision-records/tests/run.ts`
Contract:
- Discard 只能删除显式声明 `status: candidate`、同时使用 `alignment: null` 与 `createdAt: null`、结构完整、未建立且关系目标合法的记录；拒绝路径不得修改决策或索引。
Proves:
- 已建立记录不能改写成候选；alignment 或 createdAt 非空、缺少必需正文，以及指向活动、候选或非法目标的候选均被拒绝。
- 每次拒绝后目标文件、关系目标和索引内容保持不变。
