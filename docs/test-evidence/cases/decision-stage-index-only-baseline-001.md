### Case DECISION-STAGE-INDEX-ONLY-BASELINE-001: Stage 从仅派生索引的 revision 基线建立决策

Tests:
- `test:693dea520f5cc6b7b853fb4e43d5e8acf308796b404e8ff466d807bfa46c1332`

Tags:
- `decision-records`

Contract:
- revision 决策范围只含 `decision-index.json` 时，Stage 必须把它视为没有 Markdown 基线，并以选中的 filesystem Decision 构造首个完整 pending 快照。

Proves:
- 新建有效 Decision 可成功 stage，而不会把空的 Markdown 路径范围解释为整个 revision。
- pending 同时包含新建 Markdown 与从该来源重建的 `decision-index.json` 条目。
