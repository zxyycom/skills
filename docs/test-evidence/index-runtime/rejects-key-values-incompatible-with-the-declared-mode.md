### Case INDEX-RUNTIME-KEY-VALUE-001: 拒绝与声明模式不兼容的键值
Entry:
- `tools/index-runtime/tests/protocol.test.ts > rejects key values incompatible with the declared mode`
- `bun test --test-name-pattern="^rejects key values incompatible with the declared mode$" ./tools/index-runtime/tests/run.ts`
Contract:
- 每个键策略只能产生其声明模式允许的标量。
Proves:
- 文本键产生布尔值时返回 `state-index.key-value-invalid`。
