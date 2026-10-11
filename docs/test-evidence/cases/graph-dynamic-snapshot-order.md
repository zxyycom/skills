### Case GRAPH-DYNAMIC-ORDER-001: 动态字段与 iterator 保持原快照读取次序

Tests:
- `test:8fd3bb441122147e7e2aedb5e14f11a95e7ec6fced44658e713fff77fd01ba2a`

Tags:
- `relation-graph`

Contract:
- 动态 adapter 保留 recordIds、traceIds 及 kind 两次读取的既有顺序。

Proves:
- 动态 getter 与自定义 iterator 的实际访问序列精确为 recordIds/成员 iterator/traceIds/direct iterator/kind/kind，并保留第二次 kind 和过滤后 direct。
