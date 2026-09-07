### Case TASK-GRAPH-LIST-MUTEX-001: 不同来源路径的对称 exclusion 规范化为唯一 pair

Tests:
- `test:79760c25d8639197e849b143324c08f9e240482317a317fcded9e32e589e0b39`

Tags:
- `task-graph`

Contract:
- Effective exclusions 按无向 task pair 归一化；相同 endpoint 来自 direct、ancestor inheritance 与对称反向 projection 时仍只显示一次。

Proves:
- 包含真实 ancestor、child 与 right endpoint 的完整 fixture 对同一 child-right pair 只输出一次。
