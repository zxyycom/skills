### Case DECISION-LIST-FILTERS-001: 决策列表按生命周期、标签与对齐状态筛选

Tests:
- `test:2baef4b00b0e3708ae716d0679f3c0955038b015f6d56e473ce558838168866a`

Tags:
- `decision-records`

Contract:
- List 从持久索引按生命周期、AND 标签和对齐状态选择记录；使用标签选择器。

Proves:
- 真实 list 准备、内存快照投影及 renderer 对活动 project-tooling 与归档 decision-records 条件各只输出匹配 ID；不经 CLI 或磁盘索引读取。
