### Case INVESTIGATION-STAGE-BOOTSTRAP-001: stage-index accepts selected report additions in a current index

Tests:
- `test:51894fe68608cac2cc67cbb33918f1e8e61229461ecf084a429e7a3a752af2c2`

Tags:
- `investigation-report`

Contract:
- 选择性暂存按当前报告集合和 index 定义处理新增报告 entry。

Proves:
- 真实 Git fixture 中新增报告的当前 entry 写入 cached index；报告 Markdown 本身不被暂存或改写。
