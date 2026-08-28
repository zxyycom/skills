### Case INVESTIGATION-RESOURCE-TYPE-001: attached resource targets must be regular files

Entry:
- `tools/investigation-report/tests/resources.test.ts > attached resource targets must be regular files`
- `bun test --test-name-pattern="^attached resource targets must be regular files$" ./tools/investigation-report/tests/run.ts`

Contract:
- 随附资源只能是普通文件。

Proves:
- 目录资源目标返回 regular-file 诊断。
