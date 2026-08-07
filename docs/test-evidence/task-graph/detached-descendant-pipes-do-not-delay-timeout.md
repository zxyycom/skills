### Case TASK-GRAPH-RUNTIME-TIMEOUT-002: 脱离的后代进程不延迟超时结算

Entry:
- `tools/task-graph/tests/runtime.test.ts > npm timeout does not wait for or capture a detached descendant holding inherited pipes`
- `bun test --test-name-pattern="^npm timeout does not wait for or capture a detached descendant holding inherited pipes$" ./tools/task-graph/tests/run.ts`

Contract:
- 直接子进程只有在收到脱离后代的 ready IPC、核对 ready sentinel 并确认后代已继承 stdout/stderr 后才以退出码 0 正常结束；后代必须继续持有管道超过命令 timeout。
- 安装子进程超时只以真实 `close` 作为管道关闭证据；直接子进程已经正常退出但脱离后代仍持有管道时，终止流程必须在独立总期限内结算，超时之后实际到达的后代输出不得进入返回诊断。

Proves:
- Ready 与 parent-confirmed sentinel、父进程确认输出及 `exitCode === 0` 共同证明直接父进程只在后代启动并持有继承管道后正常退出，随后结果仍为 `timedOut === true` 且在独立总期限内返回。
- 测试观察到后代在 timeout 之后写入 late sentinel；同一次实际延迟写入的 stdout 标记不在已返回诊断中。
