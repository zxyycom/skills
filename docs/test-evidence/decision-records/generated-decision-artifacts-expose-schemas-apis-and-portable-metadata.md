### Case DECISION-GENERATED-ARTIFACTS-001: 决策生成制品公开 Schema 与 API
Entry:
- `tools/decision-records/tests/generated-artifacts.test.ts > generated decision artifacts expose schemas, APIs, and portable metadata`
- `bun test --test-name-pattern="^generated decision artifacts expose schemas, APIs, and portable metadata$" ./tools/decision-records/tests/run.ts`
Contract:
- 决策分发制品必须包含约定 Schema、统一关系事务 API 和可移植来源元数据，且不继续公开 split 专属类型。
Proves:
- 生成声明公开 `DecisionSuccessor`、`DecisionRelationOverride` 及 source/replace 判别分支，并排除 `DecisionSplitSuccessor`。
- 生成脚本、Schema、声明和 source map 暴露完整公共契约与可移植来源路径。
