### Case INVESTIGATION-STAGE-SCOPE-ALL-001: all scope 写入索引投影报告及 owner 树

Tests:
- `test:ea0eabe85fd39b11c9b53b83ceec8027faf220675694bdaceee5ea66749e892d`

Tags:
- `investigation-report`

Contract:
- all scope 暂存所选报告、受管理资源及所选索引投影，保留未选 pending。

Proves:
- 真实 Git 中选中报告和资源修改、新增与删除进入 pending，索引采用新投影，未选 pending 保持。
