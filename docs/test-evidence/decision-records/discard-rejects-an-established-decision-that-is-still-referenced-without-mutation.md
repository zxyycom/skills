### Case DECISION-DISCARD-REFERENCED-ESTABLISHED-001: Discard 拒绝仍被引用的已建立决策
Entry:
- `tools/decision-records/tests/candidate-lifecycle.test.ts > discard rejects an established decision that is still referenced without mutation`
- `bun test --test-name-pattern="^discard rejects an established decision that is still referenced without mutation$" ./tools/decision-records/tests/run.ts`
Contract:
- 已建立决策仍被另一个已建立决策直接引用时不能删除；诊断应说明剩余引用，而不是把删除后的悬空 target 表现为普通图扫描错误。
Proves:
- 对已归档且仍被 active 后继引用的 Decision ID 执行 discard 返回 still referenced 诊断。
- 被选记录、引用后继和正式索引均保持不变。
