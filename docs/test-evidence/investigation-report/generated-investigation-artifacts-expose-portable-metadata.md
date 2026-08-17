### Case INVESTIGATION-GENERATED-METADATA-001: 生成调查制品携带可移植的 v5 元数据

Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > generated investigation artifacts expose portable metadata`
- `bun test --test-name-pattern="^generated investigation artifacts expose portable metadata$" ./tools/investigation-report/tests/run.ts`

Contract:
- 调查分发制品必须暴露维护来源、v5 索引 schema、选择性暂存 API 及其传递依赖，且不包含机器绝对路径。

Proves:
- Banner、声明和 source map 使用仓库可移植路径，声明暴露 `stageInvestigationIndex` 及其运行时依赖。
- 生成 schema 固定 definition version 5、严格空 metadata、Schema v3 与主题 state 的 `resourceReferences` 约束。
