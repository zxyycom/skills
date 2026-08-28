### Case INVESTIGATION-STAGE-BOOTSTRAP-001: stage-index accepts selected report additions in a current index

Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index accepts selected report additions in a current index`
- `bun test --test-name-pattern="^stage-index accepts selected report additions in a current index$" ./tools/investigation-report/tests/run.ts`

Contract:
- 选择性暂存按当前报告集合和 index 定义处理新增报告 entry。

Proves:
- 真实 Git fixture 中新增报告的当前 entry 写入 cached index；报告 Markdown 本身不被暂存或改写。
