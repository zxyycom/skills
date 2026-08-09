### Case DECISION-CANDIDATE-DISCARD-REFERENCED-001: Discard 拒绝仍被引用的候选
Entry:
- `tools/decision-records/tests/candidate-lifecycle.test.ts > discard rejects a candidate that is still referenced without mutation`
- `bun test --test-name-pattern="^discard rejects a candidate that is still referenced without mutation$" ./tools/decision-records/tests/run.ts`
Contract:
- 仍被其他候选直接引用的候选目标不能删除，以免留下悬空关系。
Proves:
- 对被另一候选修订关系引用的目标执行 discard 返回 still referenced 诊断。
- 被引用目标、引用来源与正式索引均保持不变。
