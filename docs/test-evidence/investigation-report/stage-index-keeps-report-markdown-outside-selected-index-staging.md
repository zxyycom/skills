### Case INVESTIGATION-STAGE-ISOLATION-001: stage-index keeps report Markdown outside selected index staging

Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index keeps report Markdown outside selected index staging`
- `bun test --test-name-pattern="^stage-index keeps report Markdown outside selected index staging$" ./tools/investigation-report/tests/run.ts`

Contract:
- `stage-index` 的暂存写入边界仅为派生 index，不包含报告 Markdown。

Proves:
- 真实 Git fixture 中暂存区只含 index；cached index 等于工作树 index，报告 Markdown 仅留在未暂存工作树差异中。
