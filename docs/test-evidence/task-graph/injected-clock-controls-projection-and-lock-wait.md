### Case TASK-GRAPH-CLOCK-001: 注入时间驱动 recovery-needed，并能在禁用 Date.now 时确定性结束锁等待

Entry:
- `tools/task-graph/tests/store.test.ts > injected clock controls effective projection and lock-wait deadlines`
- `bun test --test-name-pattern="^injected clock controls effective projection and lock-wait deadlines$" ./tools/task-graph/tests/run.ts`

Contract:
- 投影、租约与锁等待时限使用公开注入 clock，不直接依赖系统墙钟。

Proves:
- 注入时间驱动 recovery-needed，并能在禁用 Date.now 时确定性结束锁等待。
