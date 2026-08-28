### Case INVESTIGATION-RESOURCE-FIELD-001: resource links require literal current relative targets

Entry:
- `tools/investigation-report/tests/resources.test.ts > resource links require literal current relative targets`
- `bun test --test-name-pattern="^resource links require literal current relative targets$" ./tools/investigation-report/tests/run.ts`

Contract:
- 资源链接必须保留当前 `./_resources/` 相对目标原文，不能附带 fragment。

Proves:
- 字面相对目标有效，带 fragment 的目标无效。
