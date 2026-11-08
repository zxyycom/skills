### Case DECISION-STAGE-INDEX-ONLY-BASELINE-001: Stage 从仅派生索引的 revision 基线建立决策

Tests:
- `test:d72eaec4ac757fd360c0ade4dfcb5083f1e22858afb914bbaecc4380c1b029f7`

Tags:
- `decision-records`

Contract:
- HEAD 只有合法空索引时可暂存新发布对象。

Proves:
- 真实 Git 中 HEAD 只有空索引，CLI index scope 暂存所选新 entry，随后 domain 暂存其正文。
