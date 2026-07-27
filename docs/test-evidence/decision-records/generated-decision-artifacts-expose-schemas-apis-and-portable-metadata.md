### Case DECISION-GENERATED-ARTIFACTS-001: 决策生成制品公开 Schema 与 API
Entry:
- `tools/decision-records/tests/generated-artifacts.test.ts > generated decision artifacts expose schemas, APIs, and portable metadata`
- `bun test --test-name-pattern="^generated decision artifacts expose schemas, APIs, and portable metadata$" ./tools/decision-records/tests/run.ts`
Contract:
- 决策分发制品必须包含约定 Schema、API 和可移植来源元数据。
Proves:
- 生成脚本、声明及 source map 暴露完整公共契约。
