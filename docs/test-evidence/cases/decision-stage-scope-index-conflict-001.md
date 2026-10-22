### Case DECISION-STAGE-SCOPE-INDEX-CONFLICT-001: stage --scope index composes with a pending index that already differs from the revision

Tests:
- `test:3513597d7cff8ceeddbbd10873e28b1782007e65952884f33a59597c48454799`

Tags:
- `decision-records`

Contract:
- index scope 以合法 pending 索引为组合基底，用本次所选的发布投影替换对应条目，未选 pending 条目保持。

Proves:
- 先暂存已变化对象的 index，再暂存另一对象，第二次成功且第一个对象的 pending 投影保留。
