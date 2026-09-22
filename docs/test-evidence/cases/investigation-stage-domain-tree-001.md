### Case INVESTIGATION-STAGE-DOMAIN-TREE-001: stage --scope domain writes the report and its complete owner resource tree

Tests:
- `test:365afdc71dd8025634717a36b234b9f0ef80ef6175b6a94500d114f2ee651f52`

Tags:
- `investigation-report`

Contract:
- domain scope 覆盖所选报告的完整 owner 资源树，成员取工作区与 HEAD 并集。

Proves:
- 引用成员修改、未引用与嵌套新增都进入 pending；索引与未选报告保持零变化。
