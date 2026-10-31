### Case INVESTIGATION-STAGE-DOMAIN-RESOURCE-DELETION-001: stage --scope domain stages owner resource deletions and ignores other owners

Tests:
- `test:445119e87ebd0893cee1c5521cabbdb121dd7a6179234a0f1977c57469346bfd`

Tags:
- `investigation-report`

Contract:
- owner 资源删除进入 domain scope，其他 owner 的资源保持不变。

Proves:
- 所选报告资源删除写入 pending；另一 owner 的资源修改无 cached 差异。
