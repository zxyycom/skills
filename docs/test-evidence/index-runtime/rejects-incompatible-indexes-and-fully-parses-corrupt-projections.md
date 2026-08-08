### Case INDEX-RUNTIME-PERSISTENCE-001: 快速拒绝不兼容索引并完整解析损坏投影
Entry:
- `tools/index-runtime/tests/runtime.test.ts > rejects incompatible indexes and fully parses corrupt projections`
- `bun test --test-name-pattern="^rejects incompatible indexes and fully parses corrupt projections$" ./tools/index-runtime/tests/run.ts`
Contract:
- 快速 runtime open 必须拒绝 key definition 不兼容；结构合法但领域 state 损坏的索引由显式完整 parse 拒绝，并可从源重建。
Proves:
- 不兼容 key definition 返回 `state-index.definition-mismatch`，完整解析对错误状态类型返回带路径的 `state-index.state-parse-failed`，写同步恢复索引。
