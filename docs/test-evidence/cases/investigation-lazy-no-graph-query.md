### Case INVESTIGATION-LAZY-QUERY-001: 普通列表与元数据搜索按需构图

Tests:
- `test:6e0110f632c526440465f9e71de68d2764b075fd70dec4a42d3fc44e3973f584`

Tags:
- `investigation-report`

Contract:
- 无关系条件的 list 与 metadata 搜索不物化关系图，查询排序、total、facets 和命中边界保持不变。

Proves:
- 真实 list 返回 total/facets 与两条分页窗口且不带关系证据；metadata search 命中三条且不带关系证据，显式 graph provider 调用数为零。
