### Case INVESTIGATION-LAZY-QUERY-001: 普通列表与元数据搜索按需构图

Tests:
- `test:a74017fc519b8576289a71592d1c253786c0833456d27979c23521bf63d43986`

Tags:
- `investigation-report`

Contract:
- 无关系条件的 list 与 metadata 搜索不物化关系图，查询排序、total、facets 和命中边界保持不变。

Proves:
- 真实 list/metadata 核心入口返回三条匹配及预期窗口，不增加 filterRelations；每份原始 relations 数组的图投影次数为零。
