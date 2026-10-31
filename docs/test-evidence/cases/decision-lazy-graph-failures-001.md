### Case DECISION-LAZY-GRAPH-FAILURES-001: 图复用保持选项与完整关系错误优先级

Tests:
- `test:d7a1e25eace2128b978ebc30a3e7aef976938cf745a98dbaa4aab5f58c5ecb9e`

Tags:
- `decision-records`

Contract:
- 图复用不能跳过严格图完整性校验或改变参数、索引与 selector 失败优先级及诊断顺序。

Proves:
- 非法 trace 选项返回退出码 2 与 trace-options-invalid；严格加载返回 active target 与 self-edge 的完整有序诊断。
- 索引关系非法时，缺失 related-to selector 仍先返回 index-query-failed，不伪装成 selector 缺失。
