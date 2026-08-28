### Case INVESTIGATION-RESOURCE-ROOT-001: resource root must be a directory when reports declare resources

Entry:
- `tools/investigation-report/tests/resources.test.ts > resource root must be a directory when reports declare resources`
- `bun test --test-name-pattern="^resource root must be a directory when reports declare resources$" ./tools/investigation-report/tests/run.ts`

Contract:
- 存在资源声明时 `_resources` 必须是目录。

Proves:
- 文件形式的资源根返回 must-be-directory 诊断。
