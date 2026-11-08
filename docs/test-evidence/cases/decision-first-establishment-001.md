### Case DECISION-FIRST-ESTABLISHMENT-001: 首次建立创建根目录 Decision ID 与定义十一索引

Tests:
- `test:63f984d4806f46c791f3521793bbd9e41aa229b95d9e60ed8a9a7929c32f2324`

Tags:
- `decision-records`

Contract:
- 首次发布使所选候选成为活动记录，并建立按稳定 Decision ID 标识来源 revision 的索引。

Proves:
- 没有索引时，原生预检不创建索引或改写所选正文；提交后根目录来源为 active，索引可按当前 Decision definition 解析且对应 ID 的 revision 与实际正文一致。
- 未选择的非法候选正文保持原样；本节点不单独断言新索引的 alignment 字段或 CLI 呈现。
