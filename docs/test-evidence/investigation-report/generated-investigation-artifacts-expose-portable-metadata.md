### Case INVESTIGATION-GENERATED-METADATA-001: 生成调查制品携带可移植元数据
Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > generated investigation artifacts expose portable metadata`
- `bun test --test-name-pattern="^generated investigation artifacts expose portable metadata$" ./tools/investigation-report/tests/run.ts`
Contract:
- 调查分发制品必须暴露维护来源且不包含机器绝对路径。
Proves:
- Banner、声明和 source map 使用仓库可移植路径。
