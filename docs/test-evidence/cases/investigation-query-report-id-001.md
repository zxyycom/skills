### Case INVESTIGATION-QUERY-REPORT-ID-001: show and trace resolve reports by investigation id

Tests:
- `test:aaec5517234e22aedca1f16febff5ecad53357fd37c346ac4410d0b7c2b32731`

Tags:
- `investigation-report`

Contract:
- `show` 与 `trace` 只接受规范 Investigation ID，并按报告 ID 查询。

Proves:
- `show` 返回对应 Markdown/state，successors trace 返回确定报告集合，并在三个输出边界透传存在的 relation summary；`./` 和首尾空白输入被拒绝。
