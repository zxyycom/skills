### Case MCPSHELL-BRIDGE-FILE-002: workspace file transfer respects replace, rejects escapes, and cleans failed receives

Tests:
- `test:58701d2b1c86fb88752aee08d01807d22334c89c8d88d2d777dcded54c5b4057`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- file 接收默认不覆盖，replace 在校验后原子落盘；逃逸输入和失败 receive 不得留下临时文件。

Proves:
- 已存在 destination 返回 `destination_exists`；replace 写入新内容；`..` 返回 path rejection，staging 中没有 helper temporary。
