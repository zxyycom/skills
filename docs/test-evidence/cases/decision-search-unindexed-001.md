### Case DECISION-SEARCH-UNINDEXED-001: Decision search 按发布范围排除未同步来源

Tests:
- `test:f8b0772cfc1840c342361e4225f2475a8e1bc4c9244cce50fe9cb5b38e1de645`

Tags:
- `decision-records`

Contract:
- content 范围来自发布索引，未同步新增正文不进入范围。

Proves:
- 真实 CLI 在索引外新增含独有词的 Markdown，content 查询该词精确零命中。
