### Case MCPSHELL-BRIDGE-FILE-002: workspace file transfer respects replace, rejects escapes, and cleans failed receives

Entry:
- `tools/mcpshell-workspace-bridge/tests/runtime.test.ts > workspace file transfer respects replace, rejects escapes, and cleans failed receives`
- `bun test --test-name-pattern="^workspace file transfer respects replace, rejects escapes, and cleans failed receives$" ./tools/mcpshell-workspace-bridge/tests/run.ts`

Contract:
- file 接收默认不覆盖，replace 在校验后原子落盘；逃逸输入和失败 receive 不得留下临时文件。

Proves:
- 已存在 destination 返回 `destination_exists`；replace 写入新内容；`..` 返回 path rejection，staging 中没有 helper temporary。
