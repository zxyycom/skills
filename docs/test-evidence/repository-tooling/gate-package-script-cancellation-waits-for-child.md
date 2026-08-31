### Case GATE-SCRIPT-CANCELLATION-001: package-script 取消等待子进程关闭

Entry:
- `scripts/vibe-check.test.ts > package script runner waits for a cancelled child to close`
- `bun test --test-name-pattern="^package script runner waits for a cancelled child to close$" ./scripts/vibe-check.test.ts`

Contract:
- package-script adapter 收到 Vibe 取消信号时必须请求子进程终止，并在子进程关闭后才将结果结算为 unavailable，避免门禁先于其拥有的进程边界结束。

Proves:
- 被取消的子进程收到终止信号并写入终止状态后，runner 才返回稳定的 `package-script-cancelled` unavailable 结果。
