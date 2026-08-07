### Case TASK-GRAPH-TOPOLOGY-001: 父子环、展开依赖环和悬空引用均被识别

Entry:
- `tools/task-graph/tests/graph-projection.test.ts > graph validation rejects cycles and dangling references`
- `bun test --test-name-pattern="^graph validation rejects cycles and dangling references$" ./tools/task-graph/tests/run.ts`

Contract:
- 根级任务字典中的父子森林与继承展开依赖必须无环，关系只能指向现存 task。

Proves:
- 父子环、展开依赖环和悬空引用均被识别。
