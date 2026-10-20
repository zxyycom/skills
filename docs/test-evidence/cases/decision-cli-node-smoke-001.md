### Case DECISION-CLI-NODE-SMOKE-001: 生成 Decision Records CLI 保持 Node 进程协议

Tests:
- `test:da8c0d52d724c8414b327e1d54a41e81809f550dea11d50fda0554cac52c885d`

Tags:
- `decision-records`

Contract:
- 生成的 Decision Records TS CLI 必须可由真实 Node 进程启动，成功读取集合并保留 stdout/stderr 分流及退出状态。

Proves:
- 真实 Node 对有效 fixture 执行 check 以退出码 0 输出验证成功摘要，stderr 为空。
- 缺少 evolve 的必需 successor 时，进程以退出码 2 保持 stdout 为空，并在 stderr 报告参数错误。
