### Case INVESTIGATION-RESOURCE-MISSING-001: 缺失的随附资源被定位

Entry:
- `tools/investigation-report/tests/resources.test.ts > validation reports missing attached resources`
- `bun test --test-name-pattern="^validation reports missing attached resources$" ./tools/investigation-report/tests/run.ts`

Contract:
- 报告声明的每个规范资源 ID 都必须在统一资源池中存在。

Proves:
- 局部校验对缺失文件返回包含精确资源 ID 的阻断诊断。
