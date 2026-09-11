### Case TASK-GRAPH-APPLY-001: 成功返回排序 alias 映射

Tests:
- `test:1b419d2270b2306bef66f422b339be0b7b9defe4c5a5e15ebfe0a9839f441f74`

Tags:
- `task-graph`

Contract:
- apply 用 Map 在一个 expectedRevision 中解析先定义 alias，并以 all-or-nothing 方式提交 operations；瞬时 alias 与持久字典 key 分属不同契约。

Proves:
- `constructor` alias 可被后续 `@constructor` 安全引用并出现在排序映射中，重复或超过 80 字符的 alias 稳定拒绝；任一操作失败时 revision、task 与 `nextTaskId` 全部回滚。
