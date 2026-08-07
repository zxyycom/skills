### Case TASK-GRAPH-RUNTIME-WINDOWS-TIMEOUT-002: Windows taskkill 永不结算时仍有界回退

Entry:
- `tools/task-graph/tests/runtime.test.ts > Windows npm timeout bounds a taskkill call that never settles`
- `bun test --test-name-pattern="^Windows npm timeout bounds a taskkill call that never settles$" ./tools/task-graph/tests/run.ts`

Contract:
- Windows 安装子进程超时不能无限等待 `taskkill`；无论外部终止调用是否结算，都必须在独立期限内回退直接终止并返回结构化 timedOut 结果。

Proves:
- 注入永不结算的 taskkill 后，真实长驻 Node 子进程仍在一秒内终止并结算；非 Windows 不执行该平台分支。
