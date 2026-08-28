### Case INVESTIGATION-STAGE-BOOTSTRAP-001: stage-index accepts selected report additions in a current index

Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index accepts selected report additions in a current index`
- `bun test --test-name-pattern="^stage-index accepts selected report additions in a current index$" ./tools/investigation-report/tests/run.ts`

Contract:
- 选择性暂存按当前报告集合和索引定义处理新增报告 entry。

Proves:
- 索引定义不满足暂存前提时返回错误而不静默写入。
