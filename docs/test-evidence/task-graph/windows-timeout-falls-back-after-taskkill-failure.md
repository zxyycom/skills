### Case TASK-GRAPH-RUNTIME-WINDOWS-TIMEOUT-001: Windows taskkill 失败后回退直接终止

Entry:
- `tools/task-graph/tests/runtime.test.ts > Windows npm timeout falls back to direct kill when taskkill is unsuccessful`
- `bun test --test-name-pattern="^Windows npm timeout falls back to direct kill when taskkill is unsuccessful$" ./tools/task-graph/tests/run.ts`

Contract:
- Windows 安装子进程超时调用 `taskkill` 失败或返回非零时，必须回退直接 `SIGKILL` 并有界等待 close。

Proves:
- 注入不成功的 taskkill 结果后，真实长驻 Node 子进程仍被直接终止并结算为 timedOut；非 Windows 不执行该平台分支。
