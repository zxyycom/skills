### Case DECISION-CANDIDATE-DISCARD-INVALID-RELATION-001: Discard 拒绝所选候选的缺失关系目标

Tests:
- `test:852c65b2dcb883d233ceb432a7bcc50af8860588e7c6d4be83dab7f1a85aebba`

Tags:
- `decision-records`

Contract:
- discard 的所选候选仍须通过自身关系目标存在性校验；未选候选正文不成为关系依赖的全局检查。

Proves:
- 所选候选指向不存在的 missing-selected-target 时，discard 返回该目标诊断；关系来源、未选坏候选与正式索引均保持不变。
