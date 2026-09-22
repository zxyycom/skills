### Case INVESTIGATION-STAGE-BOOTSTRAP-001: stage --scope index accepts selected report additions in a current index

Tests:
- `test:aaf3cadf1286186d3eb88ffbcd682b14c3150360abbb51148cb7c65b65423e04`

Tags:
- `investigation-report`

Contract:
- 选择性暂存按当前报告集合和 index 定义处理新增报告 entry。

Proves:
- 真实 Git fixture 中新增报告的当前 entry 写入 cached index；报告 Markdown 本身不被暂存或改写。
