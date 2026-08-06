### Case TASK-GRAPH-APPLY-001: 成功返回排序 alias 映射

Entry:
- `tools/task-graph/tests/cli.test.ts > CLI apply resolves aliases and rolls back every operation when one fails`
- `bun test --test-name-pattern="^CLI apply resolves aliases and rolls back every operation when one fails$" ./tools/task-graph/tests/run.ts`

Contract:
- apply 用 Map 在一个 expectedRevision 中解析先定义 alias，并以 all-or-nothing 方式提交 operations；瞬时 alias 与持久字典 key 分属不同契约。

Proves:
- `constructor` alias 可被后续 `@constructor` 安全引用并出现在排序映射中，重复或超过 80 字符的 alias 稳定拒绝；任一操作失败时 revision、task 与 nextIds 全部回滚。
