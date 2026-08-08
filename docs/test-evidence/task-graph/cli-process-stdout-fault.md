### Case TASK-GRAPH-CLI-STDOUT-FAULT-001: Process CLI 的 stdout fault 只进入 stderr

Entry:
- `tools/task-graph/tests/cli.test.ts > process CLI reports stdout faults only on stderr with exit two`
- `bun test --test-name-pattern="^process CLI reports stdout faults only on stderr with exit two$" ./tools/task-graph/tests/run.ts`

Contract:
- 未处理的 stdout 写入 fault 不得伪装成领域结果或污染 stdout；process 边界负责 stderr 和 exit 2。

Proves:
- 模拟 stdout.write 抛错时 stdout 为空、stderr 包含错误且退出 2。
