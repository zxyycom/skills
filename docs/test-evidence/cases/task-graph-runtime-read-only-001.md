### Case TASK-GRAPH-RUNTIME-READ-ONLY-001: 领域只读命令不依赖 native runtime

Tests:
- `test:c710cd0a23a23c62c059b5cc531d0b1dd87a9b83861aa59d9f6f58a6362539f6`

Tags:
- `task-graph`

Contract:
- Index、task 与图投影的只读命令不得加载或安装 native runtime；本入口以 `task list --json` 验证 list 的机器读取路径。

Proves:
- `index info`、`task list --json`、task show 和 actionable 四个领域只读 command path 在有效索引和空 tool home 下全部成功，且没有创建 tool home。
