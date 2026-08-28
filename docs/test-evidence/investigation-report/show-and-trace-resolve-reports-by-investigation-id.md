### Case INVESTIGATION-QUERY-REPORT-ID-001: show and trace resolve reports by investigation id

Entry:
- `tools/investigation-report/tests/index-query.test.ts > show and trace resolve reports by investigation id`
- `bun test --test-name-pattern="^show and trace resolve reports by investigation id$" ./tools/investigation-report/tests/run.ts`

Contract:
- `show` 与 `trace` 只接受规范 Investigation ID，并按报告 ID 查询。

Proves:
- `show` 返回对应 Markdown，successors trace 返回确定报告集合；`./` 和首尾空白输入被拒绝。
