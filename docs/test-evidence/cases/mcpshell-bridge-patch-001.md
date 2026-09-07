### Case MCPSHELL-BRIDGE-PATCH-001: workspace apply patch creates, updates, deletes, and atomically rejects a later invalid hunk

Tests:
- `test:ae77bdcf13242cb4820bf082756c43a17c18eb864bed3d38aee2971e0c88e286`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- apply-patch 在固定 project root 用单次 Git apply 支持创建、更新、删除，并在多文件失败时不留先前 hunk。

Proves:
- create/update/delete 成功；含后续缺失文件 hunk 的 patch 返回 target failure，已修改文件保持失败前内容。
