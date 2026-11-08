### Case DECISION-REALLOCATION-CANDIDATE-001: 重划候选可前瞻声明未来目标

Tests:
- `test:c81af33136634b16a1baa5a94d42c5bffb480929737ebc869d8e05bf7b5f315c`

Tags:
- `decision-records`

Contract:
- 单个候选可前瞻声明重划关系；发布仍须验证完整目标与事件。

Proves:
- 原生候选发现接受仅有一条指向未来 ID 的重划关系、保留 body-ready 并发 warning；发布预检拒绝缺失目标，原字节不变且不创建索引。此节点不独立证明目标存在但多对多规模不完整时的预检。
