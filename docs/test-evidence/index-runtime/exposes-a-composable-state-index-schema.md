### Case INDEX-RUNTIME-SCHEMA-001: 暴露可组合的状态索引 schema
Entry:
- `tools/index-runtime/tests/runtime.test.ts > exposes a composable state-index schema`
- `bun test --test-name-pattern="^exposes a composable state-index schema$" ./tools/index-runtime/tests/run.ts`
Contract:
- 状态、键、元数据与协议字段必须可组合为标准对象 schema。
Proves:
- 组合后的 Valibot schema 可导出为对象型 JSON Schema。
