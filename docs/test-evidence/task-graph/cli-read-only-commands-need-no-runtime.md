### Case TASK-GRAPH-RUNTIME-READ-ONLY-001: 领域只读命令不依赖 native runtime

Entry:
- `tools/task-graph/tests/cli.test.ts > CLI domain read-only commands run without an installed runtime`
- `bun test --test-name-pattern="^CLI domain read-only commands run without an installed runtime$" ./tools/task-graph/tests/run.ts`

Contract:
- Index、scope、task 与图投影的只读命令不得加载或安装 native runtime。

Proves:
- `index info`、scope list/show、task list/show 和 actionable 六个领域只读 command path 在有效索引和空 tool home 下全部成功，且没有创建 tool home。
