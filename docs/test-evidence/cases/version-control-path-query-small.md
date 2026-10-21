### Case VERSION-CONTROL-PATH-QUERY-SMALL-001: 短输入与空范围保持单批计划

Tests:
- `test:66fd97c55f92832641f5edbde9f2cfa249a2cfc54ffd9a7f93ecd3d88f9da416`

Tags:
- `version-control`

Contract:
- 短路径集合保持单批；公共 Git 查询的空 pathScopes 规划为一次完整范围查询。

Proves:
- 空范围产生一个空 pathspec 批次；短的空格和 Unicode 路径以完整字面 pathspec 保持在同一批。
