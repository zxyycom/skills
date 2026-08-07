### Case TASK-GRAPH-RUNTIME-TIMEOUT-001: npm 超时终止并等待直接子进程

Entry:
- `tools/task-graph/tests/runtime.test.ts > npm command timeout terminates and waits for the direct child`
- `bun test --test-name-pattern="^npm command timeout terminates and waits for the direct child$" ./tools/task-graph/tests/run.ts`

Contract:
- 安装子进程超时必须终止并结算为 timedOut，不留下后台直接子进程。

Proves:
- 长驻显式 Node 子进程在短期限后被终止，结果标记 timedOut 且没有成功退出。
