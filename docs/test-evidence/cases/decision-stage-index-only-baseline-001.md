### Case DECISION-STAGE-INDEX-ONLY-BASELINE-001: Stage 从仅派生索引的 revision 基线建立决策

Tests:
- `test:198e0460a9294b60faca6049edd7136223936b1a2a5b3b204ccfbd2ac1e07722`

Tags:
- `decision-records`

Contract:
- HEAD 只有合法空发布索引时，stage 可选择工作区已发布的新对象并刷新 pending。

Proves:
- 真实 Git stage 从仅有空索引的 HEAD 成功暂存所选正文和新索引 entry。
