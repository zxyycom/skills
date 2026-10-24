### Case INVESTIGATION-LAZY-QUERY-001: 普通列表与元数据搜索按需构图

Tests:
- `test:d4462dbd6befc958bada172606f95d76147d98d85fe8ebf9f809f2d146a8a3fe`

Tags:
- `investigation-report`

Contract:
- 无关系条件的 list 与 metadata 搜索不物化关系图，查询排序、total、facets 和命中边界保持不变。

Proves:
- 真实 list 返回 total/facets 与两条分页窗口且不带关系证据；metadata search 命中三条且不带关系证据，显式 graph provider 调用数为零。
