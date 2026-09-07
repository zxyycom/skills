### Case INVESTIGATION-RESOURCE-SCOPE-001: scoped resource checks do not claim global unreferenced resource proof

Tests:
- `test:86b15fd70e3afd90ef838cb4dbd16dcd6fcfacab88e97aaf1eb29b6d526aa48d`

Tags:
- `investigation-report`

Contract:
- scoped resource validation 不声明完成全局未引用资源与索引证明。

Proves:
- 按 ID 校验时 `indexChecked` 为 false。
