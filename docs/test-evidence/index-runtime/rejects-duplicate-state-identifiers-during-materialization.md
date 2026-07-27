### Case INDEX-RUNTIME-IDENTITY-001: 物化时拒绝重复状态标识
Entry:
- `tools/index-runtime/tests/protocol.test.ts > rejects duplicate state identifiers during materialization`
- `bun test --test-name-pattern="^rejects duplicate state identifiers during materialization$" ./tools/index-runtime/tests/run.ts`
Contract:
- 每个物化状态必须拥有唯一稳定标识。
Proves:
- 两个状态投影为同一标识时返回 `state-index.id-duplicate`。
