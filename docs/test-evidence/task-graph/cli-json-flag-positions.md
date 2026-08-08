### Case TASK-GRAPH-CLI-JSON-FLAG-001: 全局 JSON flag 可位于 task list 前后

Entry:
- `tools/task-graph/tests/cli.test.ts > CLI task list --json accepts the global flag before or after the command`
- `bun test --test-name-pattern="^CLI task list --json accepts the global flag before or after the command$" ./tools/task-graph/tests/run.ts`

Contract:
- --json 是全局 boolean flag，合法出现一次时可位于 task list command 前或后。

Proves:
- 两种位置都退出 0 并产生逐字节相同的单 LF JSON projection。
