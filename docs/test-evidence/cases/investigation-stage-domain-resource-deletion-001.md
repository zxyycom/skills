### Case INVESTIGATION-STAGE-DOMAIN-RESOURCE-DELETION-001: stage --scope domain stages owner resource deletions and ignores other owners

Tests:
- `test:f17dd807707dd4796cc84d03060851bb4db5b0a8bbe4f7b4bf559b017e327c31`

Tags:
- `investigation-report`

Contract:
- owner 资源删除进入 domain scope，其他 owner 的资源保持不变。

Proves:
- 所选报告资源删除写入 pending；另一 owner 的资源修改无 cached 差异。
