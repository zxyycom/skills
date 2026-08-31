### Case GATE-SCRIPT-CANCELLATION-001: package-script 取消等待子进程关闭

Entry:
- `scripts/vibe-check.test.ts > package script runner waits for a cancelled child to close`
- `bun test --test-name-pattern="^package script runner waits for a cancelled child to close$" ./scripts/vibe-check.test.ts`

Contract:
- package-script adapter 收到 Vibe 取消信号时必须请求自己启动的直属 `bun run` 子进程终止，并在该子进程关闭后才将结果结算为 unavailable。

Proves:
- 被取消的直属子进程收到终止信号并写入终止状态后，runner 才返回稳定的 `package-script-cancelled` unavailable 结果；本 Case 不证明脚本自行派生的后代进程已被终止。
