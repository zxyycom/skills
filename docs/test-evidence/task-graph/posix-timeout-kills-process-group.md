### Case TASK-GRAPH-RUNTIME-POSIX-TIMEOUT-001: POSIX 超时升级终止忽略 SIGTERM 的进程组

Entry:
- `tools/task-graph/tests/runtime.test.ts > POSIX npm timeout escalates to SIGKILL for an ignoring process group and descendants`
- `bun test --test-name-pattern="^POSIX npm timeout escalates to SIGKILL for an ignoring process group and descendants$" ./tools/task-graph/tests/run.ts`

Contract:
- 非 Windows 超时使用有界 SIGTERM 宽限，再以 SIGKILL 收敛同一进程组并等待 close。

Proves:
- 在 POSIX 上忽略 SIGTERM 的父进程和派生后代被 SIGKILL，延迟 sentinel 不会写出；Windows 不执行该平台分支。
