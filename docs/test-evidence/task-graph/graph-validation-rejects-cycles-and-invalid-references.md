### Case TASK-GRAPH-TOPOLOGY-001: 父子环、展开依赖环、跨 scope 和悬空引用均被识别

Entry:
- `tools/task-graph/tests/graph-projection.test.ts > graph validation rejects cycles, dangling references, and cross-scope relations`
- `bun test --test-name-pattern="^graph validation rejects cycles, dangling references, and cross-scope relations$" ./tools/task-graph/tests/run.ts`

Contract:
- 父子森林与继承展开依赖必须无环，关系仅能指向同一 scope 的现存 task。

Proves:
- 父子环、展开依赖环、跨 scope 和悬空引用均被识别。
