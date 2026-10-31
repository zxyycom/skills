### Case DECISION-STAGE-SCOPE-INDEX-CONFLICT-001: stage --scope index composes with a pending index that already differs from the revision

Tests:
- `test:ee18ca5ce05f1b2f666c06f5319e3d07f500d67367d14afcbe90051ed18d7801`

Tags:
- `decision-records`

Contract:
- index scope 以合法 pending 索引为组合基底，用本次所选的发布投影替换对应条目，未选 pending 条目保持。

Proves:
- 先暂存已变化对象的 index，再暂存另一对象，第二次成功且第一个对象的 pending 投影保留。
