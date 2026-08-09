### Case INVESTIGATION-RESOURCE-OPTIONAL-001: 无随附资源的报告保持合法

Entry:
- `tools/investigation-report/tests/resources.test.ts > validation keeps reports without attached resources valid`
- `bun test --test-name-pattern="^validation keeps reports without attached resources valid$" ./tools/investigation-report/tests/run.ts`

Contract:
- 随附资源是报告的可选能力；报告未声明资源时仍须通过完整校验并产生显式空投影。

Proves:
- 既有无资源报告能够同步并通过默认检查。
- 其主题 state 的 `resourceReferences` 与索引 metadata 的 `resources` 均为空数组。
