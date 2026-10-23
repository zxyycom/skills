### Case DECISION-LAZY-GRAPH-CONTENT-001: 正文搜索复用发布图并读取当前文本

Tests:
- `test:f500ddfc23f095dbbf43385c168f444a5faea385c5b242218155c72b0f3663e6`

Tags:
- `decision-records`

Contract:
- 正文搜索仅在关系条件需要时完整验证发布图并复用于关系筛选；当前正文中的未同步关系不改变发布范围，缺索引明确失败。

Proves:
- 观察器只计 ID-keyed 领域 records map 的构图访问，不将 sourcePath-keyed 搜索映射当构图；无关系条件不构图，有关系条件只构建并验证一次完整发布图，健康结果不变。
- 当前来源关系改为替代后，替代筛选零命中，发布修订筛选仍命中并显示发布修订边。
- 缺索引失败且不构建来源降级图。
