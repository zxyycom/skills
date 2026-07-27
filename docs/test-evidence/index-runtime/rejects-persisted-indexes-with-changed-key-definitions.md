### Case INDEX-RUNTIME-DEFINITION-001: 拒绝键定义已变化的持久化索引
Entry:
- `tools/index-runtime/tests/materialization.test.ts > rejects persisted indexes with changed key definitions`
- `bun test --test-name-pattern="^rejects persisted indexes with changed key definitions$" ./tools/index-runtime/tests/run.ts`
Contract:
- 当前加载必须验证持久化键定义与运行定义完全一致。
Proves:
- 更名键策略后加载返回 `state-index.definition-mismatch`。
