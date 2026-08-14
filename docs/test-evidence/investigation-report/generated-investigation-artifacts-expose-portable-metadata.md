### Case INVESTIGATION-GENERATED-METADATA-001: 生成调查制品携带可移植元数据
Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > generated investigation artifacts expose portable metadata`
- `bun test --test-name-pattern="^generated investigation artifacts expose portable metadata$" ./tools/investigation-report/tests/run.ts`
Contract:
- 调查分发制品必须暴露维护来源、当前资源索引 schema、选择性暂存 API 及其传递依赖，且不包含机器绝对路径。
Proves:
- Banner、声明和 source map 使用仓库可移植路径；声明暴露 `stageInvestigationIndex`，source map 内联领域、公共运行时和版本仓库暂存源码；definition version 4 schema 包含 resourceReferences 与 SHA-256 约束。
