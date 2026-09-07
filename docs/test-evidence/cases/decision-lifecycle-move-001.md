### Case DECISION-LIFECYCLE-MOVE-001: 归档与重新激活保持 Markdown 语义

Tests:
- `test:ad7c38b2d81e6d91d583ef8b1246800b622364d24b38ad93d74b4845d0f0ea54`

Tags:
- `decision-records`

Contract:
- archive/reactivate 只能移动同一纯 ID 的 root/archive sourcePath，并保留包含显式 `id` 的 Markdown 语义和索引投影。

Proves:
- 归档后 root 消失且 index 指向 archive；重新激活后正文和 sourcePath 恢复。
