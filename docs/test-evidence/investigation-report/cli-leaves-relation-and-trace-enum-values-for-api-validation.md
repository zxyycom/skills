### Case INVESTIGATION-CLI-ENUM-001: CLI leaves relation and trace enum values for API validation

Entry:

- `tools/investigation-report/tests/cli-generated.test.ts > CLI leaves relation and trace enum values for API validation`
- `bun test --test-name-pattern="^CLI leaves relation and trace enum values for API validation$" ./tools/investigation-report/tests/run.ts`

Contract:

- CLI 只负责参数分组；关系类型和 trace direction 的领域枚举由公共 API 校验。

Proves:

- 未知关系类型和 direction 均以操作错误退出，只向 stderr 返回领域诊断。
