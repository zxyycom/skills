### Case TASK-GRAPH-LIST-MUTEX-001: 不同来源路径的对称 exclusion 规范化为唯一 pair

Entry:
- `tools/task-graph/tests/task-list-renderer.test.ts > task-list renderer normalizes inherited symmetric exclusions into unique pairs`
- `bun test --test-name-pattern="^task-list renderer normalizes inherited symmetric exclusions into unique pairs$" ./tools/task-graph/tests/run.ts`

Contract:
- Effective exclusions 按无向 task pair 归一化；相同 endpoint 来自 direct、ancestor inheritance 与对称反向 projection 时仍只显示一次。

Proves:
- 包含真实 ancestor、child 与 right endpoint 的完整 fixture 对同一 child-right pair 只输出一次。
