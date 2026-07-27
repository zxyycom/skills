### Case SKILL-VALIDATOR-GENERATED-001: Validator 生成制品公开声明与来源
Entry:
- `tools/skill-validator/tests/run.ts > generated validator artifacts expose declarations and portable metadata`
- `bun test --test-name-pattern="^generated validator artifacts expose declarations and portable metadata$" ./tools/skill-validator/tests/run.ts`
Contract:
- Validator 分发制品必须暴露声明、公共 API 和可移植来源元数据。
Proves:
- 生成脚本、声明及 source map 包含约定导出和仓库相对路径。
