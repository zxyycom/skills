### Case DECISION-GENERATED-SCHEMA-001: 生成决策 Schema 与运行时索引 Schema 一致

Entry:
- `tools/decision-records/tests/generated-artifacts.test.ts > generated decision schema matches the runtime index schema`
- `bun test --test-name-pattern="^generated\ decision\ schema\ matches\ the\ runtime\ index\ schema$" ./tools/decision-records/tests/run.ts`

Contract:
- 分发的决策索引 JSON Schema 必须与维护源码中的运行时 Schema 保持完全一致。

Proves:
- 分发 Schema 与运行时 Schema 逐结构相同，并保留定义版本、三项 key 定义和必需状态字段。
