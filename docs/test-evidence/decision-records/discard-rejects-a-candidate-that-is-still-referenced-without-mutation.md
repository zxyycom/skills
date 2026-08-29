### Case DECISION-CANDIDATE-DISCARD-REFERENCED-001: Discard 拒绝仍被引用的候选
Entry:
- `tools/decision-records/tests/candidate-lifecycle.test.ts > discard rejects a candidate that is still referenced without mutation`
- `bun test --test-name-pattern="^discard rejects a candidate that is still referenced without mutation$" ./tools/decision-records/tests/run.ts`
Contract:
- 仍被其他候选直接引用的候选目标不能删除，以免留下悬空关系；即使目标 candidate 已进入 Git `HEAD`，也必须先报告引用阻断而不要求额外删除参数。
Proves:
- 已提交的目标和引用候选存在关系时，discard 返回 still referenced 诊断，而不是已记录 candidate 的删除 attention。
- 被引用目标、引用来源与正式索引均保持不变。
