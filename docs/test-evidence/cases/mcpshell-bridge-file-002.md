### Case MCPSHELL-BRIDGE-FILE-002: workspace file transfer respects replace, rejects escapes, and cleans failed receives

Tests:
- `test:1c4ddd7efa438376eb2c879774f741caecee2ac7d6f490d11245cb4694d29dc5`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- file 接收默认不覆盖，replace 在校验后原子落盘；逃逸输入和失败 receive 不得留下临时文件。

Proves:
- 已存在 destination 返回 `destination_exists`；replace 写入新内容；`..` 返回 path rejection，staging 中没有 helper temporary。
