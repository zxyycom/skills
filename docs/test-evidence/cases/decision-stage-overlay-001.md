### Case DECISION-STAGE-OVERLAY-001: Stage 应用选择的新增、修改与删除

Tests:
- `test:70b42cdc11ebed0c409f872e9af8d7d8fd41663c00f045f1c105b8b6a304238a`

Tags:
- `decision-records`

Contract:
- stage 将选择的新增、修改、删除和派生索引作为完整 pending 快照暂存；关系 target 与选择均使用纯 ID。

Proves:
- 新增与修改的 pending 正文字节精确等于 stage 前捕获的完整来源，来源字节不变，删除路径消失；pending index 的成员及 title、status、alignment、relations 精确匹配独立期望。
