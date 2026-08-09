### Case INVESTIGATION-RESOURCE-SYMLINK-001: 随附资源路径中的符号链接被拒绝

Entry:
- `tools/investigation-report/tests/resources.test.ts > validation rejects symbolic links in attached resource paths`
- `bun test --test-name-pattern="^validation rejects symbolic links in attached resource paths$" ./tools/investigation-report/tests/run.ts`

Contract:
- 资源根、中间路径分量和最终文件都不得是符号链接。

Proves:
- 资源根符号链接产生根路径诊断，中间分量与最终文件符号链接产生包含引用资源 ID 的诊断。
