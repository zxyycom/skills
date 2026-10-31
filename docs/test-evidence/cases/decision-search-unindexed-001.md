### Case DECISION-SEARCH-UNINDEXED-001: Decision search 按发布范围排除未同步来源

Tests:
- `test:960c5abe67add369f9c071343fa454512c3c70a4a45009ed0ea41552890f886d`

Tags:
- `decision-records`

Contract:
- content 的范围来自发布索引，未同步新增不进入搜索范围。

Proves:
- 新正式 Markdown 中的稀有正文词零命中，无隐式重建或降级提示。
