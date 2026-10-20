### Case DECISION-STAGE-INDEX-ONLY-BASELINE-001: Stage 从仅派生索引的 revision 基线建立决策

Tests:
- `test:db8ed08030852aef3eebb8260529338c7c3640586cfde109632620e0fe945226`

Tags:
- `decision-records`

Contract:
- revision 决策范围只含 `decision-index.json` 时，Stage 必须把它视为没有 Markdown 基线，并以选中的 filesystem Decision 构造首个完整 pending 快照。

Proves:
- 纯 baseline 路径分类将仅含派生索引的范围映射为空来源集。
- 从空基线与选定来源构造 target 后，可生成含该 ID 的合法索引投影；不执行 Git 暂存。
