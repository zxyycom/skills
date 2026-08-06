### Case TASK-GRAPH-INDEX-CHECK-001: index check 只读报告规范漂移

Entry:
- `tools/task-graph/tests/store.test.ts > index check reports canonical drift without rewriting authoritative content`
- `bun test --test-name-pattern="^index check reports canonical drift without rewriting authoritative content$" ./tools/task-graph/tests/run.ts`

Contract:
- index check 只读取和报告规范格式或语义问题，不自动修复、覆盖或迁移权威索引；validator 对结构合法但有效 control 无来源的 running task 必须收集 issue 而非抛出。

Proves:
- 非规范但语义合法的索引返回 `index-not-canonical` 且原文件字节不变；顶层 inherit+running 索引返回 `index-invalid` diagnostic 而不会让 check 逸出异常。
