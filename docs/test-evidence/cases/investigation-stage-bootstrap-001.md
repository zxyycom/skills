### Case INVESTIGATION-STAGE-BOOTSTRAP-001: 选择性索引投影接纳新增报告

Tests:
- `test:5b78ce1a314da5bdd5e8e45ac81ac6d3d1227edc049714e30b0089cd3f3d2320`

Tags:
- `investigation-report`

Contract:
- 选择性暂存按当前报告集合和 index 定义处理新增报告 entry。

Proves:
- 生产索引定义与所选快照构建新增报告的完整当前 entry，真实 FS 中新增报告 Markdown 的完整字节前后不变。
