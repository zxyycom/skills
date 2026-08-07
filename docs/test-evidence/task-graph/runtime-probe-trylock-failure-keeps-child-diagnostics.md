### Case TASK-GRAPH-RUNTIME-PROBE-001: tryLock 探针失败保留子进程诊断

Entry:
- `tools/task-graph/tests/runtime.test.ts > runtime install probe reports an uncontended tryLock failure with child diagnostics`
- `bun test --test-name-pattern="^runtime install probe reports an uncontended tryLock failure with child diagnostics$" ./tools/task-graph/tests/run.ts`

Contract:
- 安装后探针必须在独立 Node 子进程内执行真实的无争用 tryLock/unlock；探针非零退出必须报告为 probe 阶段的 `RUNTIME_INSTALL_FAILED`，并保留结构化进程诊断。

Proves:
- 运行时闭包完整但 binding 对无争用锁返回 false 时，子进程非零退出；错误同时保留 exitCode、signal、timedOut、stdoutTail、stderrTail，且 stderr 能定位 tryLock 失败。
