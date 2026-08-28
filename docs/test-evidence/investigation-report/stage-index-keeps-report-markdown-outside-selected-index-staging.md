### Case INVESTIGATION-STAGE-ISOLATION-001: stage-index keeps report Markdown outside selected index staging

Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index keeps report Markdown outside selected index staging`
- `bun test --test-name-pattern="^stage-index keeps report Markdown outside selected index staging$" ./tools/investigation-report/tests/run.ts`

Contract:
- `stage-index` 的写入边界只包含派生索引，不包含报告 Markdown。

Proves:
- 有效选择返回成功而报告保持在领域文件边界外。
