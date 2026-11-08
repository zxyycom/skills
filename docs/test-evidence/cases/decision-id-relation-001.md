### Case DECISION-ID-RELATION-001: 关系使用稳定 ID 与边摘要

Tests:
- `test:b770d083e5425c18302bee8766c0d49b62f8dfd1affddc705457963dcfa35922`

Tags:
- `decision-records`

Contract:
- 关系目标使用稳定 ID，摘要附属于对应的边，并随正式索引与 trace 投影。

Proves:
- 原生 evolve 操作按名称及完整 ID 绑定分组关系；提交后索引保存完整目标 ID 与摘要，trace 投影保留原摘要。该节点不是两种物理路径的独立遍历测试。
