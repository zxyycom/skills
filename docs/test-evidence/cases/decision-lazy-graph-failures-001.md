### Case DECISION-LAZY-GRAPH-FAILURES-001: 图复用保持选项与完整关系错误优先级

Tests:
- `test:0ceda6feee972a3c10a87e328faacca804cfde064a8832df9706fe2a497c7bc5`

Tags:
- `decision-records`

Contract:
- 图复用不能跳过严格图完整性校验或改变参数、索引与 selector 失败优先级及诊断顺序。

Proves:
- 非法 trace 选项返回退出码 2 与 trace-options-invalid；严格加载返回 active target 与 self-edge 的完整有序诊断。
- 索引关系非法时，缺失 related-to selector 仍先返回 index-query-failed，不伪装成 selector 缺失。
