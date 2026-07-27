### Case INVESTIGATION-INFORMATION-FIELDS-001: 无效信息字段不阻断有效范围
Entry:
- `tools/investigation-report/tests/parsing-directory.test.ts > validation reports invalid information fields without blocking valid scopes`
- `bun test --test-name-pattern="^validation reports invalid information fields without blocking valid scopes$" ./tools/investigation-report/tests/run.ts`
Contract:
- 校验必须报告无效信息字段，同时保留其他有效查询范围。
Proves:
- 字段诊断准确出现，未受影响的报告仍可处理。
