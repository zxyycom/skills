### Case INVESTIGATION-RESOURCE-REFERENCE-001: resource links require literal current relative targets

Entry:
- `tools/investigation-report/tests/resources.test.ts > resource links require literal current relative targets`
- `bun test --test-name-pattern="^resource links require literal current relative targets$" ./tools/investigation-report/tests/run.ts`

Contract:
- 附加资源链接使用字面 `./_resources/` 当前相对目标；符合白名单的 ASCII 成对括号合法。

Proves:
- 普通目标和 `evidence(1).txt` 通过；带 fragment 的目标被拒绝。
