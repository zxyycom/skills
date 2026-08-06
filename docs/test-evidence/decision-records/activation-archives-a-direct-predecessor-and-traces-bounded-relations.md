### Case DECISION-ACTIVATION-RELATION-001: 激活归档直接前序并支持有界关系追踪
Entry:
- `tools/decision-records/tests/evolution.test.ts > activation archives a direct predecessor and traces bounded relations`
- `bun test --test-name-pattern="^activation archives a direct predecessor and traces bounded relations$" ./tools/decision-records/tests/run.ts`
Contract:
- 带直接关系审核并激活显式完整候选时必须归档活动前序、保存关系，并让 trace 深度只展开请求范围；已经进入 Git HEAD 的前序不增加确认调用。
Proves:
- 新记录成为 aligned active，直接前序成为 archived 并保留 aligned 对齐状态，关系进入索引。
- 直接前序已存在于 Git HEAD 时，关系激活一次调用即可完成。
- predecessor trace 深度 1 只包含直接前序，深度 2 可继续到更早记录。
