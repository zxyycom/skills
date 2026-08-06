### Case TASK-GRAPH-LOCK-RECOVERY-001: 三种不可确认状态返回恢复错误，dead owner 被隔离后事务重新读取并成功

Entry:
- `tools/task-graph/tests/store.test.ts > stale lock recovery is conservative for live, unknown, remote, and dead owners`
- `bun test --test-name-pattern="^stale lock recovery is conservative for live, unknown, remote, and dead owners$" ./tools/task-graph/tests/run.ts`

Contract:
- 陈旧锁只在同主机 owner 明确死亡时自动隔离，live、unknown 或远端 owner 均停止。

Proves:
- 三种不可确认状态返回恢复错误，dead owner 被隔离后事务重新读取并成功。
