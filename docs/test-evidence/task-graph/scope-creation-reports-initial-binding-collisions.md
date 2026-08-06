### Case TASK-GRAPH-BINDING-001: 创建时的重复 binding 返回 BINDING_CONFLICT，而不是泛化索引错误

Entry:
- `tools/task-graph/tests/schema-index.test.ts > scope creation reports initial binding collisions with the stable binding error`
- `bun test --test-name-pattern="^scope creation reports initial binding collisions with the stable binding error$" ./tools/task-graph/tests/run.ts`

Contract:
- create-scope 的初始 bindings 与 binding-set 使用同一唯一性和稳定错误语义。

Proves:
- 创建时的重复 binding 返回 BINDING_CONFLICT，而不是泛化索引错误。
