### Case INVESTIGATION-QUERY-REPORT-ID-001: show and trace resolve reports by investigation id

Tests:
- `test:21ba640a53ccd1acf55cd46f95a95078495c63fbd792c4c24b8727383f15cb2b`

Tags:
- `investigation-report`

Contract:
- `show` 与 `trace` 只接受规范 Investigation ID，并按报告 ID 查询。

Proves:
- `show` 返回对应 Markdown/state，successors trace 返回确定报告集合，并在三个输出边界透传存在的 relation summary；`./` 和首尾空白输入被拒绝。
