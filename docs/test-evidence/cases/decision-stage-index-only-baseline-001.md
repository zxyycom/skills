### Case DECISION-STAGE-INDEX-ONLY-BASELINE-001: Stage 从仅派生索引的 revision 基线建立决策

Tests:
- `test:db8ed08030852aef3eebb8260529338c7c3640586cfde109632620e0fe945226`

Tags:
- `decision-records`

Contract:
- HEAD 只有合法空发布索引时，stage 可选择工作区已发布的新对象并刷新 pending。

Proves:
- 真实 Git stage 从仅有空索引的 HEAD 成功暂存所选正文和新索引 entry。
