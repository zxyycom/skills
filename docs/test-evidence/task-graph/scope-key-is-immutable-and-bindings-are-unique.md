### Case TASK-GRAPH-SCOPE-IDENTITY-001: 不存在改 key 操作，binding 替换成功且重复占用被拒绝

Entry:
- `tools/task-graph/tests/schema-index.test.ts > scope key identity is immutable while bindings remain replaceable and unique`
- `bun test --test-name-pattern="^scope key identity is immutable while bindings remain replaceable and unique$" ./tools/task-graph/tests/run.ts`

Contract:
- scope key 是不可变身份，binding 可更新但同 kind/value 在 scope 间唯一。

Proves:
- 不存在改 key 操作，binding 替换成功且重复占用被拒绝。
