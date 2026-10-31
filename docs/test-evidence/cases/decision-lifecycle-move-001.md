### Case DECISION-LIFECYCLE-MOVE-001: 归档与重新激活保持 Markdown 语义

Tests:
- `test:d4954219cc45f3fed87a169b3bee53e8fc13961781cd3a62894fe1bed9f4670d`

Tags:
- `decision-records`

Contract:
- archive/reactivate 只能移动同一纯 ID 的 root/archive sourcePath，并保留包含显式 `id` 的 Markdown 语义和索引投影。

Proves:
- 归档后 root 消失且 index 指向 archive；重新激活后正文和 sourcePath 恢复。
