### Case TASK-GRAPH-CLI-VERSION-001: Version 使用 JSON 协议报告 3.1.0

Entry:
- `tools/task-graph/tests/cli.test.ts > CLI version reports 3.1.0 through the JSON protocol`
- `bun test --test-name-pattern="^CLI version reports 3.1.0 through the JSON protocol$" ./tools/task-graph/tests/run.ts`

Contract:
- --version 使用单个 LF 结尾 JSON success 报告当前 task-graph 版本且不读取 index revision。

Proves:
- 结果逐字段为 name task-graph、version 3.0.0 与 revision null。
