### Case INVESTIGATION-RESOURCE-SYMLINK-001: attached resources reject symbolic link targets

Entry:
- `tools/investigation-report/tests/resources.test.ts > attached resources reject symbolic link targets`
- `bun test --test-name-pattern="^attached resources reject symbolic link targets$" ./tools/investigation-report/tests/run.ts`

Contract:
- 随附资源不能解析为符号链接目标。

Proves:
- 符号链接资源返回错误。
