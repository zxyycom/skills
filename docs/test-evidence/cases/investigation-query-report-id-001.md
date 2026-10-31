### Case INVESTIGATION-QUERY-REPORT-ID-001: show and trace resolve reports by investigation id

Tests:
- `test:9bde767689fb32cf7538bfca60b35faf0c7812c86bce70c8d020738671b3a82b`

Tags:
- `investigation-report`

Contract:
- `show` 与 `trace` 只接受规范 Investigation ID，并按报告 ID 查询。

Proves:
- `show` 返回对应 Markdown/state，successors trace 返回确定报告集合，并在三个输出边界透传存在的 relation summary；`./` 和首尾空白输入被拒绝。
