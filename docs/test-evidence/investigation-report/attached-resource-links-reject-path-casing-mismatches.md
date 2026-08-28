### Case INVESTIGATION-RESOURCE-CASE-001: attached resource links reject path casing mismatches

Entry:
- `tools/investigation-report/tests/resources.test.ts > attached resource links reject path casing mismatches`
- `bun test --test-name-pattern="^attached resource links reject path casing mismatches$" ./tools/investigation-report/tests/run.ts`

Contract:
- 资源链接必须匹配文件系统中资源路径的精确大小写。

Proves:
- 大小写不匹配返回 casing 诊断。
