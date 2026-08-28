### Case INVESTIGATION-RESOURCE-PATH-001: attached resource section rejects unsafe local targets

Entry:
- `tools/investigation-report/tests/resources.test.ts > attached resource section rejects unsafe local targets`
- `bun test --test-name-pattern="^attached resource section rejects unsafe local targets$" ./tools/investigation-report/tests/run.ts`

Contract:
- 随附资源章节只允许安全的本地资源目标。

Proves:
- 包含路径穿越的资源声明使验证失败。
