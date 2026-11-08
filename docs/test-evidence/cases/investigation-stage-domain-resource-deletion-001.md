### Case INVESTIGATION-STAGE-DOMAIN-RESOURCE-DELETION-001: stage --scope domain stages owner resource deletions and ignores other owners

Tests:
- `test:ea0eabe85fd39b11c9b53b83ceec8027faf220675694bdaceee5ea66749e892d`

Tags:
- `investigation-report`

Contract:
- domain scope 接纳所选 owner 的受管理资源删除，并保留未选 owner pending。

Proves:
- 真实 Git 中选中 owner 的 remove.txt 从 pending 删除，而未选 owner 的 staged OID 保持。
