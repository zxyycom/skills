### Case DECISION-ACTIVATION-RELATION-001: 激活归档直接前序并支持有界关系追踪
Entry:
- `tools/decision-records/tests/evolution.test.ts > activation archives a direct predecessor and traces bounded relations`
- `bun test --test-name-pattern="^activation archives a direct predecessor and traces bounded relations$" ./tools/decision-records/tests/run.ts`
Contract:
- 带直接关系激活新候选时必须归档活动前序、保存关系，并让 trace 深度只展开请求范围。
Proves:
- 新记录成为 aligned active，直接前序成为 archived 且关系进入索引。
- predecessor trace 深度 1 只包含直接前序，深度 2 可继续到更早记录。
