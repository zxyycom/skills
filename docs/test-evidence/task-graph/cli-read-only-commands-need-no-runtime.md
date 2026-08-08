### Case TASK-GRAPH-RUNTIME-READ-ONLY-001: 领域只读命令不依赖 native runtime

Entry:
- `tools/task-graph/tests/cli.test.ts > CLI domain read-only commands run without an installed runtime`
- `bun test --test-name-pattern="^CLI domain read-only commands run without an installed runtime$" ./tools/task-graph/tests/run.ts`

Contract:
- Index、task 与图投影的只读命令不得加载或安装 native runtime；本入口以 `task list --json` 验证 list 的机器读取路径。

Proves:
- `index info`、`task list --json`、task show 和 actionable 四个领域只读 command path 在有效索引和空 tool home 下全部成功，且没有创建 tool home。
