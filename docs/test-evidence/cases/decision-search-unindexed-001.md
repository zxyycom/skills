### Case DECISION-SEARCH-UNINDEXED-001: Decision search 按发布范围排除未同步来源

Tests:
- `test:645485388a55505edf0f180c87aa44b41bc0fe159200e65feb247a883e1f7b86`

Tags:
- `decision-records`

Contract:
- content 的范围来自发布索引，未同步新增不进入搜索范围。

Proves:
- 新正式 Markdown 中的稀有正文词零命中，无隐式重建或降级提示。
