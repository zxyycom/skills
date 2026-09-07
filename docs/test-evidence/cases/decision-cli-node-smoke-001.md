### Case DECISION-CLI-NODE-SMOKE-001: 生成 Decision Records CLI 保持 Node 进程协议

Tests:
- `test:5ed4ce44daafb9f3a388534e65db90426e525edb91f83610e32ca242ee751ea3`

Tags:
- `decision-records`

Contract:
- 生成的 Decision Records MJS CLI 必须可由真实 Node 进程启动，并保留 help 成功和参数失败的 stdout/stderr 分流及退出状态。

Proves:
- `--help` 以退出码 `0` 输出当前命令说明且 stderr 为空。
- 缺少 evolve 的必需 successor 时，进程以退出码 `2` 保持 stdout 为空，并在 stderr 报告参数错误。
