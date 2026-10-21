### Case DECISION-LAZY-GRAPH-FAILURES-001: 图复用保持选项与完整关系错误优先级

Tests:
- `test:67df1bbbfdd6b411b0a1f041d3a1f421afa4a208f73c61a839091c5ed1c915d7`

Tags:
- `decision-records`

Contract:
- 图复用不能跳过严格图完整性校验或改变参数、索引与 selector 失败优先级及诊断顺序。

Proves:
- 非法 trace 选项先返回退出码 2 且零构图；严格加载仍报告 active target 与 self-edge 的完整有序诊断。
- 索引关系非法时，即便 related-to selector 不存在，公开查询先返回索引失败且不伪装成 selector 缺失。
