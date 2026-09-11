### Case MCPSHELL-BRIDGE-PATCH-001: workspace apply patch creates, updates, deletes, and atomically rejects a later invalid hunk

Tests:
- `test:9562b0bb0113c5556fbcccd9d863d6b603f7528e79bd1e5957396ff80ffd79a0`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- apply-patch 在固定 project root 用单次 Git apply 支持创建、更新、删除，并在多文件失败时不留先前 hunk。

Proves:
- create/update/delete 成功；含后续缺失文件 hunk 的 patch 返回 target failure，已修改文件保持失败前内容。
