### Case DECISION-LAZY-GRAPH-CONTENT-001: 正文搜索按已发布关系筛选当前正文

Tests:
- `test:6ba04530eb319d5261a54f9fe714c4e16de92b86e0519c7aa4dc00251590b5fa`
- `test:fa7e50e3f4d84a397b36c36081b21b228b38456e9bb29ee46f8f03bd2ce5b1c5`

Tags:
- `decision-records`

Contract:
- content 用发布关系筛选当前文本，未同步的正文关系不替代发布图；无关系查询不要求完整关系图合法。

Proves:
- 真实 CLI 对当前正文含替代边但发布索引为修订边的记录，修订筛选命中并给出发布边证据，替代筛选无命中。
- 双域真实 CLI 在发布图成环时无关系 content 查询成功，关系筛选及 trace 失败。
