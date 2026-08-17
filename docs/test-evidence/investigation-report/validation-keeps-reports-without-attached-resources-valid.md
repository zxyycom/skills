### Case INVESTIGATION-RESOURCE-OPTIONAL-001: 无随附资源的报告保持合法

Entry:
- `tools/investigation-report/tests/resources.test.ts > validation keeps reports without attached resources valid`
- `bun test --test-name-pattern="^validation keeps reports without attached resources valid$" ./tools/investigation-report/tests/run.ts`

Contract:
- 调查报告可以不声明随附资源；v5 索引以严格空 metadata 和空报告级资源引用表示该状态。

Proves:
- 不含资源的完整集合通过验证。
- 索引 metadata 为 `{}`，每个主题 state 的 `resourceReferences` 为空数组。
