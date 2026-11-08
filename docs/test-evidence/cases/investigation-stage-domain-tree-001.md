### Case INVESTIGATION-STAGE-DOMAIN-TREE-001: stage --scope domain writes the report and its complete owner resource tree

Tests:
- `test:ea0eabe85fd39b11c9b53b83ceec8027faf220675694bdaceee5ea66749e892d`

Tags:
- `investigation-report`

Contract:
- domain scope 选中报告及其受管理 owner 资源，保留未选 pending 并忽略 Git 排除的资源。

Proves:
- 真实 Git 中暂存报告、资源修改、新增及删除，保留执行位、未选 pending 和被忽略文件；domain 保留旧索引投影。
