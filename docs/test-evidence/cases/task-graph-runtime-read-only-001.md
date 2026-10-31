### Case TASK-GRAPH-RUNTIME-READ-ONLY-001: 领域只读命令不依赖 native runtime

Tests:
- `test:38e183c4d4bf98ae9159536210da1c7fe08f44c1aa161ed1c5a9ed034d8440df`

Tags:
- `task-graph`

Contract:
- Index、task 与图投影的只读命令不得加载或安装 native runtime；本入口以 `task list --json` 验证 list 的机器读取路径。

Proves:
- `index info`、`task list --json`、task show 和 actionable 四个领域只读 command path 在有效索引和空 tool home 下全部成功，且没有创建 tool home。
